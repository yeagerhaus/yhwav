import AVFoundation
import Accelerate
import AudioToolbox

// MARK: - Delegate

protocol AudioEnginePlayerDelegate: AnyObject {
	func enginePlayer(_ player: AudioEnginePlayer, didFinishTrack trackId: String)
	func enginePlayer(_ player: AudioEnginePlayer, didEncounterError error: String, trackId: String)
	func enginePlayer(_ player: AudioEnginePlayer, didUpdateLevels levels: [Float])
}

// MARK: - YhwavDSPUnit

private let yhwavDSPDesc = AudioComponentDescription(
	componentType: kAudioUnitType_Effect,
	componentSubType: fourCC("yDSP"),
	componentManufacturer: fourCC("yhwv"),
	componentFlags: 0,
	componentFlagsMask: 0
)

private func fourCC(_ str: String) -> FourCharCode {
	var result: FourCharCode = 0
	for char in str.utf8.prefix(4) {
		result = (result << 8) | FourCharCode(char)
	}
	return result
}

private var dspRegistered = false

final class YhwavDSPUnit: AUAudioUnit {
	private var _inputBusArray: AUAudioUnitBusArray!
	private var _outputBusArray: AUAudioUnitBusArray!
	private var inputBus: AUAudioUnitBus!
	private var _maxFrames: AUAudioFrameCount = 4096

	override init(componentDescription: AudioComponentDescription, options: AudioComponentInstantiationOptions = []) throws {
		try super.init(componentDescription: componentDescription, options: options)
		let defaultFormat = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
		inputBus = try AUAudioUnitBus(format: defaultFormat)
		_inputBusArray = AUAudioUnitBusArray(audioUnit: self, busType: .input, busses: [inputBus])
		_outputBusArray = AUAudioUnitBusArray(audioUnit: self, busType: .output, busses: [try AUAudioUnitBus(format: defaultFormat)])
	}

	override var inputBusses: AUAudioUnitBusArray { _inputBusArray }
	override var outputBusses: AUAudioUnitBusArray { _outputBusArray }
	override var maximumFramesToRender: AUAudioFrameCount {
		get { _maxFrames }
		set { _maxFrames = newValue }
	}

	override var internalRenderBlock: AUInternalRenderBlock {
		return { actionFlags, timestamp, frameCount, outputBusNumber, outputData, renderEvent, pullInputBlock in
			guard let pull = pullInputBlock else { return kAudioUnitErr_NoConnection }
			let status = pull(actionFlags, timestamp, frameCount, 0, outputData)
			guard status == noErr else { return status }
			AudioDSPState.shared.processAudio(outputData, frameCount: frameCount)
			return noErr
		}
	}
}

// MARK: - AudioEnginePlayer

final class AudioEnginePlayer {
	weak var delegate: AudioEnginePlayerDelegate?

	private var engine: AVAudioEngine!
	private var playerNode: AVAudioPlayerNode!
	private var timePitchNode: AVAudioUnitTimePitch!
	private var dspNode: AVAudioUnit?
	private let fileCache: AudioFileCache

	private(set) var currentTrackId: String?
	private var currentFile: AVAudioFile?
	private var currentFrameOffset: AVAudioFramePosition = 0
	private var playerTimeBaseOffset: AVAudioFramePosition = 0

	private var nextTrackId: String?
	private var nextFile: AVAudioFile?
	private var isNextScheduled = false

	private var _isPlaying = false
	private var _volume: Float = 1.0
	private var _rate: Float = 1.0

	/// Monotonically increasing generation counter. Each call to play() or seek()
	/// increments this; completion handlers captured with an older generation are ignored.
	private var playGeneration: UInt64 = 0

	private var trackEndWallTime: Double = 0

	/// When `lastRenderTime` / `playerTime` is invalid (common around pause/resume), avoid reporting 0 and collapsing the UI progress.
	private var cachedPlaybackSeconds: Double = 0

	private var interruptionObserver: NSObjectProtocol?
	private var routeChangeObserver: NSObjectProtocol?

