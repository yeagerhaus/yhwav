import AVFoundation
import Foundation

/// Bounds concurrent HTTP downloads so we don't open an unlimited number of Plex pulls at once
/// (too many caused -1005 / connection drops), while still overlapping a few for throughput.
private actor AudioDownloadGate {
	private let maxConcurrent: Int
	private var active = 0
	private var waiters: [CheckedContinuation<Void, Never>] = []

	init(maxConcurrent: Int) {
		self.maxConcurrent = max(1, maxConcurrent)
	}

	private func acquire() async {
		if active < maxConcurrent {
			active += 1
			return
		}
		await withCheckedContinuation { waiters.append($0) }
	}

	private func release() {
		if let next = waiters.first {
			waiters.removeFirst()
			// Hand the slot directly to the next waiter (active count unchanged).
			next.resume()
		} else {
			active -= 1
		}
	}

	func run<T: Sendable>(_ body: @Sendable () async throws -> T) async throws -> T {
		await acquire()
		do {
			let result = try await body()
			release()
			return result
		} catch {
			release()
			throw error
		}
	}
}

final class AudioFileCache {
	static let errorDomain = "AudioFileCache"
	/// Decoded audio is far shorter than Plex metadata (truncated transcode) — caller may try direct file URL.
	static let durationMismatchCode = -42
	/// Download returned a non-2xx HTTP status (`userInfo["status"]` holds the code).
	static let httpStatusCode = -43

	private let cacheDir: URL
	private var cachedFiles: [String: URL] = [:]
	/// LRU bookkeeping (guarded by `queue`). The cache is capped by total size; least recently used
	/// entries are evicted first, never the pinned (current/next) tracks.
	private var lastAccess: [String: UInt64] = [:]
	private var fileSizes: [String: Int64] = [:]
	private var accessCounter: UInt64 = 0
	private var pinnedTrackIds: Set<String> = []
	private let maxCacheBytes: Int64 = 1_024 * 1_024 * 1_024 // 1 GB
	private var activeDownloads: [String: Task<URL, Error>] = [:]
	private let queue = DispatchQueue(label: "com.yhwav.audio-file-cache")
	private let downloadGate = AudioDownloadGate(maxConcurrent: 3)

	private let maxRetries = 2
	private let retryDelay: TimeInterval = 0.5

	init() {
		cacheDir = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("yhwav-audio-cache")
		// Files from a previous session aren't indexed; start clean so they can't accumulate across launches.
		try? FileManager.default.removeItem(at: cacheDir)
		try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
	}

	/// Tracks that must not be evicted (the one playing and the one prepared next).
	func setPinnedTrackIds(_ ids: Set<String>) {
		queue.sync { pinnedTrackIds = ids }
	}

	/// Must be called on `queue`.
	private func touchLocked(_ trackId: String) {
		accessCounter &+= 1
		lastAccess[trackId] = accessCounter
	}

	/// Must be called on `queue`. Records a newly cached file and evicts LRU entries over the size cap.
	private func insertLocked(trackId: String, fileURL: URL) {
		cachedFiles[trackId] = fileURL
		let size = (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? NSNumber)?.int64Value ?? 0
		fileSizes[trackId] = size
		touchLocked(trackId)

		var total = fileSizes.values.reduce(0, +)
		guard total > maxCacheBytes else { return }
		let candidates = cachedFiles.keys
			.filter { $0 != trackId && !pinnedTrackIds.contains($0) }
			.sorted { (lastAccess[$0] ?? 0) < (lastAccess[$1] ?? 0) }
		for id in candidates where total > maxCacheBytes {
			if let url = cachedFiles.removeValue(forKey: id) {
				try? FileManager.default.removeItem(at: url)
			}
			total -= fileSizes.removeValue(forKey: id) ?? 0
			lastAccess.removeValue(forKey: id)
		}
	}

	/// Where streamed/downloaded files live (used by the streaming source to persist as it downloads).
	var cacheDirectory: URL { cacheDir }

	/// True if the full file for this track is already on disk (offline/prefetched) so playback can
	/// use the fast `AVAudioFile` path instead of streaming.
	func hasCached(trackId: String) -> Bool {
		queue.sync { cachedFiles[trackId] != nil }
	}

	/// Registers a file the streaming source fully downloaded so replay/seek reuse it as the cache entry.
	func registerCachedFile(trackId: String, fileURL: URL) {
		queue.sync {
			if let old = cachedFiles[trackId], old != fileURL {
				try? FileManager.default.removeItem(at: old)
			}
			insertLocked(trackId: trackId, fileURL: fileURL)
		}
	}

