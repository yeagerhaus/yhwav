import AVFoundation
import Accelerate
import ExpoModulesCore
import MediaPlayer
import UIKit

// MARK: - Records (JS → Swift)

struct SetupOptions: Record {
	@Field var iosCategory: String?
	@Field var iosCategoryMode: String?
	@Field var minBuffer: Double?
	@Field var maxBuffer: Double?
	@Field var playBuffer: Double?
	@Field var waitForBuffer: Bool?
	@Field var autoHandleInterruptions: Bool?
}

struct TrackRecord: Record {
	@Field var id: String
	@Field var url: String
	@Field var title: String?
	@Field var artist: String?
	@Field var album: String?
	@Field var artwork: String?
	@Field var duration: Double?
	/// Original Plex `/library/parts/...` URL when `url` is a transcode URL (used if transcode file is truncated).
	@Field var directUrl: String?
	/// When true, transition to this track uses gapless scheduling (e.g. podcasts) even if Sweet Fades is on.
	@Field var crossfadeDisabled: Bool?
	/// Per-track loudness gain in dB (ReplayGain), applied when normalization is enabled.
	@Field var gainDb: Double?
}

struct CrossfadeConfigRecord: Record {
	@Field var enabled: Bool = false
	@Field var defaultDuration: Double = 4.0
	@Field var minDuration: Double = 1.0
	@Field var maxDuration: Double = 8.0
	@Field var fadeInOnManualSkip: Bool = true
	@Field var manualSkipFadeDuration: Double = 0.5
	/// Crossfade volume curve: 0 equal-power, 1 linear, 2 logarithmic, 3 S-curve.
	@Field var curve: Int = 0
	/// Sweep a lowpass on the outgoing deck during the crossfade tail.
	@Field var lowpassTail: Bool = true
}

struct PlaybackStateRecord: Record {
	@Field var state: String = "stopped"
	@Field var position: Double = 0
	@Field var duration: Double = 0
	@Field var buffered: Double?
}

// AudioDSPState lives in AudioDSPState.swift.

// MARK: - Module

public final class YhwavAudioModule: Module {
	fileprivate var enginePlayer: AudioEnginePlayer?
	fileprivate var podcastPlayer: PodcastPlayer?
	/// When true, playback control routes to `podcastPlayer` (AVPlayer) instead of `enginePlayer`.
	private var usingPodcastBackend = false
	private var fileCache: AudioFileCache?
	private var trackMetadata: [String: TrackRecord] = [:]
	private var trackOrder: [String] = []
	/// Index of the active track in `trackOrder`, maintained across queue edits (main thread). Avoids
	/// O(n) `firstIndex(of:)` scans per tick and resolves duplicate track ids to the right occurrence.
	private var activeIndex: Int = -1
	private var progressTimer: Timer?
	private var progressUpdateInterval: TimeInterval = 0.5
	private var repeatMode: Int = 2 // 0=Off, 1=Track, 2=Queue
	private var isInitialized = false
	private var lastTrackEndTimestamp: Double = 0
	private var lastPlaybackErrorEmitTime: Double = 0
	private var lastEmittedTrackIndex: Int = -1
	private var lastEmittedTrackTime: Double = 0
	private var lastEmittedState: String = "stopped"
	private var suppressTrackChangeEvents = false
	private var crossfadeUserEnabled = false
	private var fadeInOnManualSkip = true
	private var manualSkipFadeSeconds: Double = 0.5
	/// After a paused restore, iOS sometimes delivers a spurious remote "play" (e.g. on route activation).
	/// Ignore remote play commands until this time (ms since epoch).
	fileprivate var remotePlaySuppressedUntil: Double = 0
	/// JS has at least one `AudioLevelsUpdated` listener.
	private var levelObserversActive = false
	private var appIsActive = true
	private var lifecycleObservers: [NSObjectProtocol] = []
	/// Next track id whose idle-deck preload / gapless schedule is currently in flight (main-thread only).
	private var preparingNextTrackId: String?

	private lazy var nowPlayingManager = NowPlayingManager(module: self)

	// MARK: - Search index
	private struct SearchEntry {
		let id: String
		let titleLower: String
		let artistLower: String
		let albumLower: String
	}
	private var searchIndex: [SearchEntry] = []
	/// Epoch of the applied index (guarded by searchQueue); stale out-of-order builds are dropped.
	private var searchIndexEpoch: Int = -1
	private let searchQueue = DispatchQueue(label: "com.yhwav.search", qos: .userInitiated)