	init(fileCache: AudioFileCache) {
		self.fileCache = fileCache
	}

	// MARK: - Engine lifecycle

	func setup() {
		if !dspRegistered {
			AUAudioUnit.registerSubclass(YhwavDSPUnit.self, as: yhwavDSPDesc, name: "YhwavDSP", version: 1)
			dspRegistered = true
		}

		engine = AVAudioEngine()
		playerNode = AVAudioPlayerNode()
		timePitchNode = AVAudioUnitTimePitch()

		engine.attach(playerNode)
		engine.attach(timePitchNode)

		let format = engine.mainMixerNode.outputFormat(forBus: 0)

		let sem = DispatchSemaphore(value: 0)
		var createdUnit: AVAudioUnit?

		AVAudioUnit.instantiate(with: yhwavDSPDesc, options: []) { unit, error in
			if let error = error {
				print("YhwavAudio: DSP unit instantiation failed: \(error)")
			}
			createdUnit = unit
			sem.signal()
		}
		sem.wait()

		if let unit = createdUnit {
			dspNode = unit
			engine.attach(unit)
			engine.connect(playerNode, to: timePitchNode, format: format)
			engine.connect(timePitchNode, to: unit, format: format)
			engine.connect(unit, to: engine.mainMixerNode, format: format)
			print("YhwavAudio: engine setup format=\(format.sampleRate)Hz/\(format.channelCount)ch (with DSP)")
		} else {
			engine.connect(playerNode, to: timePitchNode, format: format)
			engine.connect(timePitchNode, to: engine.mainMixerNode, format: format)
			print("YhwavAudio: engine setup format=\(format.sampleRate)Hz/\(format.channelCount)ch (no DSP)")
		}

		installLevelTap()
		observeInterruptions()

		do {
			try engine.start()
		} catch {
			print("YhwavAudio: engine start failed: \(error)")
		}
	}

	func teardown() {
		print("YhwavAudio: engine teardown")
		playGeneration &+= 1
		stopLevelTap()
		removeInterruptionObservers()

		playerNode?.stop()
		engine?.stop()

		if let e = engine {
			if let pn = playerNode { e.detach(pn) }
			if let tp = timePitchNode { e.detach(tp) }
			if let dn = dspNode { e.detach(dn) }
		}

		engine = nil
		playerNode = nil
		timePitchNode = nil
		dspNode = nil
		currentFile = nil
		currentTrackId = nil
		currentFrameOffset = 0
		playerTimeBaseOffset = 0
		nextFile = nil
		nextTrackId = nil
		isNextScheduled = false
		_isPlaying = false
		cachedPlaybackSeconds = 0
	}

	// MARK: - Playback

	private func loadAudioFile(url: URL, trackId: String, expectedDurationSeconds: Double?, fallbackURL: URL?) async throws -> AVAudioFile {
		do {
			return try await fileCache.getAudioFile(url: url, trackId: trackId, expectedDurationSeconds: expectedDurationSeconds)
		} catch {
			let ns = error as NSError
			if let fb = fallbackURL,
			   ns.domain == AudioFileCache.errorDomain,
			   ns.code == AudioFileCache.durationMismatchCode {
				print("YhwavAudio: transcode too short vs metadata — trying direct file URL trackId=\(trackId)")
				fileCache.evict(trackIds: Set([trackId]))
				return try await fileCache.getAudioFile(url: fb, trackId: trackId, expectedDurationSeconds: expectedDurationSeconds)
			}
			throw error
		}
	}

