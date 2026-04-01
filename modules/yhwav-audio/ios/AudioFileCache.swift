import AVFoundation
import Foundation

final class AudioFileCache {
	private let cacheDir: URL
	private var cachedFiles: [String: URL] = [:]
	private var activeDownloads: [String: Task<URL, Error>] = [:]
	private let queue = DispatchQueue(label: "com.yhwav.audio-file-cache")

	private let maxRetries = 2
	private let retryDelay: TimeInterval = 0.5

	init() {
		cacheDir = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("yhwav-audio-cache")
		try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
	}

	func getAudioFile(url: URL, trackId: String) async throws -> AVAudioFile {
		if url.isFileURL {
			let exists = FileManager.default.fileExists(atPath: url.path)
			print("YhwavAudio: cache hit trackId=\(trackId) (local file, exists=\(exists), ext=\(url.pathExtension))")
			if !exists {
				throw NSError(domain: "AudioFileCache", code: -1, userInfo: [
					NSLocalizedDescriptionKey: "Local file not found: \(url.lastPathComponent)"
				])
			}
			return try AVAudioFile(forReading: url)
		}

		if let cached = queue.sync(execute: { cachedFiles[trackId] }) {
			print("YhwavAudio: cache hit trackId=\(trackId)")
			return try AVAudioFile(forReading: cached)
		}

		let localURL = try await download(url: url, trackId: trackId)
		return try AVAudioFile(forReading: localURL)
	}

	func predownload(url: URL, trackId: String) {
		guard !url.isFileURL else { return }
		let alreadyCached = queue.sync { cachedFiles[trackId] != nil || activeDownloads[trackId] != nil }
		guard !alreadyCached else { return }

		print("YhwavAudio: cache predownload trackId=\(trackId)")
		let task = Task<URL, Error> {
			try await self.performDownloadWithRetry(url: url, trackId: trackId)
		}
		queue.sync { activeDownloads[trackId] = task }
	}

	func cancelDownload(trackId: String) {
		queue.sync {
			activeDownloads[trackId]?.cancel()
			activeDownloads.removeValue(forKey: trackId)
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
			}
		}
		if !trackIds.isEmpty {
			print("YhwavAudio: cache evict \(trackIds.count) tracks")
		}
	}

	func clearAll() {
		queue.sync {
			for (_, task) in activeDownloads { task.cancel() }
			activeDownloads.removeAll()
			cachedFiles.removeAll()
		}
		try? FileManager.default.removeItem(at: cacheDir)
		try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
		print("YhwavAudio: cache clearAll")
	}

	private func download(url: URL, trackId: String) async throws -> URL {
		let existing: Task<URL, Error>? = queue.sync { activeDownloads[trackId] }
		if let existing {
			return try await existing.value
		}

		let task = Task<URL, Error> {
			try await self.performDownloadWithRetry(url: url, trackId: trackId)
		}
		queue.sync { activeDownloads[trackId] = task }

		let result = try await task.value
		return result
	}

	private func performDownloadWithRetry(url: URL, trackId: String) async throws -> URL {
		var lastError: Error?
		for attempt in 0...maxRetries {
			do {
				if attempt > 0 {
					print("YhwavAudio: cache retry \(attempt)/\(maxRetries) trackId=\(trackId)")
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
				if !isNetworkError { throw error }

				print("YhwavAudio: cache download failed trackId=\(trackId) attempt=\(attempt): \(error.localizedDescription)")
			}
		}
		throw lastError!
	}

	private func performDownload(url: URL, trackId: String) async throws -> URL {
		let start = Date()
		print("YhwavAudio: cache download start trackId=\(trackId) url=\(url.scheme ?? "nil")://…")

		let (tempURL, response) = try await URLSession.shared.download(from: url)

		try Task.checkCancellation()

		let ext = (response as? HTTPURLResponse)?.suggestedFilename.flatMap {
			URL(fileURLWithPath: $0).pathExtension
		} ?? "audio"
		let dest = cacheDir.appendingPathComponent("\(trackId).\(ext)")

		try? FileManager.default.removeItem(at: dest)
		try FileManager.default.moveItem(at: tempURL, to: dest)

		let size = (try? FileManager.default.attributesOfItem(atPath: dest.path)[.size] as? Int) ?? 0
		let elapsed = Int(Date().timeIntervalSince(start) * 1000)
		print("YhwavAudio: cache download complete trackId=\(trackId) size=\(size) elapsed=\(elapsed)ms")

		queue.sync {
			cachedFiles[trackId] = dest
			activeDownloads.removeValue(forKey: trackId)
		}

		return dest
	}
}