	public func definition() -> ModuleDefinition {
		Name("YhwavAudio")

		Events(
			"PlaybackProgressUpdated",
			"PlaybackQueueEnded",
			"PlaybackActiveTrackChanged",
			"PlaybackError",
			"RemotePlay",
			"RemotePause",
			"RemoteNext",
			"RemotePrevious",
			"RemoteSeek",
			"AudioLevelsUpdated",
			"PlaybackStateChanged"
		)

		OnCreate {
			// Pause level metering while backgrounded (nothing is visible to animate).
			let center = NotificationCenter.default
			let session = AVAudioSession.sharedInstance()
			self.lifecycleObservers = [
				center.addObserver(forName: AVAudioSession.interruptionNotification, object: session, queue: .main) { [weak self] note in
					self?.handleInterruption(note)
				},
				center.addObserver(forName: AVAudioSession.routeChangeNotification, object: session, queue: .main) { [weak self] note in
					self?.handleRouteChange(note)
				},
				center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: .main) { [weak self] _ in
					self?.rebuildAfterMediaServicesReset()
				},
				center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
					self?.appIsActive = false
					self?.applyLevelMetering()
				},
				center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
					self?.appIsActive = true
					self?.applyLevelMetering()
				},
			]
		}

		OnDestroy {
			for observer in self.lifecycleObservers { NotificationCenter.default.removeObserver(observer) }
			self.lifecycleObservers = []
		}

		OnStartObserving("AudioLevelsUpdated") {
			DispatchQueue.main.async {
				self.levelObserversActive = true
				self.applyLevelMetering()
			}
		}

		OnStopObserving("AudioLevelsUpdated") {
			DispatchQueue.main.async {
				self.levelObserversActive = false
				self.applyLevelMetering()
			}
		}

		AsyncFunction("setupPlayer") { (options: SetupOptions?) in
			guard !self.isInitialized else { return }
			self.configureAudioSession()
			let cache = AudioFileCache()
			self.fileCache = cache
			let player = AudioEnginePlayer(fileCache: cache)
			player.delegate = self
			player.setup()
			player.crossfadeEnabled = self.crossfadeUserEnabled
			self.enginePlayer = player
			DispatchQueue.main.async { self.applyLevelMetering() }
			let podcast = PodcastPlayer()
			podcast.delegate = self
			self.podcastPlayer = podcast
			self.nowPlayingManager.setupRemoteCommands()
			self.isInitialized = true
		}

		AsyncFunction("updateOptions") { (options: [String: Any]?) in
			if let interval = options?["progressUpdateEventInterval"] as? Double, interval > 0 {
				self.progressUpdateInterval = interval
			}
			if let caps = options?["capabilities"] as? [String] {
				self.nowPlayingManager.setCapabilities(caps)
			}
		}

		AsyncFunction("add") { (tracks: [TrackRecord], insertAfterIndex: Int?) in
			guard self.enginePlayer != nil else { return }
			let afterIdx = insertAfterIndex ?? (self.trackOrder.isEmpty ? -1 : self.trackOrder.count - 1)
			let wasEmpty = self.trackOrder.isEmpty
			yhLog("YhwavAudio: add \(tracks.count) tracks (wasEmpty=\(wasEmpty), afterIdx=\(afterIdx))")

			for track in tracks {
				self.trackMetadata[track.id] = track
			}
			if self.trackOrder.isEmpty {
				self.trackOrder = tracks.map(\.id)
			} else if let explicit = insertAfterIndex, explicit < 0 {
				// Explicit "insert after -1" = insert at the front (omitted index = append).
				self.trackOrder = tracks.map(\.id) + self.trackOrder
				if self.activeIndex >= 0 { self.activeIndex += tracks.count }
			} else if afterIdx < 0 {
				self.trackOrder.append(contentsOf: tracks.map(\.id))
			} else {
				let head = Array(self.trackOrder.prefix(afterIdx + 1))
				let tail = Array(self.trackOrder.dropFirst(afterIdx + 1))
				self.trackOrder = head + tracks.map(\.id) + tail
				if self.activeIndex > afterIdx { self.activeIndex += tracks.count }
			}

			self.predownloadNext()
		}.runOnQueue(.main)

		AsyncFunction("reset") {
			yhLog("YhwavAudio: reset (had \(self.trackOrder.count) tracks)")
			self.stopProgressTimer()
			self.enginePlayer?.clearScheduled()
			self.podcastPlayer?.stop()
			self.usingPodcastBackend = false
			self.trackMetadata.removeAll()
			self.trackOrder.removeAll()
			self.activeIndex = -1
			self.lastTrackEndTimestamp = 0
			self.lastPlaybackErrorEmitTime = 0
			self.lastEmittedTrackIndex = -1
			self.lastEmittedTrackTime = 0
			self.emitStateIfChanged("stopped")
			// Keep cached files (an LRU cap bounds them) so replaying an album doesn't re-download it;
			// only stop in-flight prefetches for the old queue.
			self.fileCache?.cancelDownloads(exceptTrackIds: [])
			AudioDSPState.shared.resetFilterState()
		}.runOnQueue(.main)

		AsyncFunction("remove") { (indices: [Int]) in
			guard self.enginePlayer != nil else { return }
			for idx in indices.sorted(by: >) where idx >= 0 && idx < self.trackOrder.count {
				let id = self.trackOrder[idx]
				self.trackOrder.remove(at: idx)
				// Only drop metadata if no other occurrence of this id remains in the queue.
				if !self.trackOrder.contains(id) { self.trackMetadata.removeValue(forKey: id) }
				if idx < self.activeIndex { self.activeIndex -= 1 } else if idx == self.activeIndex { self.activeIndex = -1 }
			}
			self.rescheduleNextIfNeeded()
		}.runOnQueue(.main)

		AsyncFunction("removeUpcomingTracks") {
			guard self.enginePlayer != nil else { return }
			let currentIdx = self.currentActiveTrackIndex()
			guard currentIdx >= 0 else { return }

			let idsToRemove = Array(self.trackOrder.dropFirst(currentIdx + 1))
			for id in idsToRemove {
				self.trackMetadata.removeValue(forKey: id)
			}
			self.trackOrder = Array(self.trackOrder.prefix(currentIdx + 1))
			// Nothing comes next any more: drop a preloaded (crossfade) or chained (gapless) next track.
			self.enginePlayer?.invalidatePreparedNext(unless: nil)
		}.runOnQueue(.main)

		AsyncFunction("move") { (fromIndex: Int, toIndex: Int) in
			guard fromIndex != toIndex,
			      fromIndex >= 0, toIndex >= 0,
			      fromIndex < self.trackOrder.count, toIndex < self.trackOrder.count
			else { return }
			let id = self.trackOrder.remove(at: fromIndex)
			self.trackOrder.insert(id, at: toIndex)
			let cur = self.activeIndex
			if cur == fromIndex { self.activeIndex = toIndex }
			else if fromIndex < cur && toIndex >= cur { self.activeIndex = cur - 1 }
			else if fromIndex > cur && toIndex <= cur { self.activeIndex = cur + 1 }
			self.rescheduleNextIfNeeded()
		}.runOnQueue(.main)

		AsyncFunction("skip") { (index: Int, startPaused: Bool?, startAtSeconds: Double?) in
			guard self.enginePlayer != nil, index >= 0, index < self.trackOrder.count else { return }
			let currentIdx = self.currentActiveTrackIndex()
			let targetId = self.trackOrder[index]
			let paused = startPaused ?? false
			let startAt = (startAtSeconds ?? 0) > 0 ? startAtSeconds : nil
			yhLog("YhwavAudio: skip idx=\(currentIdx)→\(index) (trackId=\(targetId)), queueSize=\(self.trackOrder.count) paused=\(paused)")

			guard let track = self.trackMetadata[targetId],
				  let url = URL(string: track.url) else { return }

			// Podcasts stream through the lightweight AVPlayer backend (instant seek, no full download).
			// Set the routing flag synchronously so a `seekTo` issued right after `skip` (podcast resume)
			// routes to the podcast backend before the async work below runs.
			if track.crossfadeDisabled == true {
				self.usingPodcastBackend = true
				self.enginePlayer?.clearScheduled()
				self.podcastPlayer?.play(url: url, trackId: targetId, startAt: startAt, startPaused: paused)
				self.emitActiveTrackChanged(index: index)
				self.startProgressTimerIfNeeded()
				return
			}

			// Music: engine backend. Leave the podcast backend if we were on it.
			guard let engine = self.enginePlayer else { return }
			if self.usingPodcastBackend {
				self.podcastPlayer?.stop()
				self.usingPodcastBackend = false
			}

			var keepPrefetch: Set<String> = [targetId]
			if index + 1 < self.trackOrder.count {
				keepPrefetch.insert(self.trackOrder[index + 1])
			}
			self.fileCache?.cancelDownloads(exceptTrackIds: keepPrefetch)

			// Manually selecting a track always plays at full volume immediately — no fade-in. Only natural
			// end-of-track advancement crossfades (a separate path inside the engine).
			Task { @MainActor in
				do {
					try await engine.play(
						url: url,
						trackId: targetId,
						expectedDurationSeconds: self.expectedDurationSeconds(for: track),
						fallbackURL: self.fallbackDirectURL(for: track),
						startPaused: paused,
						startAtSeconds: startAt
					)
					self.emitActiveTrackChanged(index: index)
					if paused {
						// Loaded but not playing (restore): don't run the progress timer.
						self.remotePlaySuppressedUntil = Date().timeIntervalSince1970 * 1000 + 3000
						self.syncNowPlaying()
					} else {
						self.startProgressTimerIfNeeded()
					}
					self.scheduleNextTrack(afterIndex: index)
				} catch is CancellationError {
					// Superseded by a newer skip: the newer call owns the track-change event.
					yhLog("YhwavAudio: skip to idx=\(index) superseded")
				} catch {
					yhLog("YhwavAudio: skip failed: \(error.localizedDescription)")
					self.sendEvent("PlaybackError", ["error": error.localizedDescription, "trackId": targetId])
				}
			}
		}.runOnQueue(.main)

		AsyncFunction("play") {
			self.remotePlaySuppressedUntil = 0
			self.performPlayAndSync()
		}.runOnQueue(.main)

		AsyncFunction("pause") {
			self.performPauseAndSync()
		}.runOnQueue(.main)

		AsyncFunction("seekTo") { (position: Double) in
			self.performSeekAndSync(position)
		}.runOnQueue(.main)

		AsyncFunction("setVolume") { (value: Float) in
			let v = max(0, min(1, value))
			self.enginePlayer?.volume = v
			self.podcastPlayer?.setVolume(v)
		}.runOnQueue(.main)

		AsyncFunction("setRate") { (value: Float) in
			let v = max(0.5, min(2.0, value))
			if self.usingPodcastBackend {
				self.podcastPlayer?.setRate(v)
			} else {
				self.enginePlayer?.rate = v
			}
			self.syncNowPlaying()
		}.runOnQueue(.main)

		AsyncFunction("setRepeatMode") { (mode: Int) in
			self.repeatMode = mode
		}.runOnQueue(.main)

		// MARK: - DSP control APIs

		AsyncFunction("setEqualizerBands") { (_ bands: [[String: Any]]) in
			let parsed: [(frequency: Float, gain: Float)] = bands.compactMap { dict in
				guard let freq = (dict["frequency"] as? NSNumber)?.floatValue,
				      let gain = (dict["gain"] as? NSNumber)?.floatValue else { return nil }
				return (frequency: freq, gain: max(-12, min(12, gain)))
			}
			let sr = Float(AVAudioSession.sharedInstance().sampleRate)
			AudioDSPState.shared.setEqualizerBands(parsed, sampleRate: sr > 0 ? sr : 44100)
		}

		AsyncFunction("setEqualizerEnabled") { (enabled: Bool) in
			AudioDSPState.shared.setEqEnabled(enabled)
		}

		AsyncFunction("setOutputGain") { (gainDb: Float) in
			AudioDSPState.shared.setOutputGainDb(max(-10, min(10, gainDb)))
		}

		AsyncFunction("setNormalizationEnabled") { (enabled: Bool) in
			AudioDSPState.shared.setNormalizationEnabled(enabled)
		}

		AsyncFunction("setMonoAudioEnabled") { (enabled: Bool) in
			AudioDSPState.shared.setMonoEnabled(enabled)
		}

		AsyncFunction("setCrossfadeConfig") { (config: CrossfadeConfigRecord) in
			self.crossfadeUserEnabled = config.enabled
			self.enginePlayer?.crossfadeEnabled = config.enabled
			if config.defaultDuration > 0 {
				self.enginePlayer?.nextCrossfadeDuration = config.defaultDuration
			}
			self.enginePlayer?.crossfadeCurve = AudioEnginePlayer.CrossfadeCurve(rawValue: config.curve) ?? .equalPower
			self.enginePlayer?.crossfadeLowpassTailEnabled = config.lowpassTail
			self.fadeInOnManualSkip = config.fadeInOnManualSkip
			self.manualSkipFadeSeconds = max(0, min(3.0, config.manualSkipFadeDuration))
			self.enginePlayer?.fadeInOnManualSkip = config.fadeInOnManualSkip
			self.enginePlayer?.manualSkipFadeDuration = self.manualSkipFadeSeconds
		}.runOnQueue(.main)

		AsyncFunction("setNextCrossfadeDuration") { (seconds: Double) in
			let clamped = max(0.1, min(30.0, seconds))
			self.enginePlayer?.nextCrossfadeDuration = clamped
		}.runOnQueue(.main)

		AsyncFunction("setNextCrossfadeTrim") { (trim: Double) in
			self.enginePlayer?.nextIncomingTrim = Float(max(0.1, min(4.0, trim)))
		}.runOnQueue(.main)

		// State reads run on the main queue as async functions. Synchronous getters that hop with
		// `DispatchQueue.main.sync` block the JS thread and can deadlock if main waits on JS. Ongoing state
		// is pushed to JS via the `PlaybackStateChanged` event instead of being polled.
		AsyncFunction("getPlaybackState") { () -> PlaybackStateRecord in
			var record = PlaybackStateRecord()
			let (state, position, duration) = self.currentPlaybackState()
			record.state = state
			record.position = position
			record.duration = duration
			record.buffered = nil
			return record
		}.runOnQueue(.main)

		AsyncFunction("getActiveTrackIndex") { () -> Int in
			return self.currentActiveTrackIndex()
		}.runOnQueue(.main)

		AsyncFunction("getQueue") { () -> [TrackRecord] in
			return self.trackOrder.compactMap { id in self.trackMetadata[id] }
		}.runOnQueue(.main)

		// MARK: - Search

		AsyncFunction("prewarmURL") { (urlString: String, trackId: String) in
			guard let url = URL(string: urlString) else { return }
			self.fileCache?.predownload(url: url, trackId: trackId)
		}

		// MARK: - Waveform

		AsyncFunction("computeWaveform") { (urlString: String, buckets: Int) -> [Float] in
			let url: URL
			if urlString.hasPrefix("/") {
				url = URL(fileURLWithPath: urlString)
			} else if let parsed = URL(string: urlString) {
				url = parsed
			} else {
				throw NSError(domain: "YhwavAudio", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid waveform URL"])
			}
			guard let peaks = WaveformExtractor.extractPeaks(url: url, buckets: max(1, buckets)) else {
				throw NSError(domain: "YhwavAudio", code: -2, userInfo: [NSLocalizedDescriptionKey: "Failed to read audio for waveform"])
			}
			return peaks
		}

		// MARK: - Files

		/// Drops every cached/streamed audio file (e.g. on logout).
		AsyncFunction("clearAudioCache") {
			self.fileCache?.clearAll()
		}.runOnQueue(.main)

		/// Marks a file or directory as excluded from iCloud/iTunes backup (re-downloadable media).
		AsyncFunction("excludeFromBackup") { (pathOrUri: String) in
			var url: URL
			if pathOrUri.hasPrefix("file://"), let parsed = URL(string: pathOrUri) {
				url = parsed
			} else {
				url = URL(fileURLWithPath: pathOrUri)
			}
			var values = URLResourceValues()
			values.isExcludedFromBackup = true
			try url.setResourceValues(values)
		}

		// MARK: - Search

		AsyncFunction("buildSearchIndex") { (tracks: [[String: Any]], epoch: Int?) in
			let entries: [SearchEntry] = tracks.compactMap { dict in
				guard let id = dict["id"] as? String else { return nil }
				let title = (dict["title"] as? String ?? "").lowercased()
				let artist = (dict["artist"] as? String ?? "").lowercased()
				let album = (dict["album"] as? String ?? "").lowercased()
				return SearchEntry(id: id, titleLower: title, artistLower: artist, albumLower: album)
			}
			self.searchQueue.sync {
				let incoming = epoch ?? (self.searchIndexEpoch + 1)
				guard incoming >= self.searchIndexEpoch else { return }
				self.searchIndexEpoch = incoming
				self.searchIndex = entries
			}
		}

		AsyncFunction("searchTracks") { (query: String, limit: Int) -> [[String: Any]] in
			let q = query.lowercased().trimmingCharacters(in: .whitespaces)
			guard !q.isEmpty else { return [] }

			var hits: [(id: String, score: Int)] = []

			self.searchQueue.sync {
				for entry in self.searchIndex {
					let titleHit = entry.titleLower.contains(q)
					let artistHit = entry.artistLower.contains(q)
					let albumHit = entry.albumLower.contains(q)
					guard titleHit || artistHit || albumHit else { continue }

					var score = 0
					if entry.titleLower.hasPrefix(q) { score += 100 }
					else if titleHit { score += 50 }
					if entry.artistLower.hasPrefix(q) { score += 80 }
					else if artistHit { score += 40 }
					if entry.albumLower.hasPrefix(q) { score += 60 }
					else if albumHit { score += 30 }

					// Score every entry (no early exit): stopping after N hits in library order missed the
					// best prefix matches for common queries.
					hits.append((id: entry.id, score: score))
				}
			}

			hits.sort { $0.score > $1.score }
			return Array(hits.prefix(limit)).map { ["id": $0.id, "score": $0.score] }
		}
	}

	// MARK: - Track playback helpers

	/// JS sends Plex `duration` in milliseconds.
	private func expectedDurationSeconds(for track: TrackRecord) -> Double? {
		guard let d = track.duration, d > 0 else { return nil }
		return d / 1000.0
	}

	private func fallbackDirectURL(for track: TrackRecord) -> URL? {
		guard let s = track.directUrl, !s.isEmpty, s != track.url, let u = URL(string: s) else { return nil }
		return u
	}

	// MARK: - Audio session

	private func configureAudioSession() {
		do {
			try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
			try AVAudioSession.sharedInstance().setActive(true)
		} catch {
			yhLog("YhwavAudio: Failed to set audio session: \(error)")
		}
	}

	// MARK: - Scheduling helpers

	private func scheduleNextTrack(afterIndex idx: Int) {
		guard !usingPodcastBackend else { return }
		guard let engine = enginePlayer else { return }
		let nextIdx = idx + 1
		guard nextIdx < trackOrder.count else { return }
		let nextId = trackOrder[nextIdx]
		guard let track = trackMetadata[nextId],
			  let url = URL(string: track.url) else { return }

		let forceGapless = track.crossfadeDisabled == true
		let directURL = fallbackDirectURL(for: track)

		// Crossfade/gapless preloads the next track onto the IDLE deck as a complete AVAudioFile. The idle
		// deck is free even while the current track streams, so we can crossfade from a streamed track into
		// a cached one. The next track must be a local file (downloaded) or already in the native cache; if
		// it isn't yet, pull the reliable DIRECT original into cache and let a later tick do the preload.
		let isLocal = url.isFileURL
		let isCached = fileCache?.hasCached(trackId: nextId) ?? false

		if isLocal || isCached {
			// This runs every progress tick until prepared, so avoid launching a second load while a
			// previous one for the same track is still in flight (which could double-schedule).
			if preparingNextTrackId == nextId { return }
			preparingNextTrackId = nextId
			// For a cached remote track, pass the direct URL so loadAudioFile resolves the cached file
			// (keyed by trackId) instead of re-fetching the flaky transcode.
			let preloadURL = isLocal ? url : (directURL ?? url)
			Task {
				defer { DispatchQueue.main.async { if self.preparingNextTrackId == nextId { self.preparingNextTrackId = nil } } }
				do {
					try await engine.scheduleNext(
						url: preloadURL,
						trackId: nextId,
						expectedDurationSeconds: self.expectedDurationSeconds(for: track),
						fallbackURL: directURL,
						forceGapless: forceGapless
					)
				} catch {
					yhLog("YhwavAudio: failed to schedule next: \(error)")
				}
			}
		} else {
			fileCache?.predownload(url: directURL ?? url, trackId: nextId)
		}

		predownloadAhead(fromIndex: nextIdx + 1)
	}

	private func predownloadNext() {
		guard !usingPodcastBackend else { return }
		guard let engine = enginePlayer, engine.currentTrackId != nil else { return }
		let currentIdx = currentActiveTrackIndex()
		guard currentIdx >= 0 else { return }
		let nextIdx = currentIdx + 1
		guard nextIdx < trackOrder.count else { return }
		let nextId = trackOrder[nextIdx]
		guard let track = trackMetadata[nextId],
			  let url = URL(string: track.url) else { return }
		fileCache?.predownload(url: url, trackId: nextId)
	}

	private func predownloadAhead(fromIndex startIdx: Int, count: Int = 2) {
		for i in 0..<count {
			let idx = startIdx + i
			guard idx < trackOrder.count else { return }
			let id = trackOrder[idx]
			guard let track = trackMetadata[id] else { continue }
			// Prefer the direct original (static Content-Length, range support) over the transcode for
			// cached copies that gapless/crossfade will replay off disk.
			guard let url = fallbackDirectURL(for: track) ?? URL(string: track.url) else { continue }
			fileCache?.predownload(url: url, trackId: id)
		}
	}

	private func rescheduleNextIfNeeded() {
		let currentIdx = currentActiveTrackIndex()
		guard currentIdx >= 0 else { return }
		enginePlayer?.invalidatePreparedNext(unless: expectedNextTrackId(afterIndex: currentIdx))
		scheduleNextTrack(afterIndex: currentIdx)
	}

	/// The track that should play after `idx` (honoring repeat-queue wraparound only for the last track).
	private func expectedNextTrackId(afterIndex idx: Int) -> String? {
		let next = idx + 1
		return next < trackOrder.count ? trackOrder[next] : nil
	}

	/// Called every progress tick: the next track is preloaded (crossfade) / scheduled (gapless) as a
	/// complete local file, but that file may only finish downloading partway through the current track.
	/// scheduleNextTrack only runs once at track-start, so without this the deck is never prepared when
	/// the next file lands late — causing a hard cut/gap. Re-attempt until the correct next is prepared.
	private func ensureNextTrackPrepared() {
		guard !usingPodcastBackend, let engine = enginePlayer else { return }
		let currentIdx = currentActiveTrackIndex()
		guard currentIdx >= 0 else { return }
		let nextIdx = currentIdx + 1
		guard nextIdx < trackOrder.count else { return }
		if engine.preparedNextTrackId == trackOrder[nextIdx] { return }
		// A stale next (from before a queue edit) must be dropped before preparing the right one, or a
		// gapless chain would end up with both scheduled.
		engine.invalidatePreparedNext(unless: trackOrder[nextIdx])
		scheduleNextTrack(afterIndex: currentIdx)
	}

	// MARK: - Track index

	/// Track id from whichever backend (engine or podcast) is currently active.
	private var activeCurrentTrackId: String? {
		usingPodcastBackend ? podcastPlayer?.currentTrackId : enginePlayer?.currentTrackId
	}

	/// Play/position/duration from whichever backend is currently active.
	private func activePlaybackTiming() -> (isPlaying: Bool, position: Double, duration: Double, hasTrack: Bool) {
		if usingPodcastBackend {
			guard let pod = podcastPlayer, pod.currentTrackId != nil else { return (false, 0, 0, false) }
			return (pod.isPlaying, pod.currentPosition, pod.currentDuration, true)
		}
		guard let engine = enginePlayer, engine.currentTrackId != nil else { return (false, 0, 0, false) }
		return (engine.isPlaying, engine.currentPosition, engine.currentDuration, true)
	}

	/// Playback rate of the active backend (for Now Playing).
	fileprivate func currentPlaybackRate() -> Double {
		usingPodcastBackend ? Double(podcastPlayer?.rate ?? 1.0) : Double(enginePlayer?.rate ?? 1.0)
	}

	fileprivate func currentActiveTrackIndex() -> Int {
		guard let trackId = activeCurrentTrackId else { return -1 }
		if activeIndex >= 0, activeIndex < trackOrder.count, trackOrder[activeIndex] == trackId {
			return activeIndex
		}
		let idx = trackOrder.firstIndex(of: trackId) ?? -1
		activeIndex = idx
		return idx
	}

	/// Index of a track that just finished: the tracked active index if it matches, else an id lookup.
	private func indexOfFinishedTrack(_ trackId: String) -> Int? {
		if activeIndex >= 0, activeIndex < trackOrder.count, trackOrder[activeIndex] == trackId { return activeIndex }
		return trackOrder.firstIndex(of: trackId)
	}

	// MARK: - Track change events

	private func emitActiveTrackChanged(index: Int) {
		activeIndex = index
		let now = Date().timeIntervalSince1970 * 1000
		if index == lastEmittedTrackIndex && (now - lastEmittedTrackTime) < 300 {
			return
		}
		lastEmittedTrackIndex = index
		lastEmittedTrackTime = now

		// Loudness normalization follows the active track.
		let activeTrackId = index >= 0 && index < trackOrder.count ? trackOrder[index] : nil
		AudioDSPState.shared.setTrackGainDb(activeTrackId.flatMap { trackMetadata[$0]?.gainDb }.map(Float.init))

		// Never evict the playing track or the one queued next from the file cache.
		var pinned: Set<String> = []
		if index >= 0, index < trackOrder.count { pinned.insert(trackOrder[index]) }
		if index + 1 < trackOrder.count { pinned.insert(trackOrder[index + 1]) }
		fileCache?.setPinnedTrackIds(pinned)

		let trackId = (index >= 0 && index < trackOrder.count) ? trackOrder[index] : "?"
		yhLog("YhwavAudio: emitActiveTrackChanged idx=\(index) trackId=\(trackId)")
		var payload: [String: Any] = ["index": index]
		if lastTrackEndTimestamp > 0 {
			payload["previousTrackEndedAt"] = lastTrackEndTimestamp
		}
		sendEvent("PlaybackActiveTrackChanged", payload)
		syncNowPlaying()
	}

	// MARK: - Progress timer

	private func startProgressTimerIfNeeded() {
		guard progressTimer == nil else { return }
		guard Thread.isMainThread else {
			DispatchQueue.main.async { self.startProgressTimerIfNeeded() }
			return
		}
		progressTimer = Timer(timeInterval: progressUpdateInterval, repeats: true) { [weak self] _ in
			self?.emitProgressUpdate()
		}
		RunLoop.main.add(progressTimer!, forMode: .common)
	}

	private func stopProgressTimer() {
		progressTimer?.invalidate()
		progressTimer = nil
	}

	private func emitProgressUpdate() {
		if !usingPodcastBackend {
			self.ensureNextTrackPrepared()
			self.enginePlayer?.tickCrossfadeIfNeeded()
		}
		let (state, position, duration) = currentPlaybackState()
		emitStateIfChanged(state)
		let idx = currentActiveTrackIndex()
		sendEvent("PlaybackProgressUpdated", [
			"position": position,
			"duration": duration,
			"track": idx,
			"index": idx,
			"state": state
		])
	}

	// MARK: - Audio session events (main thread)

	private var wasPlayingBeforeInterruption = false

	/// Phone calls, Siri, other apps: pause whichever backend is active and keep JS / Now Playing in sync;
	/// resume afterwards only if we were playing and the system says we should.
	private func handleInterruption(_ note: Notification) {
		guard let info = note.userInfo,
			  let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
			  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
		switch type {
		case .began:
			wasPlayingBeforeInterruption = currentPlaybackState().state == "playing"
			yhLog("YhwavAudio: interruption began (wasPlaying=\(wasPlayingBeforeInterruption))")
			performPauseAndSync()
		case .ended:
			let opts = (info[AVAudioSessionInterruptionOptionKey] as? UInt).map(AVAudioSession.InterruptionOptions.init) ?? []
			yhLog("YhwavAudio: interruption ended shouldResume=\(opts.contains(.shouldResume))")
			if wasPlayingBeforeInterruption && opts.contains(.shouldResume) {
				try? AVAudioSession.sharedInstance().setActive(true)
				performPlayAndSync()
			}
			wasPlayingBeforeInterruption = false
		@unknown default:
			break
		}
	}

	/// Headphones unplugged / Bluetooth gone: pause (both backends) and update JS + lock screen.
	private func handleRouteChange(_ note: Notification) {
		guard let info = note.userInfo,
			  let reasonValue = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
			  let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }
		yhLog("YhwavAudio: route changed reason=\(reason.rawValue)")
		if reason == .oldDeviceUnavailable {
			performPauseAndSync()
		}
	}

	/// After `mediaServicesWereReset` every audio object is invalid: rebuild the engine and session, then
	/// re-prepare the current track at the same position (playing again only if it was playing).
	private func rebuildAfterMediaServicesReset() {
		yhLog("YhwavAudio: media services were reset — rebuilding engine")
		let idx = currentActiveTrackIndex()
		let (state, position, _) = currentPlaybackState()
		let wasPlaying = state == "playing"
		stopProgressTimer()
		configureAudioSession()

		let old = enginePlayer
		let volume = old?.volume ?? 1.0
		let rate = old?.rate ?? 1.0
		let nextDuration = old?.nextCrossfadeDuration ?? 4.0
		let curve = old?.crossfadeCurve ?? .equalPower
		let lowpass = old?.crossfadeLowpassTailEnabled ?? true
		old?.teardown()
		enginePlayer = nil
		nowPlayingManager.setupRemoteCommands()

		guard let cache = fileCache else { return }
		// AudioEnginePlayer.setup() waits on AU instantiation; keep that off the main thread.
		DispatchQueue.global(qos: .userInitiated).async {
			let player = AudioEnginePlayer(fileCache: cache)
			player.setup()
			DispatchQueue.main.async {
				player.delegate = self
				player.crossfadeEnabled = self.crossfadeUserEnabled
				player.nextCrossfadeDuration = nextDuration
				player.crossfadeCurve = curve
				player.crossfadeLowpassTailEnabled = lowpass
				player.fadeInOnManualSkip = self.fadeInOnManualSkip
				player.manualSkipFadeDuration = self.manualSkipFadeSeconds
				player.volume = volume
				player.rate = rate
				self.enginePlayer = player
				self.applyLevelMetering()
				self.restoreAfterReset(index: idx, position: position, wasPlaying: wasPlaying)
			}
		}
	}

	private func restoreAfterReset(index idx: Int, position: Double, wasPlaying: Bool) {
		guard idx >= 0, idx < trackOrder.count, let track = trackMetadata[trackOrder[idx]], let url = URL(string: track.url) else {
			emitStateIfChanged()
			return
		}
		let startAt = position > 0 ? position : nil
		if usingPodcastBackend {
			podcastPlayer?.stop()
			podcastPlayer?.play(url: url, trackId: track.id, startAt: startAt, startPaused: !wasPlaying)
			if wasPlaying { startProgressTimerIfNeeded() }
			syncNowPlaying()
			emitStateIfChanged()
			return
		}
		guard let engine = enginePlayer else { return }
		Task { @MainActor in
			do {
				try await engine.play(
					url: url,
					trackId: track.id,
					expectedDurationSeconds: self.expectedDurationSeconds(for: track),
					fallbackURL: self.fallbackDirectURL(for: track),
					startPaused: !wasPlaying,
					startAtSeconds: startAt
				)
				if wasPlaying { self.startProgressTimerIfNeeded() }
				self.scheduleNextTrack(afterIndex: idx)
				self.syncNowPlaying()
				self.emitStateIfChanged()
			} catch {
				self.sendEvent("PlaybackError", ["error": error.localizedDescription, "trackId": track.id])
			}
		}
	}

	/// Level metering runs only while a JS visualizer listens and the app is foregrounded (main thread).
	private func applyLevelMetering() {
		enginePlayer?.setLevelMeteringEnabled(levelObserversActive && appIsActive)
	}

	/// Push the transport state to JS whenever it changes (play/pause/stop), so JS never has to poll.
	private func emitStateIfChanged(_ state: String? = nil) {
		let current = state ?? currentPlaybackState().state
		guard current != lastEmittedState else { return }
		lastEmittedState = current
		sendEvent("PlaybackStateChanged", ["state": current])
	}

	private func syncNowPlaying() {
		let (state, position, duration) = currentPlaybackState()
		let idx = currentActiveTrackIndex()
		let trackId = idx >= 0 && idx < trackOrder.count ? trackOrder[idx] : nil
		let track = trackId.flatMap { trackMetadata[$0] }
		nowPlayingManager.updateNowPlaying(track: track, position: position, duration: duration, isPlaying: state == "playing")
	}

	// MARK: - State

	private func currentPlaybackState() -> (state: String, position: Double, duration: Double) {
		let timing = activePlaybackTiming()
		guard timing.hasTrack else {
			return ("stopped", 0, 0)
		}
		let pos = timing.position
		var dur = timing.duration
		if !dur.isFinite || dur <= 0 {
			let idx = currentActiveTrackIndex()
			if idx >= 0, idx < trackOrder.count,
			   let meta = trackMetadata[trackOrder[idx]], let md = meta.duration, md > 0 {
				dur = md / 1000.0 // JS sends Plex duration in milliseconds
			}
		}
		let validPos = pos.isFinite && pos >= 0 ? pos : 0
		let validDur = dur.isFinite && dur >= 0 ? dur : 0

		return (timing.isPlaying ? "playing" : "paused", validPos, validDur)
	}

	// MARK: - Play / pause / seek (bridge + remote control)

	/// Same behavior as the JS `play` bridge: resume the active backend, run progress timer + Now Playing on the main thread.
	fileprivate func performPlayAndSync() {
		if usingPodcastBackend {
			DispatchQueue.main.async { self.podcastPlayer?.resume() }
		} else {
			enginePlayer?.resume()
		}
		DispatchQueue.main.async {
			self.startProgressTimerIfNeeded()
			self.emitProgressUpdate()
			self.syncNowPlaying()
		}
	}

	/// Same behavior as the JS `pause` bridge: stop audio immediately, then timer + Now Playing on main.
	fileprivate func performPauseAndSync() {
		if usingPodcastBackend {
			DispatchQueue.main.async { self.podcastPlayer?.pause() }
		} else {
			enginePlayer?.pause()
		}
		DispatchQueue.main.async {
			self.stopProgressTimer()
			self.emitProgressUpdate()
			self.syncNowPlaying()
		}
	}

	fileprivate func performSeekAndSync(_ position: Double) {
		if usingPodcastBackend {
			DispatchQueue.main.async { self.podcastPlayer?.seek(to: position) }
		} else {
			enginePlayer?.seek(to: position)
		}
		DispatchQueue.main.async {
			self.emitProgressUpdate()
			self.syncNowPlaying()
		}
	}

	deinit {
		stopProgressTimer()
		enginePlayer?.teardown()
		podcastPlayer?.stop()
	}
}

