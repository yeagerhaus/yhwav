import AVFoundation
import Accelerate
import ExpoModulesCore
import MediaPlayer
import MediaToolbox
import UIKit
import YhplayerAudio

// MARK: - Records

struct XFSetupOptions: Record {
	@Field var iosCategory: String?
	@Field var iosCategoryMode: String?
	@Field var minBuffer: Double?
	@Field var maxBuffer: Double?
	@Field var playBuffer: Double?
	@Field var waitForBuffer: Bool?
	@Field var autoHandleInterruptions: Bool?
}

struct XFTrackRecord: Record {
	@Field var id: String
	@Field var url: String
	@Field var title: String?
	@Field var artist: String?
	@Field var artwork: String?
	@Field var duration: Double?
}

struct XFPlaybackStateRecord: Record {
	@Field var state: String = "stopped"
	@Field var position: Double = 0
	@Field var duration: Double = 0
	@Field var buffered: Double?
}

struct XFCrossfadeConfig: Record {
	@Field var enabled: Bool = true
	@Field var defaultDuration: Double = 4.0
	@Field var fadeOnManualSkip: Bool = true
	@Field var manualSkipFadeDuration: Double = 0.5
}

// MARK: - Deck enum

private enum Deck: Int {
	case a = 0
	case b = 1
	var other: Deck { self == .a ? .b : .a }
}

// MARK: - Module

public final class YhplayerCrossfadeModule: Module {
	private var deckA: AVPlayer?
	private var deckB: AVPlayer?
	private var activeDeck: Deck = .a

	private var trackMetadata: [String: XFTrackRecord] = [:]
	private var trackOrder: [String] = []
	private var currentIndex: Int = -1
	private var repeatMode: Int = 2
	private var volume: Float = 1.0
	fileprivate var rate: Float = 1.0

	private var progressTimer: Timer?
	private var progressUpdateInterval: TimeInterval = 0.5
	private var isInitialized = false
	private var lastEmittedState: String = "stopped"

	// Crossfade
	private var crossfadeConfig = XFCrossfadeConfig()
	private var nextCrossfadeDuration: Double = 4.0
	private var isCrossfading = false
	private var crossfadeStartTime: CFAbsoluteTime = 0
	private var currentCrossfadeDuration: Double = 0
	private var crossfadeDisplayLink: CADisplayLink?
	private var pendingCrossfadeIndex: Int?

	// Audio tap on active deck only
	private weak var itemWithAudioTap: AVPlayerItem?

	// Time observers
	private var timeObserverA: Any?
	private var timeObserverB: Any?

	// End-of-track observers (safety net if crossfade doesn't trigger)
	private var endOfTrackObserverA: NSObjectProtocol?
	private var endOfTrackObserverB: NSObjectProtocol?

	// Throttle progress logging
	private var lastDurationLogTime: CFAbsoluteTime = 0

	// Now Playing
	private lazy var nowPlayingManager = XFNowPlayingManager(module: self)

	// MARK: - Helpers

	fileprivate var activePlayer: AVPlayer? {
		activeDeck == .a ? deckA : deckB
	}

	fileprivate var onDeckPlayer: AVPlayer? {
		activeDeck == .a ? deckB : deckA
	}

	fileprivate func player(for deck: Deck) -> AVPlayer? {
		deck == .a ? deckA : deckB
	}

	private func deckLabel(_ deck: Deck) -> String { deck == .a ? "A" : "B" }

	private func log(_ msg: String) {
		NSLog("[XF] %@", msg)
	}

	/// Authoritative track duration: prefer metadata from track record (Plex analysis),
	/// fall back to AVPlayerItem.duration for streaming content where metadata is missing.
	private func resolvedDuration(forTrackAt index: Int, item: AVPlayerItem?) -> Double {
		if index >= 0, index < trackOrder.count,
		   let track = trackMetadata[trackOrder[index]],
		   let metaDur = track.duration, metaDur > 0 {
			return metaDur
		}
		if let item = item {
			let dur = item.duration.seconds
			if dur.isFinite && dur > 0 { return dur }
		}
		return 0
	}

	/// Duration for the currently-active track
	private func activeTrackDuration() -> Double {
		return resolvedDuration(forTrackAt: currentIndex, item: activePlayer?.currentItem)
	}

	// MARK: - Module definition

	public func definition() -> ModuleDefinition {
		Name("YhplayerCrossfade")

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
			"AudioLevelsUpdated"
		)

		OnCreate {}