	/// - Parameter expectedDurationSeconds: Plex catalog length in seconds (from JS `duration` ms / 1000). Used to detect truncated transcodes.
	func getAudioFile(url: URL, trackId: String, expectedDurationSeconds: Double? = nil) async throws -> AVAudioFile {
		if url.isFileURL {
			let exists = FileManager.default.fileExists(atPath: url.path)
			yhLog("YhwavAudio: cache hit trackId=\(trackId) (local file, exists=\(exists), ext=\(url.pathExtension))")
			if !exists {
				throw NSError(domain: Self.errorDomain, code: -1, userInfo: [
					NSLocalizedDescriptionKey: "Local file not found: \(url.lastPathComponent)"
				])
			}
			return try AVAudioFile(forReading: url)
		}

		var allowMismatchRetry = true
		while true {
			let diskURL: URL
			if let cached = queue.sync(execute: { () -> URL? in
				let url = cachedFiles[trackId]
				if url != nil { touchLocked(trackId) }
				return url
			}) {
				diskURL = cached
			} else {
				diskURL = try await download(url: url, trackId: trackId)
			}

			let file = try AVAudioFile(forReading: diskURL)

			if shouldValidateTranscodeDuration(url: url, expected: expectedDurationSeconds),
			   !validateDecodedAudioMatchesCatalog(file: file, url: url, expectedSeconds: expectedDurationSeconds!) {
				yhLog("YhwavAudio: cache duration mismatch trackId=\(trackId) — evicting")
				evict(trackIds: Set([trackId]))
				if allowMismatchRetry {
					allowMismatchRetry = false
					continue
				}
				throw NSError(domain: Self.errorDomain, code: Self.durationMismatchCode, userInfo: [
					NSLocalizedDescriptionKey: "Transcoded file is much shorter than track metadata (possible truncated download)"
				])
			}

			return file
		}
	}

	func predownload(url: URL, trackId: String) {
		guard !url.isFileURL else { return }
		let alreadyCached = queue.sync { cachedFiles[trackId] != nil || activeDownloads[trackId] != nil }
		guard !alreadyCached else { return }

		yhLog("YhwavAudio: cache predownload trackId=\(trackId)")
		let task = Task<URL, Error> {
			defer {
				self.queue.sync { self.activeDownloads.removeValue(forKey: trackId) }
			}
			return try await self.performDownloadWithRetry(url: url, trackId: trackId)
		}
		queue.sync { activeDownloads[trackId] = task }
	}

	func cancelDownload(trackId: String) {
		queue.sync {
			activeDownloads[trackId]?.cancel()
			activeDownloads.removeValue(forKey: trackId)
		}
	}

	/// Stops in-flight downloads except the given IDs so skip/play can grab the serial download slot.
	func cancelDownloads(exceptTrackIds: Set<String>) {
		let cancelled: [String] = queue.sync {
			let ids = activeDownloads.keys.filter { !exceptTrackIds.contains($0) }
			for id in ids {
				activeDownloads[id]?.cancel()
				activeDownloads.removeValue(forKey: id)
			}
			return Array(ids)
		}
		if !cancelled.isEmpty {
			yhLog("YhwavAudio: cache cancel \(cancelled.count) download(s) for priority (keeping \(exceptTrackIds.count) id(s))")
		}
	}

	func evict(trackIds: Set<String>) {
		queue.sync {
			for id in trackIds {
				activeDownloads[id]?.cancel()
				activeDownloads.removeValue(forKey: id)
				if let url = cachedFiles.removeValue(forKey: id) {
					try? FileManager.default.removeItem(at: url)
				}
				fileSizes.removeValue(forKey: id)
				lastAccess.removeValue(forKey: id)
			}
		}
		if !trackIds.isEmpty {
			yhLog("YhwavAudio: cache evict \(trackIds.count) tracks")
		}
	}

	func clearAll() {
		queue.sync {
			for (_, task) in activeDownloads { task.cancel() }
			activeDownloads.removeAll()
			cachedFiles.removeAll()
			fileSizes.removeAll()
			lastAccess.removeAll()
		}
		try? FileManager.default.removeItem(at: cacheDir)
		try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
		yhLog("YhwavAudio: cache clearAll")
	}

	private func shouldValidateTranscodeDuration(url: URL, expected: Double?) -> Bool {
		guard let e = expected, e >= 12 else { return false }
		return url.path.contains("/transcode/")
	}

