import AVFoundation
import Accelerate
import ExpoModulesCore
import MediaPlayer
import MediaToolbox
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
	@Field var artwork: String?
	@Field var duration: Double?
}

struct PlaybackStateRecord: Record {
	@Field var state: String = "stopped"
	@Field var position: Double = 0
	@Field var duration: Double = 0
	@Field var buffered: Double?
}

// MARK: - Module

public final class YhplayerAudioModule: Module {
	fileprivate var queuePlayer: AVQueuePlayer?
	private var trackMetadata: [String: TrackRecord] = [:]
	private var trackOrder: [String] = []
	private var progressTimer: Timer?
	private var progressUpdateInterval: TimeInterval = 0.5
	private var repeatMode: Int = 2 // 0=Off, 1=Track, 2=Queue
	private var volume: Float = 1.0
	fileprivate var rate: Float = 1.0
	private var currentItemObservation: NSKeyValueObservation?
	private var itemDidEndObserver: NSObjectProtocol?
	private var isInitialized = false
	private var suppressTrackChangeEvents = false

	// Playback state for JS: "playing" | "paused" | "buffering" | "ready" | "loading" | "stopped" | "error"
	private var lastEmittedState: String = "stopped"

	// Audio level metering (iOS): item we attached the tap to, so we can clear when switching
	private weak var itemWithAudioMetering: AVPlayerItem?

	private lazy var nowPlayingManager = NowPlayingManager(module: self)