// MARK: - PodcastPlayerDelegate

extension YhwavAudioModule: PodcastPlayerDelegate {
	func podcastPlayer(_ player: PodcastPlayer, didFinishTrack trackId: String) {
		lastTrackEndTimestamp = Date().timeIntervalSince1970 * 1000

		guard let finishedIdx = indexOfFinishedTrack(trackId) else {
			stopProgressTimer()
			sendEvent("PlaybackQueueEnded", [:])
			emitStateIfChanged()
			return
		}

		// Explicit single-track repeat: replay the same episode from the start.
		if repeatMode == 1 {
			yhLog("YhwavAudio: podcast didFinish \(trackId) → repeat track")
			guard let track = trackMetadata[trackId], let url = URL(string: track.url) else { return }
			player.play(url: url, trackId: trackId, startAt: 0)
			emitActiveTrackChanged(index: finishedIdx)
			return
		}

		// Podcast queues are single-episode; a following track is uncommon. Either way, ending the
		// episode surfaces as queue-ended so JS marks progress complete and scrobbles.
		yhLog("YhwavAudio: podcast didFinish \(trackId) → queue ended")
		stopProgressTimer()
		sendEvent("PlaybackQueueEnded", [:])
		emitStateIfChanged()
	}

	func podcastPlayer(_ player: PodcastPlayer, didEncounterError error: String, trackId: String) {
		let now = Date().timeIntervalSince1970 * 1000
		guard now - lastPlaybackErrorEmitTime > 500 else { return }
		lastPlaybackErrorEmitTime = now
		yhLog("YhwavAudio: podcast didEncounterError trackId=\(trackId): \(error)")
		sendEvent("PlaybackError", ["error": error, "trackId": trackId])
	}
}