		AsyncFunction("setupPlayer") { (options: XFSetupOptions?) in
			guard !self.isInitialized else { self.log("setupPlayer: already initialized"); return }
			self.configureAudioSession()
			self.deckA = AVPlayer()
			self.deckB = AVPlayer()
			self.deckA?.volume = self.volume
			self.deckB?.volume = 0
			self.deckA?.automaticallyWaitsToMinimizeStalling = true
			self.deckB?.automaticallyWaitsToMinimizeStalling = true
			self.activeDeck = .a
			self.nowPlayingManager.setupRemoteCommands()
			self.isInitialized = true
			self.log("setupPlayer: initialized, volume=\(self.volume)")
		}

		AsyncFunction("updateOptions") { (options: [String: Any]?) in
			if let interval = options?["progressUpdateEventInterval"] as? Double, interval > 0 {
				self.progressUpdateInterval = interval
			}
			if let caps = options?["capabilities"] as? [String] {
				self.nowPlayingManager.setCapabilities(caps)
			}
		}

		AsyncFunction("add") { (tracks: [XFTrackRecord], insertAfterIndex: Int?) in
			DispatchQueue.main.sync {
				let afterIdx = insertAfterIndex ?? (self.trackOrder.isEmpty ? -1 : self.trackOrder.count - 1)
				for track in tracks {
					self.trackMetadata[track.id] = track
				}
				let ids = tracks.map(\.id)
				if self.trackOrder.isEmpty {
					self.trackOrder = ids
				} else if afterIdx < 0 {
					self.trackOrder.append(contentsOf: ids)
				} else {
					let insertAt = min(afterIdx + 1, self.trackOrder.count)
					self.trackOrder.insert(contentsOf: ids, at: insertAt)
				}
				self.log("add: \(tracks.count) tracks, total=\(self.trackOrder.count), afterIdx=\(afterIdx)")
				// If nothing is playing, start the first track
				if self.currentIndex < 0 && !self.trackOrder.isEmpty {
					self.loadTrack(at: 0, on: self.activeDeck)
					self.currentIndex = 0
					self.startProgressTimerIfNeeded()
				}
			}
		}

		AsyncFunction("reset") {
			DispatchQueue.main.sync {
				self.log("reset: clearing all state")
				self.stopCrossfade()
				self.stopProgressTimer()
				self.teardownAudioTap()
				self.removeEndOfTrackObservers()
				self.deckA?.replaceCurrentItem(with: nil)
				self.deckB?.replaceCurrentItem(with: nil)
				self.deckA?.volume = self.volume
				self.deckB?.volume = 0
				self.trackMetadata.removeAll()
				self.trackOrder.removeAll()
				self.currentIndex = -1
				self.pendingCrossfadeIndex = nil
				self.activeDeck = .a
				self.lastEmittedState = "stopped"
				AudioDSPState.shared.resetFilterState()
			}
		}

		AsyncFunction("remove") { (indices: [Int]) in
			DispatchQueue.main.sync {
				for idx in indices.sorted(by: >) where idx >= 0 && idx < self.trackOrder.count {
					let id = self.trackOrder.remove(at: idx)
					self.trackMetadata.removeValue(forKey: id)
					if idx < self.currentIndex {
						self.currentIndex -= 1
					} else if idx == self.currentIndex {
						self.currentIndex = min(self.currentIndex, self.trackOrder.count - 1)
					}
				}
			}
		}

		AsyncFunction("removeUpcomingTracks") {
			DispatchQueue.main.sync {
				guard self.currentIndex >= 0 else { return }
				let keep = self.currentIndex + 1
				let removed = Array(self.trackOrder.dropFirst(keep))
				self.trackOrder = Array(self.trackOrder.prefix(keep))
				for id in removed {
					self.trackMetadata.removeValue(forKey: id)
				}
			}
		}

		AsyncFunction("move") { (fromIndex: Int, toIndex: Int) in
			guard fromIndex != toIndex,
			      fromIndex >= 0, toIndex >= 0,
			      fromIndex < self.trackOrder.count, toIndex < self.trackOrder.count
			else { return }
			DispatchQueue.main.sync {
				let id = self.trackOrder.remove(at: fromIndex)
				self.trackOrder.insert(id, at: toIndex)
				// Adjust currentIndex
				if fromIndex == self.currentIndex {
					self.currentIndex = toIndex
				} else if fromIndex < self.currentIndex && toIndex >= self.currentIndex {
					self.currentIndex -= 1
				} else if fromIndex > self.currentIndex && toIndex <= self.currentIndex {
					self.currentIndex += 1
				}
			}
		}

		AsyncFunction("skip") { (index: Int) in
			guard index >= 0, index < self.trackOrder.count else {
				self.log("skip: index \(index) out of range (count=\(self.trackOrder.count))")
				return
			}
			DispatchQueue.main.sync {
				let trackId = self.trackOrder[index]
				let title = self.trackMetadata[trackId]?.title ?? "?"
				self.log("skip: → index=\(index) '\(title)', fadeOnSkip=\(self.crossfadeConfig.fadeOnManualSkip), playing=\(self.activePlayer?.timeControlStatus == .playing)")
				if self.crossfadeConfig.fadeOnManualSkip, self.activePlayer?.timeControlStatus == .playing {
					self.performManualSkipFade(toIndex: index)
				} else {
					self.hardSkip(to: index)
				}
			}
		}