	private func validateDecodedAudioMatchesCatalog(file: AVAudioFile, url: URL, expectedSeconds: Double) -> Bool {
		let got = Double(file.length) / file.processingFormat.sampleRate
		// Allow intro/gap tolerance; reject obvious truncations (e.g. 3s of audio for a 3 min song).
		let threshold = max(expectedSeconds * 0.68, expectedSeconds - 14.0)
		let ok = got + 1.5 >= threshold
		if !ok {
			yhLog("YhwavAudio: validation expected~\(String(format: "%.0f", expectedSeconds))s decoded=\(String(format: "%.1f", got))s transcode=\(url.path.contains("/transcode/"))")
		}
		return ok
	}

	private func download(url: URL, trackId: String) async throws -> URL {
		let existing: Task<URL, Error>? = queue.sync { activeDownloads[trackId] }
		if let existing {
			do {
				return try await existing.value
			} catch {
				queue.sync { activeDownloads.removeValue(forKey: trackId) }
				throw error
			}
		}

		let task = Task<URL, Error> {
			try await self.performDownloadWithRetry(url: url, trackId: trackId)
		}
		queue.sync { activeDownloads[trackId] = task }

		do {
			return try await task.value
		} catch {
			queue.sync { activeDownloads.removeValue(forKey: trackId) }
			throw error
		}
	}

	private func performDownloadWithRetry(url: URL, trackId: String) async throws -> URL {
		var lastError: Error?
		for attempt in 0...maxRetries {
			do {
				if attempt > 0 {
					yhLog("YhwavAudio: cache retry \(attempt)/\(maxRetries) trackId=\(trackId)")
					try await Task.sleep(nanoseconds: UInt64(retryDelay * Double(attempt) * 1_000_000_000))
				}
				return try await performDownload(url: url, trackId: trackId)
			} catch {
				lastError = error
				if Task.isCancelled { throw error }

				let nsErr = error as NSError
				let isNetworkError = nsErr.domain == NSURLErrorDomain &&
					[NSURLErrorNetworkConnectionLost, NSURLErrorTimedOut, NSURLErrorNotConnectedToInternet,
					 NSURLErrorCannotConnectToHost, NSURLErrorCannotFindHost].contains(nsErr.code)
				// Transient server-side statuses are worth a retry; 4xx (auth, not found) are not.
				let status = nsErr.userInfo["status"] as? Int ?? 0
				let isRetryableHTTP = nsErr.domain == AudioFileCache.errorDomain && nsErr.code == AudioFileCache.httpStatusCode &&
					(status >= 500 || status == 408 || status == 429)
				if !isNetworkError && !isRetryableHTTP { throw error }

				yhLog("YhwavAudio: cache download failed trackId=\(trackId) attempt=\(attempt): \(error.localizedDescription)")
			}
		}
		throw lastError!
	}

	private func performDownload(url: URL, trackId: String) async throws -> URL {
		let dir = cacheDir
		let dest: URL = try await downloadGate.run {
			let start = Date()
			let isTranscode = url.path.contains("/transcode/")
			yhLog("YhwavAudio: cache download start trackId=\(trackId) transcode=\(isTranscode)")

			let (tempURL, response) = try await URLSession.shared.download(from: url)

			try Task.checkCancellation()

			let httpResp = response as? HTTPURLResponse
			// URLSession reports success for any HTTP status. Never cache an error body (401/404/5xx) as
			// audio: it would be reused for every later play of this track.
			if let status = httpResp?.statusCode, !(200..<300).contains(status) {
				try? FileManager.default.removeItem(at: tempURL)
				throw NSError(domain: AudioFileCache.errorDomain, code: AudioFileCache.httpStatusCode, userInfo: [
					NSLocalizedDescriptionKey: "Download failed with HTTP \(status)",
					"status": status,
				])
			}
			let contentType = httpResp?.value(forHTTPHeaderField: "Content-Type") ?? "unknown"
			let ext = httpResp?.suggestedFilename.flatMap {
				URL(fileURLWithPath: $0).pathExtension
			} ?? "audio"
			let destination = dir.appendingPathComponent("\(trackId).\(ext)")

			try? FileManager.default.removeItem(at: destination)
			try FileManager.default.moveItem(at: tempURL, to: destination)

			let size = (try? FileManager.default.attributesOfItem(atPath: destination.path)[.size] as? Int) ?? 0
			let elapsed = Int(Date().timeIntervalSince(start) * 1000)
			let sizeMB = String(format: "%.1f", Double(size) / 1_048_576)
			yhLog("YhwavAudio: cache download complete trackId=\(trackId) size=\(sizeMB)MB ext=\(ext) type=\(contentType) elapsed=\(elapsed)ms")

			return destination
		}

		queue.sync {
			insertLocked(trackId: trackId, fileURL: dest)
			activeDownloads.removeValue(forKey: trackId)
		}

		return dest
	}
}