	public func definition() -> ModuleDefinition {
		Name("YhplayerAudio")

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

		OnCreate {
			// Will be set up in setupPlayer
		}

		AsyncFunction("setupPlayer") { (options: SetupOptions?) in
			guard !self.isInitialized else { return }
			self.configureAudioSession()
			self.queuePlayer = AVQueuePlayer()
			self.queuePlayer?.volume = self.volume
			self.queuePlayer?.rate = self.rate
			self.observePlayerStatus()
			self.setupAudioMeteringForCurrentItem()
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
			guard self.queuePlayer != nil else { return }
			DispatchQueue.main.sync {
				guard let player = self.queuePlayer else { return }
				let afterIdx = insertAfterIndex ?? (self.trackOrder.isEmpty ? -1 : self.trackOrder.count - 1)
				var insertAfter: AVPlayerItem?
				if afterIdx >= 0, afterIdx < self.trackOrder.count {
					let refId = self.trackOrder[afterIdx]
					insertAfter = player.items().first { $0.associatedTrackId() == refId }
				}
				if insertAfter == nil, !player.items().isEmpty {
					insertAfter = player.items().last
				}
				for track in tracks {
					let item = self.createPlayerItem(url: track.url)
					item.setAssociatedTrack(track)
					self.trackMetadata[track.id] = track
					player.insert(item, after: insertAfter)
					insertAfter = item
				}
				if self.trackOrder.isEmpty {
					self.trackOrder = tracks.map(\.id)
				} else if afterIdx < 0 {
					self.trackOrder.append(contentsOf: tracks.map(\.id))
				} else {
					let head = Array(self.trackOrder.prefix(afterIdx + 1))
					let tail = Array(self.trackOrder.dropFirst(afterIdx + 1))
					self.trackOrder = head + tracks.map(\.id) + tail
				}
				self.startProgressTimerIfNeeded()
			}
		}

		AsyncFunction("reset") {
			DispatchQueue.main.sync {
				self.stopProgressTimer()
				self.teardownAudioMetering()
				self.queuePlayer?.removeAllItems()
				self.trackMetadata.removeAll()
				self.trackOrder.removeAll()
				self.lastEmittedState = "stopped"
			}
		}

		AsyncFunction("remove") { (indices: [Int]) in
			guard self.queuePlayer != nil else { return }
			DispatchQueue.main.sync {
				guard let player = self.queuePlayer else { return }
				let allItems = player.items()
				for idx in indices.sorted(by: >) where idx >= 0 && idx < self.trackOrder.count {
					let id = self.trackOrder[idx]
					if let item = allItems.first(where: { $0.associatedTrackId() == id }) {
						player.remove(item)
					}
					self.trackOrder.remove(at: idx)
					self.trackMetadata.removeValue(forKey: id)
				}
			}
		}

		AsyncFunction("removeUpcomingTracks") {
			guard self.queuePlayer != nil else { return }
			DispatchQueue.main.sync {
				guard let player = self.queuePlayer else { return }
				let current = player.currentItem
				let items = player.items()
				var foundCurrent = false
				for item in items {
					if item === current {
						foundCurrent = true
						continue
					}
					if foundCurrent {
						player.remove(item)
						if let id = item.associatedTrackId() {
							self.trackOrder.removeAll { $0 == id }
							self.trackMetadata.removeValue(forKey: id)
						}
					}
				}
			}
		}

		AsyncFunction("move") { (fromIndex: Int, toIndex: Int) in
			guard fromIndex != toIndex,
			      fromIndex >= 0, toIndex >= 0,
			      fromIndex < self.trackOrder.count, toIndex < self.trackOrder.count
			else { return }
			// Run on main with suppress (same as skip) so JS doesn't get intermediate track indices.
			DispatchQueue.main.sync {
				let id = self.trackOrder.remove(at: fromIndex)
				self.trackOrder.insert(id, at: toIndex)
				let currentIdx = self.currentActiveTrackIndex()
				let wasPlaying = self.queuePlayer?.timeControlStatus == .playing
				self.suppressTrackChangeEvents = true
				self.rebuildQueueFromOrder(makeCurrentIndex: currentIdx >= 0 ? currentIdx : nil)
				self.suppressTrackChangeEvents = false
				if wasPlaying { self.queuePlayer?.rate = self.rate }
			}
		}

		AsyncFunction("skip") { (index: Int) in
			guard let player = self.queuePlayer, index >= 0, index < self.trackOrder.count else { return }
			// Run on main and block until done so we set suppress before rebuild; otherwise
			// currentItem observations fire for each advanceToNextItem() and JS receives
			// wrong intermediate indices (e.g. selected song plays the next one, skip goes +2).
			DispatchQueue.main.sync {
				self.suppressTrackChangeEvents = true
				self.rebuildQueueFromOrder(makeCurrentIndex: index)
				player.rate = self.rate
				self.suppressTrackChangeEvents = false
				self.emitActiveTrackChanged(index: index)
				self.startProgressTimerIfNeeded()
			}
		}

		AsyncFunction("play") {
			self.queuePlayer?.rate = self.rate
			DispatchQueue.main.async {
				self.startProgressTimerIfNeeded()
				self.emitProgressUpdate()
			}
		}

		AsyncFunction("pause") {
			self.queuePlayer?.pause()
			self.stopProgressTimer()
			DispatchQueue.main.async { self.emitProgressUpdate() }
		}

		AsyncFunction("seekTo") { (position: Double) in
			let cm = CMTime(seconds: position, preferredTimescale: 600)
			// Small tolerance avoids long keyframe-seeking on some streams; .zero can stall.
			let tol = CMTime(seconds: 0.5, preferredTimescale: 600)
			self.queuePlayer?.seek(to: cm, toleranceBefore: tol, toleranceAfter: tol)
			DispatchQueue.main.async { self.emitProgressUpdate() }
		}

		AsyncFunction("setVolume") { (value: Float) in
			self.volume = max(0, min(1, value))
			self.queuePlayer?.volume = self.volume
		}

		AsyncFunction("setRate") { (value: Float) in
			self.rate = max(0.5, min(2.0, value))
			if self.queuePlayer?.timeControlStatus == .playing {
				self.queuePlayer?.rate = self.rate
			}
		}

		AsyncFunction("setRepeatMode") { (mode: Int) in
			self.repeatMode = mode
		}

		AsyncFunction("setEqualizerBands") { (_ bands: [[String: Any]]) in
			// Stub for future equalizer (AVAudioEngine + AVAudioUnitEQ)
		}

		Function("getPlaybackState") { () -> PlaybackStateRecord in
			var record = PlaybackStateRecord()
			DispatchQueue.main.sync {
				let (state, position, duration) = self.currentPlaybackState()
				record.state = state
				record.position = position
				record.duration = duration
				record.buffered = nil
			}
			return record
		}

		Function("getActiveTrackIndex") { () -> Int in
			var idx = -1
			DispatchQueue.main.sync {
				idx = self.currentActiveTrackIndex()
			}
			return idx
		}

		Function("getQueue") { () -> [TrackRecord] in
			var result: [TrackRecord] = []
			DispatchQueue.main.sync {
				result = self.trackOrder.compactMap { id in self.trackMetadata[id] }
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
			print("YhplayerAudio: Failed to set audio session: \(error)")
		}
	}

	// MARK: - Player item

	private func createPlayerItem(url: String) -> AVPlayerItem {
		guard let u = URL(string: url) else {
			return AVPlayerItem(asset: AVAsset())
		}
		let asset = AVURLAsset(url: u)
		let item = AVPlayerItem(asset: asset)
		return item
	}

	// MARK: - Observers

	private func observePlayerStatus() {
		guard let player = queuePlayer else { return }

		currentItemObservation = player.observe(\.currentItem, options: [.new]) { [weak self] _, _ in
			DispatchQueue.main.async {
				self?.setupAudioMeteringForCurrentItem()
				self?.emitActiveTrackChangedFromCurrentItem()
			}
		}

		itemDidEndObserver = NotificationCenter.default.addObserver(
			forName: .AVPlayerItemDidPlayToEndTime,
			object: player,
			queue: .main
		) { [weak self] notification in
			self?.playerItemDidReachEnd(notification)
		}
	}

	private func playerItemDidReachEnd(_ notification: Notification) {
		guard let item = notification.object as? AVPlayerItem else { return }
		if repeatMode == 1 {
			if let id = item.associatedTrackId(), let idx = trackOrder.firstIndex(of: id) {
				rebuildQueueFromOrder(makeCurrentIndex: idx)
				queuePlayer?.rate = rate
			}
			return
		}
		if repeatMode == 2, !trackOrder.isEmpty {
			// Check if the queue has ended (no more items after this one)
			if queuePlayer?.items().count == 1 {
				rebuildQueueFromOrder(makeCurrentIndex: 0)
				queuePlayer?.rate = rate
				return
			}
		}
		DispatchQueue.main.async { [weak self] in
			self?.checkQueueEnded()
		}
	}

	private func checkQueueEnded() {
		guard let player = queuePlayer else { return }
		if player.currentItem == nil {
			sendEvent("PlaybackQueueEnded", [:])
		}
	}

	private func emitActiveTrackChangedFromCurrentItem() {
		guard !suppressTrackChangeEvents else { return }
		let idx = currentActiveTrackIndex()
		guard idx >= 0 else { return }
		emitActiveTrackChanged(index: idx)
	}

	private func emitActiveTrackChanged(index: Int) {
		sendEvent("PlaybackActiveTrackChanged", ["index": index])
		let trackId = index >= 0 && index < trackOrder.count ? trackOrder[index] : nil
		let track = trackId.flatMap { trackMetadata[$0] }
		let pos = queuePlayer.map { CMTimeGetSeconds($0.currentTime()) }
		let dur = queuePlayer?.currentItem.map { $0.duration.seconds }
		let playing = queuePlayer?.timeControlStatus == .playing
		nowPlayingManager.updateNowPlaying(track: track, position: pos, duration: dur, isPlaying: playing)
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
	}

	private func emitProgressUpdate() {
		let (state, position, duration) = currentPlaybackState()
		if state != lastEmittedState {
			lastEmittedState = state
		}
		let idx = currentActiveTrackIndex()
		sendEvent("PlaybackProgressUpdated", [
			"position": position,
			"duration": duration,
			"track": idx,
			"index": idx
		])
		let trackId = idx >= 0 && idx < trackOrder.count ? trackOrder[idx] : nil
		let track = trackId.flatMap { trackMetadata[$0] }
		nowPlayingManager.updateNowPlaying(track: track, position: position, duration: duration, isPlaying: state == "playing")
	}

	// MARK: - State

	private func currentPlaybackState() -> (state: String, position: Double, duration: Double) {
		guard let player = queuePlayer else {
			return ("stopped", 0, 0)
		}
		guard let item = player.currentItem else {
			return ("stopped", 0, 0)
		}
		let pos = CMTimeGetSeconds(player.currentTime())
		let dur = item.duration.seconds
		let validPos = pos.isFinite && pos >= 0 ? pos : 0
		let validDur = dur.isFinite && dur >= 0 ? dur : 0

		switch player.timeControlStatus {
		case .playing:
			return ("playing", validPos, validDur)
		case .paused:
			return ("paused", validPos, validDur)
		case .waitingToPlayAtSpecifiedRate:
			return ("buffering", validPos, validDur)
	@unknown default:
		return ("ready", validPos, validDur)
		}
	}

	private func rebuildQueueFromOrder(makeCurrentIndex: Int? = nil) {
		guard let player = queuePlayer else { return }
		player.removeAllItems()
		for id in trackOrder {
			guard let track = trackMetadata[id] else { continue }
			let item = createPlayerItem(url: track.url)
			item.setAssociatedTrack(track)
			player.insert(item, after: player.items().last)
		}
		if let idx = makeCurrentIndex, idx >= 0, idx < trackOrder.count {
			for _ in 0..<idx {
				player.advanceToNextItem()
			}
		}
	}

	private func currentActiveTrackIndex() -> Int {
		guard let player = queuePlayer,
		      let current = player.currentItem,
		      let id = current.associatedTrackId(),
		      let idx = trackOrder.firstIndex(of: id) else { return -1 }
		return idx
	}

	// MARK: - Audio level metering (iOS)

	private func setupAudioMeteringForCurrentItem() {
		guard let player = queuePlayer, let item = player.currentItem else {
			teardownAudioMetering()
			return
		}
		if item === itemWithAudioMetering { return }
		teardownAudioMetering()
		itemWithAudioMetering = item
		let asset = item.asset
		asset.loadValuesAsynchronously(forKeys: ["tracks"]) { [weak self] in
			guard let self = self else { return }
			var error: NSError?
			guard asset.statusOfValue(forKey: "tracks", error: &error) == .loaded else { return }
			guard let track = asset.tracks(withMediaType: .audio).first else { return }
			DispatchQueue.main.async {
				self.attachAudioMetering(to: item, track: track)
			}
		}
	}

	private func teardownAudioMetering() {
		itemWithAudioMetering?.audioMix = nil
		itemWithAudioMetering = nil
	}

	private func attachAudioMetering(to item: AVPlayerItem, track: AVAssetTrack) {
		guard item === itemWithAudioMetering else { return }
		let context = AudioLevelContext(module: self)
		var callbacks = MTAudioProcessingTapCallbacks(
			version: kMTAudioProcessingTapCallbacksVersion_0,
			clientInfo: Unmanaged.passRetained(context).toOpaque(),
			init: { _, clientInfo, tapStorageOut in
				tapStorageOut.pointee = clientInfo
			},
			finalize: { tap in
				let ptr = MTAudioProcessingTapGetStorage(tap)
				Unmanaged<AudioLevelContext>.fromOpaque(ptr).release()
			},
			prepare: { _, _, _ in },
			unprepare: { _ in },
			process: { tap, numberFrames, _, bufferListInOut, numberFramesOut, flagsOut in
				guard noErr == MTAudioProcessingTapGetSourceAudio(tap, numberFrames, bufferListInOut, flagsOut, nil, numberFramesOut) else { return }
				let ptr = MTAudioProcessingTapGetStorage(tap)
				let ctx = Unmanaged<AudioLevelContext>.fromOpaque(ptr).takeUnretainedValue()
				let levels = AudioLevelContext.computeLevels(bufferListInOut, frameCount: UInt32(numberFrames), bandCount: 5)
				ctx.reportLevels(levels)
			}
		)
		var tap: MTAudioProcessingTap?
		guard MTAudioProcessingTapCreate(kCFAllocatorDefault, &callbacks, kMTAudioProcessingTapCreationFlag_PreEffects, &tap) == noErr,
		      let tapUnwrapped = tap else {
			return
		}
		let params = AVMutableAudioMixInputParameters(track: track)
		params.audioTapProcessor = tapUnwrapped
		let mix = AVMutableAudioMix()
		mix.inputParameters = [params]
		item.audioMix = mix
	}

	deinit {
		stopProgressTimer()
		teardownAudioMetering()
		currentItemObservation?.invalidate()
		if let obs = itemDidEndObserver {
			NotificationCenter.default.removeObserver(obs)
		}
	}
}

// MARK: - Audio level context (for MTAudioProcessingTap)

private final class AudioLevelContext {
	weak var module: YhplayerAudioModule?
	private var lastSendTime: CFTimeInterval = 0
	private let minInterval: CFTimeInterval = 0.06
	private let lock = NSLock()