// MARK: - AudioEnginePlayerDelegate

extension YhwavAudioModule: AudioEnginePlayerDelegate {
	func enginePlayer(_ player: AudioEnginePlayer, didFinishTrack trackId: String) {
		lastTrackEndTimestamp = Date().timeIntervalSince1970 * 1000

		guard let finishedIdx = indexOfFinishedTrack(trackId) else { return }

		if repeatMode == 1 {
			yhLog("YhwavAudio: didFinishTrack \(trackId) → repeat track")
			guard let track = trackMetadata[trackId],
				  let url = URL(string: track.url) else { return }
			Task { @MainActor in
				do {
					try await player.play(
						url: url,
						trackId: trackId,
						expectedDurationSeconds: self.expectedDurationSeconds(for: track),
						fallbackURL: self.fallbackDirectURL(for: track)
					)
					self.emitActiveTrackChanged(index: finishedIdx)
					self.scheduleNextTrack(afterIndex: finishedIdx)
				} catch is CancellationError {
					return
				} catch {
					yhLog("YhwavAudio: repeat track failed: \(error.localizedDescription)")
					await MainActor.run {
						self.sendEvent("PlaybackError", ["error": error.localizedDescription, "trackId": trackId])
					}
				}
			}
			return
		}

		let nextIdx = finishedIdx + 1
		if nextIdx < trackOrder.count {
			let nextId = trackOrder[nextIdx]
			yhLog("YhwavAudio: didFinishTrack \(trackId) → advancing to idx=\(nextIdx) trackId=\(nextId)")

			if player.currentTrackId == nextId {
				emitActiveTrackChanged(index: nextIdx)
				scheduleNextTrack(afterIndex: nextIdx)
			} else {
				advanceToTrack(at: nextIdx, player: player)
			}
		} else if repeatMode == 2 && !trackOrder.isEmpty {
			yhLog("YhwavAudio: didFinishTrack \(trackId) → repeat queue from idx=0")
			advanceToTrack(at: 0, player: player)
		} else {
			yhLog("YhwavAudio: didFinishTrack \(trackId) → queue ended")
			stopProgressTimer()
			sendEvent("PlaybackQueueEnded", [:])
			emitStateIfChanged()
		}
	}