		AsyncFunction("play") {
			DispatchQueue.main.async {
				self.log("play: rate=\(self.rate), deck=\(self.deckLabel(self.activeDeck)), index=\(self.currentIndex)")
				self.activePlayer?.rate = self.rate
				self.startProgressTimerIfNeeded()
				self.emitProgressUpdate()
			}
		}

		AsyncFunction("pause") {
			DispatchQueue.main.async {
				self.log("pause: deck=\(self.deckLabel(self.activeDeck)), isCrossfading=\(self.isCrossfading)")
				self.activePlayer?.pause()
				if self.isCrossfading {
					self.onDeckPlayer?.pause()
				}
				self.stopProgressTimer()
				self.emitProgressUpdate()
			}
		}

		AsyncFunction("seekTo") { (position: Double) in
			self.log("seekTo: \(String(format: "%.1f", position))s")
			let cm = CMTime(seconds: position, preferredTimescale: 600)
			let tol = CMTime(seconds: 0.5, preferredTimescale: 600)
			self.activePlayer?.seek(to: cm, toleranceBefore: tol, toleranceAfter: tol)
			DispatchQueue.main.async { self.emitProgressUpdate() }
		}

		AsyncFunction("setVolume") { (value: Float) in
			self.volume = max(0, min(1, value))
			if !self.isCrossfading {
				self.activePlayer?.volume = self.volume
			}
		}

		AsyncFunction("setRate") { (value: Float) in
			self.rate = max(0.5, min(2.0, value))
			if self.activePlayer?.timeControlStatus == .playing {
				self.activePlayer?.rate = self.rate
			}
		}

		AsyncFunction("setRepeatMode") { (mode: Int) in
			self.repeatMode = mode
		}

		// MARK: - DSP control APIs (forwarded to shared AudioDSPState)

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

		// MARK: - Crossfade configuration

		AsyncFunction("setCrossfadeConfig") { (config: XFCrossfadeConfig) in
			self.crossfadeConfig = config
			self.log("setCrossfadeConfig: defaultDuration=\(config.defaultDuration), fadeOnSkip=\(config.fadeOnManualSkip), skipFadeDur=\(config.manualSkipFadeDuration)")
		}

		AsyncFunction("setNextCrossfadeDuration") { (seconds: Double) in
			let clamped = max(0.5, min(12, seconds))
			self.nextCrossfadeDuration = clamped
			self.log("setNextCrossfadeDuration: \(String(format: "%.1f", clamped))s")
		}

		// MARK: - State queries

		Function("getPlaybackState") { () -> XFPlaybackStateRecord in
			var record = XFPlaybackStateRecord()
			DispatchQueue.main.sync {
				let (state, position, duration) = self.currentPlaybackState()
				record.state = state
				record.position = position
				record.duration = duration
			}
			return record
		}

		Function("getActiveTrackIndex") { () -> Int in
			return self.currentIndex
		}