	func play(url: URL, trackId: String, expectedDurationSeconds: Double? = nil, fallbackURL: URL? = nil) async throws {
		guard let playerNode = playerNode, let engine = engine else { return }

		playGeneration &+= 1
		let gen = playGeneration

		playerNode.stop()
		isNextScheduled = false
		nextFile = nil
		nextTrackId = nil

		print("YhwavAudio: play trackId=\(trackId)")

		let file: AVAudioFile
		do {
			file = try await loadAudioFile(url: url, trackId: trackId, expectedDurationSeconds: expectedDurationSeconds, fallbackURL: fallbackURL)
		} catch {
			print("YhwavAudio: error trackId=\(trackId): \(error.localizedDescription)")
			throw error
		}

		guard gen == playGeneration else {
			print("YhwavAudio: play trackId=\(trackId) stale (gen \(gen) != \(playGeneration))")
			return
		}

		reconnectIfNeeded(for: file)

		if !engine.isRunning {
			try engine.start()
		}

		currentFile = file
		currentTrackId = trackId
		currentFrameOffset = 0
		playerTimeBaseOffset = 0
		cachedPlaybackSeconds = 0

		let frameCount = AVAudioFrameCount(file.length)
		let duration = Double(file.length) / file.processingFormat.sampleRate
		print("YhwavAudio: schedule trackId=\(trackId) duration=\(String(format: "%.1f", duration))s frames=\(frameCount) (current)")

		playerNode.scheduleFile(file, at: nil, completionCallbackType: .dataPlayedBack) { [weak self] _ in
			DispatchQueue.main.async {
				self?.handleTrackCompletion(trackId: trackId, generation: gen)
			}
		}

		playerNode.play()
		_isPlaying = true
		timePitchNode.rate = _rate
		playerNode.volume = _volume
	}

	func scheduleNext(url: URL, trackId: String, expectedDurationSeconds: Double? = nil, fallbackURL: URL? = nil) async throws {
		guard playerNode != nil else { return }
		let gen = playGeneration

		let file: AVAudioFile
		do {
			file = try await loadAudioFile(url: url, trackId: trackId, expectedDurationSeconds: expectedDurationSeconds, fallbackURL: fallbackURL)
		} catch {
			print("YhwavAudio: error loading next trackId=\(trackId): \(error.localizedDescription)")
			return
		}

		guard gen == playGeneration else {
			print("YhwavAudio: scheduleNext trackId=\(trackId) stale (gen \(gen) != \(playGeneration))")
			return
		}

		nextFile = file
		nextTrackId = trackId

		let frameCount = AVAudioFrameCount(file.length)
		let duration = Double(file.length) / file.processingFormat.sampleRate
		print("YhwavAudio: schedule trackId=\(trackId) duration=\(String(format: "%.1f", duration))s frames=\(frameCount) (next)")

		playerNode.scheduleFile(file, at: nil, completionCallbackType: .dataPlayedBack) { [weak self] _ in
			DispatchQueue.main.async {
				self?.handleTrackCompletion(trackId: trackId, generation: gen)
			}
		}
		isNextScheduled = true
	}

	func clearScheduled() {
		playGeneration &+= 1
		playerNode?.stop()
		currentFile = nil
		currentTrackId = nil
		currentFrameOffset = 0
		playerTimeBaseOffset = 0
		nextFile = nil
		nextTrackId = nil
		isNextScheduled = false
		_isPlaying = false
		trackEndWallTime = 0
		cachedPlaybackSeconds = 0
	}

	func pause() {
		print("YhwavAudio: pause")
		playerNode?.pause()
		_isPlaying = false
	}

	func resume() {
		guard let playerNode = playerNode else { return }
		print("YhwavAudio: resume")

		if let engine = engine, !engine.isRunning {
			do { try engine.start() } catch {
				print("YhwavAudio: engine restart failed: \(error)")
				return
			}
		}

		playerNode.play()
		_isPlaying = true
	}