	/// Try to play the track at `startIdx`; on failure, walk forward trying subsequent tracks.
	private func advanceToTrack(at startIdx: Int, player: AudioEnginePlayer, attempt: Int = 0) {
		let maxSkips = min(3, trackOrder.count)
		let idx = startIdx + attempt
		guard idx < trackOrder.count, attempt < maxSkips else {
			yhLog("YhwavAudio: all advancement attempts failed")
			sendEvent("PlaybackError", ["error": "Failed to load tracks", "trackId": trackOrder[startIdx]])
			return
		}

		let targetId = trackOrder[idx]
		guard let track = trackMetadata[targetId],
			  let url = URL(string: track.url) else {
			advanceToTrack(at: startIdx, player: player, attempt: attempt + 1)
			return
		}

		Task { @MainActor in
			do {
				try await player.play(
					url: url,
					trackId: targetId,
					expectedDurationSeconds: self.expectedDurationSeconds(for: track),
					fallbackURL: self.fallbackDirectURL(for: track)
				)
				self.emitActiveTrackChanged(index: idx)
				self.scheduleNextTrack(afterIndex: idx)
			} catch is CancellationError {
				// A user skip superseded this auto-advance; don't walk further down the queue.
				return
			} catch {
				yhLog("YhwavAudio: advance to idx=\(idx) trackId=\(targetId) failed: \(error.localizedDescription)")
				await MainActor.run {
					self.advanceToTrack(at: startIdx, player: player, attempt: attempt + 1)
				}
			}
		}
	}