		Function("getQueue") { () -> [XFTrackRecord] in
			var result: [XFTrackRecord] = []
			DispatchQueue.main.sync {
				result = self.trackOrder.compactMap { self.trackMetadata[$0] }
			}
			return result
		}
	}

	// MARK: - Audio session

	private func configureAudioSession() {
		do {
			try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
			try AVAudioSession.sharedInstance().setActive(true)
		} catch {
			print("YhplayerCrossfade: Failed to set audio session: \(error)")
		}
	}

	// MARK: - Track loading

	private func loadTrack(at index: Int, on deck: Deck) {
		guard index >= 0, index < trackOrder.count else {
			log("loadTrack: index \(index) out of range")
			return
		}
		let id = trackOrder[index]
		guard let track = trackMetadata[id], let url = URL(string: track.url) else {
			log("loadTrack: no metadata or URL for id=\(id)")
			return
		}
		let metaDur = track.duration ?? -1
		log("loadTrack: deck=\(deckLabel(deck)) idx=\(index) '\(track.title ?? "?")' metaDuration=\(String(format: "%.1f", metaDur))s")

		let asset = AVURLAsset(url: url)
		let item = AVPlayerItem(asset: asset)
		player(for: deck)?.replaceCurrentItem(with: item)
		setupAudioTapIfActive(deck: deck, item: item)
		observeEndOfTrack(for: item, deck: deck)

		// Log when AVPlayerItem resolves its duration (for comparison with metadata)
		item.asset.loadValuesAsynchronously(forKeys: ["duration"]) { [weak self] in
			let itemDur = item.duration.seconds
			self?.log("loadTrack: item duration resolved=\(String(format: "%.1f", itemDur))s vs metadata=\(String(format: "%.1f", metaDur))s (delta=\(String(format: "%.1f", itemDur - metaDur))s)")
		}
	}

	private func preloadNextTrack() {
		let nextIndex = currentIndex + 1
		guard nextIndex < trackOrder.count || (repeatMode == 2 && !trackOrder.isEmpty) else { return }
		let resolvedIndex = nextIndex < trackOrder.count ? nextIndex : 0
		loadTrack(at: resolvedIndex, on: activeDeck.other)
	}

	// MARK: - Playback state

	private func currentPlaybackState() -> (state: String, position: Double, duration: Double) {
		guard let player = activePlayer, player.currentItem != nil else {
			return ("stopped", 0, 0)
		}
		let pos = CMTimeGetSeconds(player.currentTime())
		let validPos = pos.isFinite && pos >= 0 ? pos : 0

		// Use metadata duration (from Plex/track record) as primary source —
		// AVPlayerItem.duration is unreliable for streaming/transcoded content
		let validDur = activeTrackDuration()

		let state: String
		switch player.timeControlStatus {
		case .playing:
			state = "playing"
		case .paused:
			state = "paused"
		case .waitingToPlayAtSpecifiedRate:
			state = "buffering"
		@unknown default:
			state = "ready"
		}

		// Periodic duration comparison log (once per 10s) to help debug mismatches
		let now = CFAbsoluteTimeGetCurrent()
		if now - lastDurationLogTime > 10.0 {
			lastDurationLogTime = now
			let itemDur = player.currentItem?.duration.seconds ?? -1
			let metaDur = metadataDurationForCurrentTrack()
			if abs(validDur - itemDur) > 1.0 || !itemDur.isFinite {
				log("DURATION MISMATCH: metadata=\(String(format: "%.1f", metaDur ?? -1))s, item=\(String(format: "%.1f", itemDur))s, using=\(String(format: "%.1f", validDur))s, pos=\(String(format: "%.1f", validPos))s")
			}
		}

		return (state, validPos, validDur)
	}

	private func metadataDurationForCurrentTrack() -> Double? {
		guard currentIndex >= 0, currentIndex < trackOrder.count,
		      let track = trackMetadata[trackOrder[currentIndex]],
		      let dur = track.duration, dur > 0 else { return nil }
		return dur
	}

	// MARK: - Progress timer

	private func startProgressTimerIfNeeded() {
		guard progressTimer == nil else { return }
		guard Thread.isMainThread else {
			DispatchQueue.main.async { self.startProgressTimerIfNeeded() }
			return
		}
		progressTimer = Timer(timeInterval: progressUpdateInterval, repeats: true) { [weak self] _ in
			self?.tickProgress()
		}
		RunLoop.main.add(progressTimer!, forMode: .common)
	}

	private func stopProgressTimer() {
		progressTimer?.invalidate()
		progressTimer = nil
	}

	private func tickProgress() {
		emitProgressUpdate()
		checkCrossfadeTrigger()
	}

	private func emitProgressUpdate() {
		let (state, position, duration) = currentPlaybackState()
		lastEmittedState = state
		sendEvent("PlaybackProgressUpdated", [
			"state": state,
			"position": position,
			"duration": duration,
			"track": currentIndex,
			"index": currentIndex,
		])
		let trackId = currentIndex >= 0 && currentIndex < trackOrder.count ? trackOrder[currentIndex] : nil
		let track = trackId.flatMap { trackMetadata[$0] }
		nowPlayingManager.updateNowPlaying(track: track, position: position, duration: duration, isPlaying: state == "playing")
	}

	private func emitActiveTrackChanged() {
		sendEvent("PlaybackActiveTrackChanged", ["index": currentIndex])
		let trackId = currentIndex >= 0 && currentIndex < trackOrder.count ? trackOrder[currentIndex] : nil
		let track = trackId.flatMap { trackMetadata[$0] }
		let pos = activePlayer.map { CMTimeGetSeconds($0.currentTime()) }
		let dur = activeTrackDuration()
		let playing = activePlayer?.timeControlStatus == .playing
		nowPlayingManager.updateNowPlaying(track: track, position: pos, duration: dur > 0 ? dur : nil, isPlaying: playing)
	}

	// MARK: - Crossfade trigger

	private func checkCrossfadeTrigger() {
		guard !isCrossfading else { return }
		guard let player = activePlayer, player.currentItem != nil else { return }
		guard player.timeControlStatus == .playing else { return }

		let duration = activeTrackDuration()
		let position = CMTimeGetSeconds(player.currentTime())
		guard duration > 0, position.isFinite else { return }

		let remaining = duration - position
		let fadeDuration = nextCrossfadeDuration

		// Don't crossfade very short tracks
		guard duration > fadeDuration * 2 else { return }

		if remaining <= fadeDuration && remaining > 0 {
			let nextIndex = computeNextIndex()
			if let nextIndex = nextIndex {
				let trackId = currentIndex >= 0 && currentIndex < trackOrder.count ? trackOrder[currentIndex] : "?"
				let title = trackMetadata[trackId]?.title ?? "?"
				log("CROSSFADE TRIGGER: '\(title)' pos=\(String(format: "%.1f", position))s / dur=\(String(format: "%.1f", duration))s, remaining=\(String(format: "%.1f", remaining))s, fadeDur=\(String(format: "%.1f", fadeDuration))s → nextIdx=\(nextIndex)")
				beginCrossfade(toIndex: nextIndex, duration: min(fadeDuration, remaining))
			}
		}
	}

	private func computeNextIndex() -> Int? {
		guard !trackOrder.isEmpty else { return nil }
		let next = currentIndex + 1
		if next < trackOrder.count { return next }
		if repeatMode == 2 { return 0 }
		return nil
	}

	// MARK: - Crossfade execution

	private func beginCrossfade(toIndex: Int, duration: Double) {
		guard !isCrossfading else { return }
		isCrossfading = true
		pendingCrossfadeIndex = toIndex
		crossfadeStartTime = CFAbsoluteTimeGetCurrent()
		currentCrossfadeDuration = duration

		let incomingDeck = activeDeck.other
		let nextTrackId = toIndex < trackOrder.count ? trackOrder[toIndex] : "?"
		let nextTitle = trackMetadata[nextTrackId]?.title ?? "?"
		log("BEGIN CROSSFADE: deck \(deckLabel(activeDeck))→\(deckLabel(incomingDeck)), duration=\(String(format: "%.1f", duration))s, incoming='\(nextTitle)' (idx=\(toIndex))")

		loadTrack(at: toIndex, on: incomingDeck)

		let incomingPlayer = player(for: incomingDeck)
		incomingPlayer?.volume = 0
		incomingPlayer?.rate = rate

		startCrossfadeDisplayLink()
	}

	private func startCrossfadeDisplayLink() {
		crossfadeDisplayLink?.invalidate()
		let link = CADisplayLink(target: self, selector: #selector(crossfadeTick))
		link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
		link.add(to: .main, forMode: .common)
		crossfadeDisplayLink = link
	}

	private var lastCrossfadeMilestone: Int = -1

	@objc private func crossfadeTick() {
		guard isCrossfading else {
			crossfadeDisplayLink?.invalidate()
			crossfadeDisplayLink = nil
			return
		}

		let elapsed = CFAbsoluteTimeGetCurrent() - crossfadeStartTime
		let t = min(1.0, elapsed / currentCrossfadeDuration)

		// Equal-power crossfade: sqrt curves
		let fadeOutVolume = Float(sqrt(1.0 - t)) * volume
		let fadeInVolume = Float(sqrt(t)) * volume

		activePlayer?.volume = fadeOutVolume
		onDeckPlayer?.volume = fadeInVolume

		// Log milestones: 25%, 50%, 75%
		let milestone = Int(t * 4)
		if milestone > lastCrossfadeMilestone && milestone < 4 {
			lastCrossfadeMilestone = milestone
			log("crossfade \(milestone * 25)%: out=\(String(format: "%.2f", fadeOutVolume)) in=\(String(format: "%.2f", fadeInVolume)) elapsed=\(String(format: "%.1f", elapsed))s")
		}

		// Transfer audio tap at the midpoint
		if t >= 0.5, let incomingItem = onDeckPlayer?.currentItem, incomingItem !== itemWithAudioTap {
			teardownAudioTap()
			AudioDSPState.shared.resetFilterState()
			setupAudioTap(for: incomingItem)
		}

		if t >= 1.0 {
			lastCrossfadeMilestone = -1
			completeCrossfade()
		}
	}

	private func completeCrossfade() {
		let outgoingDeck = activeDeck
		let incomingDeck = activeDeck.other
		let nextIndex = pendingCrossfadeIndex ?? computeNextIndex() ?? currentIndex

		// Stop outgoing
		player(for: outgoingDeck)?.pause()
		player(for: outgoingDeck)?.replaceCurrentItem(with: nil)
		player(for: outgoingDeck)?.volume = 0

		// Finalize incoming
		player(for: incomingDeck)?.volume = volume
		activeDeck = incomingDeck
		let prevIndex = currentIndex
		currentIndex = nextIndex
		pendingCrossfadeIndex = nil

		isCrossfading = false
		crossfadeDisplayLink?.invalidate()
		crossfadeDisplayLink = nil

		let trackId = currentIndex >= 0 && currentIndex < trackOrder.count ? trackOrder[currentIndex] : "?"
		let title = trackMetadata[trackId]?.title ?? "?"
		log("CROSSFADE COMPLETE: \(prevIndex)→\(currentIndex) '\(title)', active deck=\(deckLabel(activeDeck))")

		emitActiveTrackChanged()

		// Pre-load the next track on the now-idle deck
		preloadNextTrack()
	}

	private func stopCrossfade() {
		if isCrossfading {
			log("stopCrossfade: aborting in-progress crossfade")
			isCrossfading = false
			pendingCrossfadeIndex = nil
			lastCrossfadeMilestone = -1
			crossfadeDisplayLink?.invalidate()
			crossfadeDisplayLink = nil
			onDeckPlayer?.pause()
			onDeckPlayer?.replaceCurrentItem(with: nil)
		}
	}

	// MARK: - Manual skip with short fade

	private func performManualSkipFade(toIndex: Int) {
		let fadeDuration = crossfadeConfig.manualSkipFadeDuration
		guard fadeDuration > 0 else {
			hardSkip(to: toIndex)
			return
		}

		stopCrossfade()

		let outgoingDeck = activeDeck
		let incomingDeck = activeDeck.other

		loadTrack(at: toIndex, on: incomingDeck)
		player(for: incomingDeck)?.volume = 0
		player(for: incomingDeck)?.rate = rate

		// Quick fade-in on incoming, immediate stop on outgoing
		UIView.animate(withDuration: 0) {} // Force main thread
		let startTime = CFAbsoluteTimeGetCurrent()
		let link = CADisplayLink(target: ManualFadeTarget(
			module: self,
			outgoingDeck: outgoingDeck,
			incomingDeck: incomingDeck,
			toIndex: toIndex,
			startTime: startTime,
			duration: fadeDuration
		), selector: #selector(ManualFadeTarget.tick))
		link.add(to: .main, forMode: .common)
	}

	fileprivate func finishManualSkip(outgoingDeck: Deck, incomingDeck: Deck, toIndex: Int) {
		player(for: outgoingDeck)?.pause()
		player(for: outgoingDeck)?.replaceCurrentItem(with: nil)
		player(for: outgoingDeck)?.volume = 0

		player(for: incomingDeck)?.volume = volume
		activeDeck = incomingDeck
		currentIndex = toIndex

		teardownAudioTap()
		AudioDSPState.shared.resetFilterState()
		if let item = player(for: incomingDeck)?.currentItem {
			setupAudioTap(for: item)
		}

		emitActiveTrackChanged()
		preloadNextTrack()
	}

	private func hardSkip(to index: Int) {
		let trackId = index >= 0 && index < trackOrder.count ? trackOrder[index] : "?"
		let title = trackMetadata[trackId]?.title ?? "?"
		log("hardSkip: → idx=\(index) '\(title)'")

		stopCrossfade()
		teardownAudioTap()
		AudioDSPState.shared.resetFilterState()

		// Stop both
		onDeckPlayer?.pause()
		onDeckPlayer?.replaceCurrentItem(with: nil)
		onDeckPlayer?.volume = 0

		loadTrack(at: index, on: activeDeck)
		activePlayer?.volume = volume
		activePlayer?.rate = rate
		currentIndex = index

		emitActiveTrackChanged()
		startProgressTimerIfNeeded()
		preloadNextTrack()
	}

	// MARK: - End-of-track observer (safety net)

	private func observeEndOfTrack(for item: AVPlayerItem, deck: Deck) {
		let observer = NotificationCenter.default.addObserver(
			forName: .AVPlayerItemDidPlayToEndTime,
			object: item,
			queue: .main
		) { [weak self] _ in
			self?.handleTrackEndedNaturally(deck: deck)
		}
		if deck == .a {
			if let old = endOfTrackObserverA { NotificationCenter.default.removeObserver(old) }
			endOfTrackObserverA = observer
		} else {
			if let old = endOfTrackObserverB { NotificationCenter.default.removeObserver(old) }
			endOfTrackObserverB = observer
		}
	}

	private func removeEndOfTrackObservers() {
		if let o = endOfTrackObserverA { NotificationCenter.default.removeObserver(o) }
		if let o = endOfTrackObserverB { NotificationCenter.default.removeObserver(o) }
		endOfTrackObserverA = nil
		endOfTrackObserverB = nil
	}

	private func handleTrackEndedNaturally(deck: Deck) {
		log("TRACK ENDED NATURALLY on deck \(deckLabel(deck)), isCrossfading=\(isCrossfading), activeDeck=\(deckLabel(activeDeck))")
		if isCrossfading {
			// Crossfade already in progress — the outgoing track ran out before the
			// crossfade volume ramp finished. Force-complete the crossfade now.
			if deck == activeDeck {
				log("  → outgoing deck ended during crossfade, force-completing")
				lastCrossfadeMilestone = -1
				completeCrossfade()
			}
			return
		}
		guard deck == activeDeck else { return }
		if let nextIndex = computeNextIndex() {
			log("  → advancing to next track idx=\(nextIndex)")
			hardSkip(to: nextIndex)
			activePlayer?.rate = rate
		} else {
			log("  → no next track, emitting QueueEnded")
			sendEvent("PlaybackQueueEnded", [:])
		}
	}

	// MARK: - Audio processing tap

	private func setupAudioTapIfActive(deck: Deck, item: AVPlayerItem) {
		guard deck == activeDeck else { return }
		setupAudioTap(for: item)
	}

	private func setupAudioTap(for item: AVPlayerItem) {
		if item === itemWithAudioTap { return }
		teardownAudioTap()
		itemWithAudioTap = item
		AudioDSPState.shared.resetFilterState()
		let asset = item.asset
		asset.loadValuesAsynchronously(forKeys: ["tracks"]) { [weak self] in
			guard let self = self else { return }
			var error: NSError?
			guard asset.statusOfValue(forKey: "tracks", error: &error) == .loaded else { return }
			guard let track = asset.tracks(withMediaType: .audio).first else { return }
			DispatchQueue.main.async {
				self.attachAudioTap(to: item, track: track)
			}
		}
	}

	private func teardownAudioTap() {
		itemWithAudioTap?.audioMix = nil
		itemWithAudioTap = nil
	}

	private func attachAudioTap(to item: AVPlayerItem, track: AVAssetTrack) {
		guard item === itemWithAudioTap else { return }
		let context = XFAudioTapContext(module: self)
		var callbacks = MTAudioProcessingTapCallbacks(
			version: kMTAudioProcessingTapCallbacksVersion_0,
			clientInfo: Unmanaged.passRetained(context).toOpaque(),
			init: { _, clientInfo, tapStorageOut in
				tapStorageOut.pointee = clientInfo
			},
			finalize: { tap in
				let ptr = MTAudioProcessingTapGetStorage(tap)
				Unmanaged<XFAudioTapContext>.fromOpaque(ptr).release()
			},
			prepare: { _, _, _ in },
			unprepare: { _ in },
			process: { tap, numberFrames, _, bufferListInOut, numberFramesOut, flagsOut in
				guard noErr == MTAudioProcessingTapGetSourceAudio(tap, numberFrames, bufferListInOut, flagsOut, nil, numberFramesOut) else { return }
				AudioDSPState.shared.processAudio(bufferListInOut, frameCount: UInt32(numberFrames))
				let ptr = MTAudioProcessingTapGetStorage(tap)
				let ctx = Unmanaged<XFAudioTapContext>.fromOpaque(ptr).takeUnretainedValue()
				ctx.reportLevels(bufferListInOut, frameCount: UInt32(numberFrames))
			}
		)
		var tap: MTAudioProcessingTap?
		guard MTAudioProcessingTapCreate(kCFAllocatorDefault, &callbacks, kMTAudioProcessingTapCreationFlag_PreEffects, &tap) == noErr,
		      let tapUnwrapped = tap else { return }
		let params = AVMutableAudioMixInputParameters(track: track)
		params.audioTapProcessor = tapUnwrapped
		let mix = AVMutableAudioMix()
		mix.inputParameters = [params]
		item.audioMix = mix
	}

	deinit {
		stopProgressTimer()
		stopCrossfade()
		teardownAudioTap()
		removeEndOfTrackObservers()
	}
}

// MARK: - Manual fade display link target

private final class ManualFadeTarget: NSObject {
	weak var module: YhplayerCrossfadeModule?
	let outgoingDeck: Deck
	let incomingDeck: Deck
	let toIndex: Int
	let startTime: CFAbsoluteTime
	let duration: Double
	private var link: CADisplayLink?

	init(module: YhplayerCrossfadeModule, outgoingDeck: Deck, incomingDeck: Deck,
	     toIndex: Int, startTime: CFAbsoluteTime, duration: Double) {
		self.module = module
		self.outgoingDeck = outgoingDeck
		self.incomingDeck = incomingDeck
		self.toIndex = toIndex
		self.startTime = startTime
		self.duration = duration
	}

	@objc func tick(_ displayLink: CADisplayLink) {
		guard let module = module else {
			displayLink.invalidate()
			return
		}
		let elapsed = CFAbsoluteTimeGetCurrent() - startTime
		let t = min(1.0, elapsed / duration)
		let vol = module.rate > 0 ? Float(t) * 1.0 : 0

		module.player(for: outgoingDeck)?.volume = Float(1.0 - t) * 1.0
		module.player(for: incomingDeck)?.volume = vol

		if t >= 1.0 {
			displayLink.invalidate()
			module.finishManualSkip(outgoingDeck: outgoingDeck, incomingDeck: incomingDeck, toIndex: toIndex)
		}
	}
}

// MARK: - Audio tap context

private final class XFAudioTapContext {
	weak var module: YhplayerCrossfadeModule?
	private var lastSendTime: CFTimeInterval = 0
	private let minInterval: CFTimeInterval = 0.06
	private let lock = NSLock()

	init(module: YhplayerCrossfadeModule) {
		self.module = module
	}

	func reportLevels(_ bufferList: UnsafeMutablePointer<AudioBufferList>, frameCount: UInt32) {
		lock.lock()
		let now = CACurrentMediaTime()
		guard now - lastSendTime >= minInterval else { lock.unlock(); return }
		lastSendTime = now
		lock.unlock()
		guard let mod = module else { return }
		let levels = Self.computeLevels(bufferList, frameCount: frameCount, bandCount: 5)
		DispatchQueue.main.async {
			mod.sendEvent("AudioLevelsUpdated", ["levels": levels])
		}
	}

	static func computeLevels(_ bufferList: UnsafeMutablePointer<AudioBufferList>, frameCount: UInt32, bandCount: Int) -> [Float] {
		let list = UnsafeMutableAudioBufferListPointer(bufferList)
		guard let first = list.first, let mData = first.mData else { return [Float](repeating: 0, count: bandCount) }
		let channelCount = Int(first.mNumberChannels)
		let frameLength = Int(frameCount) * channelCount
		let stride = channelCount
		let samples = mData.assumingMemoryBound(to: Float.self)
		var bands = [Float](repeating: 0, count: bandCount)
		let bandFrames = max(1, frameLength / bandCount)
		for b in 0..<bandCount {
			let start = b * bandFrames
			let count = min(bandFrames, frameLength - start)
			guard count > 0 else { continue }
			var rms: Float = 0
			vDSP_rmsqv(UnsafePointer(samples).advanced(by: start), stride, &rms, vDSP_Length(count))
			bands[b] = min(1, max(0, rms * 4))
		}
		return bands
	}
}

// MARK: - Now Playing / Lock Screen

private final class XFNowPlayingManager {
	weak var module: YhplayerCrossfadeModule?
	private var capabilities: Set<String> = ["Play", "Pause", "SkipToNext", "SkipToPrevious", "SeekTo"]
	private var cachedArtworkUrl: String?
	private var cachedArtwork: MPMediaItemArtwork?

	init(module: YhplayerCrossfadeModule) {
		self.module = module
	}

	func setCapabilities(_ caps: [String]) {
		capabilities = Set(caps)
	}

	func setupRemoteCommands() {
		let center = MPRemoteCommandCenter.shared()
		center.playCommand.isEnabled = capabilities.contains("Play")
		center.playCommand.addTarget { [weak self] _ in
			self?.module?.sendEvent("RemotePlay", [:])
			if let mod = self?.module {
				mod.activePlayer?.rate = mod.rate
			}
			return .success
		}
		center.pauseCommand.isEnabled = capabilities.contains("Pause")
		center.pauseCommand.addTarget { [weak self] _ in
			self?.module?.sendEvent("RemotePause", [:])
			self?.module?.activePlayer?.pause()
			return .success
		}
		center.nextTrackCommand.isEnabled = capabilities.contains("SkipToNext")
		center.nextTrackCommand.addTarget { [weak self] _ in
			self?.module?.sendEvent("RemoteNext", [:])
			return .success
		}
		center.previousTrackCommand.isEnabled = capabilities.contains("SkipToPrevious")
		center.previousTrackCommand.addTarget { [weak self] _ in
			self?.module?.sendEvent("RemotePrevious", [:])
			return .success
		}
		center.changePlaybackPositionCommand.isEnabled = capabilities.contains("SeekTo")
		center.changePlaybackPositionCommand.addTarget { [weak self] event in
			guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
			self?.module?.sendEvent("RemoteSeek", ["position": e.positionTime])
			self?.module?.activePlayer?.seek(to: CMTime(seconds: e.positionTime, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
			return .success
		}
	}

	func updateNowPlaying(track: XFTrackRecord?, position: Double?, duration: Double?, isPlaying: Bool) {
		var info = [String: Any]()
		if let track = track {
			info[MPMediaItemPropertyTitle] = track.title ?? ""
			info[MPMediaItemPropertyArtist] = track.artist ?? ""
			if let d = track.duration, d > 0 {
				info[MPMediaItemPropertyPlaybackDuration] = d
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
								self?.cachedArtwork = art
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
		info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
		let current = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
		MPNowPlayingInfoCenter.default().nowPlayingInfo = current.merging(info) { _, new in new }
	}
}