	func seek(to seconds: Double) {
		guard let file = currentFile, let playerNode = playerNode, let trackId = currentTrackId else { return }

		playGeneration &+= 1
		let gen = playGeneration

		let sampleRate = file.processingFormat.sampleRate
		let targetFrame = AVAudioFramePosition(seconds * sampleRate)
		let clampedFrame = max(0, min(targetFrame, file.length - 1))
		let remainingFrames = AVAudioFrameCount(file.length - clampedFrame)

		print("YhwavAudio: seek trackId=\(trackId) to=\(String(format: "%.1f", seconds))s frame=\(clampedFrame)")

		cachedPlaybackSeconds = Double(clampedFrame) / sampleRate

		let wasPlaying = _isPlaying
		playerNode.stop()
		isNextScheduled = false

		currentFrameOffset = clampedFrame
		playerTimeBaseOffset = 0

		playerNode.scheduleSegment(file, startingFrame: clampedFrame, frameCount: remainingFrames, at: nil, completionCallbackType: .dataPlayedBack) { [weak self] _ in
			DispatchQueue.main.async {
				self?.handleTrackCompletion(trackId: trackId, generation: gen)
			}
		}

		if let nf = nextFile, let nid = nextTrackId {
			playerNode.scheduleFile(nf, at: nil, completionCallbackType: .dataPlayedBack) { [weak self] _ in
				DispatchQueue.main.async {
					self?.handleTrackCompletion(trackId: nid, generation: gen)
				}
			}
			isNextScheduled = true
		}

		if wasPlaying {
			playerNode.play()
		}
	}

	// MARK: - State

	var isPlaying: Bool { _isPlaying }

	var currentPosition: Double {
		guard let file = currentFile else {
			cachedPlaybackSeconds = 0
			return 0
		}
		let dur = Double(file.length) / file.processingFormat.sampleRate
		guard let playerNode = playerNode,
			  let nodeTime = playerNode.lastRenderTime,
			  nodeTime.isSampleTimeValid,
			  let playerTime = playerNode.playerTime(forNodeTime: nodeTime) else {
			return max(0, min(cachedPlaybackSeconds, dur))
		}
		let frames = playerTime.sampleTime - playerTimeBaseOffset + currentFrameOffset
		let pos = Double(frames) / file.processingFormat.sampleRate
		let clamped = max(0, min(pos, dur))
		cachedPlaybackSeconds = clamped
		return clamped
	}

	var currentDuration: Double {
		guard let file = currentFile else { return 0 }
		return Double(file.length) / file.processingFormat.sampleRate
	}

	var volume: Float {
		get { _volume }
		set {
			_volume = max(0, min(1, newValue))
			playerNode?.volume = _volume
			print("YhwavAudio: volume=\(_volume)")
		}
	}

	var rate: Float {
		get { _rate }
		set {
			_rate = max(0.5, min(2.0, newValue))
			timePitchNode?.rate = _rate
			print("YhwavAudio: rate=\(_rate)")
		}
	}

	// MARK: - Track completion

	private func handleTrackCompletion(trackId: String, generation: UInt64) {
		guard generation == playGeneration else { return }
		guard trackId == currentTrackId else { return }

		let now = Date().timeIntervalSince1970 * 1000

		if isNextScheduled, let nid = nextTrackId, let nf = nextFile {
			let gap = trackEndWallTime > 0 ? Int(now - trackEndWallTime) : 0
			print("YhwavAudio: transition trackId=\(trackId) → \(nid) gap=\(gap)ms")

			let previousFileLength = currentFile?.length ?? 0
			if let pn = playerNode, let nt = pn.lastRenderTime, nt.isSampleTimeValid,
			   let pt = pn.playerTime(forNodeTime: nt) {
				playerTimeBaseOffset = pt.sampleTime - currentFrameOffset
			} else {
				playerTimeBaseOffset += previousFileLength - currentFrameOffset
			}

			currentFile = nf
			currentTrackId = nid
			currentFrameOffset = 0
			nextFile = nil
			nextTrackId = nil
			isNextScheduled = false
			cachedPlaybackSeconds = 0
		} else {
			print("YhwavAudio: transition trackId=\(trackId) → end (no next scheduled)")
			_isPlaying = false
		}

		trackEndWallTime = now
		delegate?.enginePlayer(self, didFinishTrack: trackId)
	}

	// MARK: - Format handling