	init(module: YhplayerAudioModule) {
		self.module = module
	}

	func reportLevels(_ levels: [Float]) {
		lock.lock()
		let now = CACurrentMediaTime()
		guard now - lastSendTime >= minInterval else { lock.unlock(); return }
		lastSendTime = now
		lock.unlock()
		guard let mod = module else { return }
		let levelsCopy = levels
		DispatchQueue.main.async {
			mod.sendEvent("AudioLevelsUpdated", ["levels": levelsCopy])
		}
	}

	static func computeLevels(_ bufferList: UnsafeMutablePointer<AudioBufferList>, frameCount: UInt32, bandCount: Int) -> [Float] {
		let list = UnsafeMutableAudioBufferListPointer(bufferList)
		guard let first = list.first, let mData = first.mData else { return (0..<bandCount).map { _ in Float(0) } }
		let channelCount = Int(first.mNumberChannels)
		let frameLength = Int(frameCount) * channelCount
		let stride = channelCount
		let samplesRaw = mData.assumingMemoryBound(to: Float.self)
		let samples = UnsafePointer(samplesRaw)
		var bands = [Float](repeating: 0, count: bandCount)
		let bandFrames = max(1, frameLength / bandCount)
		for b in 0..<bandCount {
			let start = b * bandFrames
			let count = min(bandFrames, frameLength - start)
			guard count > 0 else { continue }
			var rms: Float = 0
			vDSP_rmsqv(samples.advanced(by: start), stride, &rms, vDSP_Length(count))
			bands[b] = min(1, max(0, rms * 4))
		}
		return bands
	}
}

// MARK: - AVPlayerItem track association

private let associatedTrackIdKey = UnsafeRawPointer(bitPattern: "yhplayer_track_id".hashValue)!

extension AVPlayerItem {
	func setAssociatedTrack(_ track: TrackRecord) {
		objc_setAssociatedObject(self, associatedTrackIdKey, track.id, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
	}

	func associatedTrackId() -> String? {
		objc_getAssociatedObject(self, associatedTrackIdKey) as? String
	}
}

// MARK: - Now Playing / Lock Screen

private final class NowPlayingManager {
	weak var module: YhplayerAudioModule?
	private var capabilities: Set<String> = ["Play", "Pause", "SkipToNext", "SkipToPrevious", "SeekTo"]
	private var cachedArtworkUrl: String?
	private var cachedArtwork: MPMediaItemArtwork?

	init(module: YhplayerAudioModule) {
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
				mod.queuePlayer?.rate = mod.rate
			}
			return .success
		}
		center.pauseCommand.isEnabled = capabilities.contains("Pause")
		center.pauseCommand.addTarget { [weak self] _ in
			self?.module?.sendEvent("RemotePause", [:])
			self?.module?.queuePlayer?.pause()
			return .success
		}
		center.nextTrackCommand.isEnabled = capabilities.contains("SkipToNext")
		center.nextTrackCommand.addTarget { [weak self] _ in
			self?.module?.sendEvent("RemoteNext", [:])
			// JS handler will call skipToNext
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
			self?.module?.queuePlayer?.seek(to: CMTime(seconds: e.positionTime, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
			return .success
		}
	}

	func updateNowPlaying(track: TrackRecord?, position: Double?, duration: Double?, isPlaying: Bool) {
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