	func enginePlayer(_ player: AudioEnginePlayer, didEncounterError error: String, trackId: String) {
		let now = Date().timeIntervalSince1970 * 1000
		guard now - lastPlaybackErrorEmitTime > 500 else { return }
		lastPlaybackErrorEmitTime = now
		yhLog("YhwavAudio: didEncounterError trackId=\(trackId): \(error)")
		sendEvent("PlaybackError", [
			"error": error,
			"trackId": trackId
		])
	}

	func enginePlayer(_ player: AudioEnginePlayer, didUpdateLevels levels: [Float]) {
		sendEvent("AudioLevelsUpdated", ["levels": levels])
	}
}

// MARK: - Now Playing / Lock Screen

private final class NowPlayingManager {
	weak var module: YhwavAudioModule?
	private var capabilities: Set<String> = ["Play", "Pause", "SkipToNext", "SkipToPrevious", "SeekTo"]
	private var cachedArtworkUrl: String?
	private var cachedArtwork: MPMediaItemArtwork?
	/// Track the info dictionary currently describes; a new track starts from a clean dictionary.
	private var currentInfoTrackId: String?

	init(module: YhwavAudioModule) {
		self.module = module
	}

	func setCapabilities(_ caps: [String]) {
		capabilities = Set(caps)
		applyRemoteCommandEnabledFlags()
	}