	private func reconnectIfNeeded(for file: AVAudioFile) {
		guard let engine = engine, let playerNode = playerNode, let timePitchNode = timePitchNode else { return }
		let fileFormat = file.processingFormat
		let currentFormat = playerNode.outputFormat(forBus: 0)

		let formatChanged = fileFormat.sampleRate != currentFormat.sampleRate || fileFormat.channelCount != currentFormat.channelCount
		guard formatChanged else { return }

		let wasRunning = engine.isRunning
		if wasRunning { engine.stop() }

		engine.disconnectNodeOutput(playerNode)
		engine.disconnectNodeOutput(timePitchNode)

		if let dsp = dspNode {
			engine.disconnectNodeOutput(dsp)
			engine.connect(playerNode, to: timePitchNode, format: fileFormat)
			engine.connect(timePitchNode, to: dsp, format: fileFormat)
			engine.connect(dsp, to: engine.mainMixerNode, format: fileFormat)
		} else {
			engine.connect(playerNode, to: timePitchNode, format: fileFormat)
			engine.connect(timePitchNode, to: engine.mainMixerNode, format: fileFormat)
		}

		print("YhwavAudio: engine reconnect format=\(fileFormat.sampleRate)Hz/\(fileFormat.channelCount)ch")

		if wasRunning {
			do { try engine.start() } catch {
				print("YhwavAudio: engine restart after reconnect failed: \(error)")
			}
		}
	}

	// MARK: - Level metering

	private func installLevelTap() {
		guard let engine = engine else { return }
		let mixer = engine.mainMixerNode
		let format = mixer.outputFormat(forBus: 0)
		guard format.sampleRate > 0 else { return }

		mixer.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
			guard let self = self, self._isPlaying else { return }
			let levels = Self.computeLevels(buffer: buffer, bandCount: 5)
			DispatchQueue.main.async {
				self.delegate?.enginePlayer(self, didUpdateLevels: levels)
			}
		}
	}

	private func stopLevelTap() {
		engine?.mainMixerNode.removeTap(onBus: 0)
	}

	static func computeLevels(buffer: AVAudioPCMBuffer, bandCount: Int) -> [Float] {
		guard let channelData = buffer.floatChannelData else {
			return [Float](repeating: 0, count: bandCount)
		}
		let frameLength = Int(buffer.frameLength)
		guard frameLength > 0 else { return [Float](repeating: 0, count: bandCount) }

		let samples = channelData[0]
		var bands = [Float](repeating: 0, count: bandCount)
		let bandFrames = max(1, frameLength / bandCount)

		for b in 0..<bandCount {
			let start = b * bandFrames
			let count = min(bandFrames, frameLength - start)
			guard count > 0 else { continue }
			var rms: Float = 0
			vDSP_rmsqv(samples.advanced(by: start), 1, &rms, vDSP_Length(count))
			bands[b] = min(1, max(0, rms * 4))
		}
		return bands
	}

	// MARK: - Audio interruptions

	private func observeInterruptions() {
		interruptionObserver = NotificationCenter.default.addObserver(
			forName: AVAudioSession.interruptionNotification,
			object: nil,
			queue: .main
		) { [weak self] notification in
			guard let info = notification.userInfo,
				  let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
				  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

			switch type {
			case .began:
				print("YhwavAudio: engine interrupted type=began")
				self?.pause()
			case .ended:
				print("YhwavAudio: engine interrupted type=ended")
				if let opts = info[AVAudioSessionInterruptionOptionKey] as? UInt,
				   AVAudioSession.InterruptionOptions(rawValue: opts).contains(.shouldResume) {
					self?.resume()
				}
			@unknown default:
				break
			}
		}

		routeChangeObserver = NotificationCenter.default.addObserver(
			forName: AVAudioSession.routeChangeNotification,
			object: nil,
			queue: .main
		) { [weak self] notification in
			guard let info = notification.userInfo,
				  let reasonValue = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
				  let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }

			print("YhwavAudio: engine route changed reason=\(reason.rawValue)")

			if reason == .oldDeviceUnavailable {
				self?.pause()
			}
		}
	}

	private func removeInterruptionObservers() {
		if let obs = interruptionObserver {
			NotificationCenter.default.removeObserver(obs)
			interruptionObserver = nil
		}
		if let obs = routeChangeObserver {
			NotificationCenter.default.removeObserver(obs)
			routeChangeObserver = nil
		}
	}

	deinit {
		teardown()
	}
}