	private func applyRemoteCommandEnabledFlags() {
		let center = MPRemoteCommandCenter.shared()
		center.playCommand.isEnabled = capabilities.contains("Play")
		center.pauseCommand.isEnabled = capabilities.contains("Pause")
		center.nextTrackCommand.isEnabled = capabilities.contains("SkipToNext")
		center.previousTrackCommand.isEnabled = capabilities.contains("SkipToPrevious")
		center.changePlaybackPositionCommand.isEnabled = capabilities.contains("SeekTo")
	}

	func setupRemoteCommands() {
		let center = MPRemoteCommandCenter.shared()
		center.playCommand.removeTarget(nil)
		center.pauseCommand.removeTarget(nil)
		center.nextTrackCommand.removeTarget(nil)
		center.previousTrackCommand.removeTarget(nil)
		center.changePlaybackPositionCommand.removeTarget(nil)

		applyRemoteCommandEnabledFlags()

		center.playCommand.addTarget { [weak self] _ in
			guard let mod = self?.module else { return .commandFailed }
			if Date().timeIntervalSince1970 * 1000 < mod.remotePlaySuppressedUntil {
				return .success // spurious play right after a paused restore
			}
			mod.performPlayAndSync()
			mod.sendEvent("RemotePlay", [:])
			return .success
		}
		center.pauseCommand.addTarget { [weak self] _ in
			guard let mod = self?.module else { return .commandFailed }
			mod.performPauseAndSync()
			mod.sendEvent("RemotePause", [:])
			return .success
		}
		center.nextTrackCommand.addTarget { [weak self] _ in
			self?.module?.sendEvent("RemoteNext", [:])
			return .success
		}
		center.previousTrackCommand.addTarget { [weak self] _ in
			self?.module?.sendEvent("RemotePrevious", [:])
			return .success
		}
		center.changePlaybackPositionCommand.addTarget { [weak self] event in
			guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
			guard let mod = self?.module else { return .commandFailed }
			mod.sendEvent("RemoteSeek", ["position": e.positionTime])
			mod.performSeekAndSync(e.positionTime)
			return .success
		}
	}

	func updateNowPlaying(track: TrackRecord?, position: Double?, duration: Double?, isPlaying: Bool) {
		var info = [String: Any]()
		// A different track starts from an empty dictionary so the previous track's artwork/album never
		// lingers; updates for the same track merge into the existing info.
		let trackChanged = track?.id != currentInfoTrackId
		currentInfoTrackId = track?.id
		if let track = track {
			info[MPMediaItemPropertyTitle] = track.title ?? ""
			info[MPMediaItemPropertyArtist] = track.artist ?? ""
			if let album = track.album, !album.isEmpty {
				info[MPMediaItemPropertyAlbumTitle] = album
			}
			if let d = track.duration, d > 0 {
				info[MPMediaItemPropertyPlaybackDuration] = d / 1000.0 // Plex duration is in milliseconds
			}
			if let urlString = track.artwork, !urlString.isEmpty {
				if urlString != cachedArtworkUrl {
					cachedArtworkUrl = urlString
					cachedArtwork = nil
					if let url = URL(string: urlString) {
						URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
							guard let data = data, let image = UIImage(data: data) else { return }
							let art = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
							DispatchQueue.main.async {
								// Drop late artwork for a track the user already skipped past.
								guard let self = self, self.cachedArtworkUrl == urlString else { return }
								self.cachedArtwork = art
								var i = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
								i[MPMediaItemPropertyArtwork] = art
								MPNowPlayingInfoCenter.default().nowPlayingInfo = i
							}
						}.resume()
					}
				} else if let art = cachedArtwork {
					info[MPMediaItemPropertyArtwork] = art
				}
			}
		}
		if let pos = position {
			info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = pos
		}
		if let dur = duration, dur > 0 {
			info[MPMediaItemPropertyPlaybackDuration] = dur
		}
		info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? (module?.currentPlaybackRate() ?? 1.0) : 0.0
		let current = trackChanged ? [:] : (MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:])
		MPNowPlayingInfoCenter.default().nowPlayingInfo = current.merging(info) { _, new in new }
	}
}
