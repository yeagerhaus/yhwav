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

// MARK: - Shared DSP state (thread-safe, accessed from real-time audio thread)

final class AudioDSPState {
	static let shared = AudioDSPState()

	private let lock = os_unfair_lock_t.allocate(capacity: 1)

	private var _eqEnabled: Bool = false
	private var _eqBands: [(frequency: Float, gain: Float)] = []
	private var _outputGainLinear: Float = 1.0
	private var _normalizationEnabled: Bool = false
	private var _monoEnabled: Bool = false

	// Biquad filter state: 10 bands × 5 coefficients + delay state per channel
	private var _biquadCoefficients: [[Double]] = []
	private var _biquadDelaysL: [[Double]] = []
	private var _biquadDelaysR: [[Double]] = []
	private var _cachedSampleRate: Float = 0

	init() {
		lock.initialize(to: os_unfair_lock())
	}

	deinit {
		lock.deallocate()
	}

	var eqEnabled: Bool {
		os_unfair_lock_lock(lock); defer { os_unfair_lock_unlock(lock) }
		return _eqEnabled
	}

	var outputGainLinear: Float {
		os_unfair_lock_lock(lock); defer { os_unfair_lock_unlock(lock) }
		return _outputGainLinear
	}

	var normalizationEnabled: Bool {
		os_unfair_lock_lock(lock); defer { os_unfair_lock_unlock(lock) }
		return _normalizationEnabled
	}

	var monoEnabled: Bool {
		os_unfair_lock_lock(lock); defer { os_unfair_lock_unlock(lock) }
		return _monoEnabled
	}

	func setEqEnabled(_ v: Bool) {
		os_unfair_lock_lock(lock); _eqEnabled = v; os_unfair_lock_unlock(lock)
	}

	func setOutputGainDb(_ db: Float) {
		let linear = powf(10.0, db / 20.0)
		os_unfair_lock_lock(lock); _outputGainLinear = linear; os_unfair_lock_unlock(lock)
	}

	func setNormalizationEnabled(_ v: Bool) {
		os_unfair_lock_lock(lock); _normalizationEnabled = v; os_unfair_lock_unlock(lock)
	}

	func setMonoEnabled(_ v: Bool) {
		os_unfair_lock_lock(lock); _monoEnabled = v; os_unfair_lock_unlock(lock)
	}

	func setEqualizerBands(_ bands: [(frequency: Float, gain: Float)], sampleRate: Float) {
		os_unfair_lock_lock(lock)
		_eqBands = bands
		let needsRebuild = sampleRate != _cachedSampleRate || _biquadCoefficients.count != bands.count
		_cachedSampleRate = sampleRate
		if needsRebuild {
			_biquadDelaysL = bands.map { _ in [Double](repeating: 0, count: 4) }
			_biquadDelaysR = bands.map { _ in [Double](repeating: 0, count: 4) }
		}
		_biquadCoefficients = bands.map { Self.peakingEQCoefficients(frequency: $0.frequency, gainDb: $0.gain, q: 1.414, sampleRate: sampleRate) }
		os_unfair_lock_unlock(lock)
	}

	func resetFilterState() {
		os_unfair_lock_lock(lock)
		for i in 0..<_biquadDelaysL.count {
			_biquadDelaysL[i] = [Double](repeating: 0, count: 4)
			_biquadDelaysR[i] = [Double](repeating: 0, count: 4)
		}
		os_unfair_lock_unlock(lock)
	}

	/// Apply all DSP effects to the audio buffer in-place.
	/// Handles both interleaved (single buffer, mNumberChannels > 1) and
	/// non-interleaved/planar (multiple buffers, mNumberChannels == 1 each).
	func processAudio(_ bufferList: UnsafeMutablePointer<AudioBufferList>, frameCount: UInt32) {
		let list = UnsafeMutableAudioBufferListPointer(bufferList)
		let bufferCount = list.count
		guard bufferCount > 0, frameCount > 0 else { return }

		os_unfair_lock_lock(lock)
		let eqOn = _eqEnabled
		let coeffs = _biquadCoefficients
		let gainLinear = _outputGainLinear
		let normalize = _normalizationEnabled
		let mono = _monoEnabled
		os_unfair_lock_unlock(lock)

		let fc = Int(frameCount)
		let isNonInterleaved = bufferCount > 1

		if isNonInterleaved {
			processNonInterleaved(list: list, bufferCount: bufferCount, frameCount: fc,
				eqOn: eqOn, coeffs: coeffs, gainLinear: gainLinear, normalize: normalize, mono: mono)
		} else {
			processInterleaved(list: list, frameCount: fc,
				eqOn: eqOn, coeffs: coeffs, gainLinear: gainLinear, normalize: normalize, mono: mono)
		}
	}

	/// Non-interleaved (planar): each buffer is a separate channel.
	private func processNonInterleaved(list: UnsafeMutableAudioBufferListPointer, bufferCount: Int, frameCount: Int,
		eqOn: Bool, coeffs: [[Double]], gainLinear: Float, normalize: Bool, mono: Bool) {

		// 1. EQ: apply biquad cascade to each channel independently
		if eqOn && !coeffs.isEmpty {
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				let samples = mData.assumingMemoryBound(to: Float.self)
				applyEQSingleChannel(samples: samples, frameCount: frameCount, channelIndex: ch, coefficients: coeffs)
			}
		}

		// 2. Output gain
		if gainLinear != 1.0 {
			var g = gainLinear
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				let samples = mData.assumingMemoryBound(to: Float.self)
				vDSP_vsmul(samples, 1, &g, samples, 1, vDSP_Length(frameCount))
			}
		}

		// 3. Peak normalization / limiter: find global peak across all channels
		if normalize {
			var globalPeak: Float = 0
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				let samples = mData.assumingMemoryBound(to: Float.self)
				var peak: Float = 0
				vDSP_maxmgv(samples, 1, &peak, vDSP_Length(frameCount))
				if peak > globalPeak { globalPeak = peak }
			}
			if globalPeak > 1.0 {
				var scale = 1.0 / globalPeak
				for ch in 0..<bufferCount {
					guard let mData = list[ch].mData else { continue }
					let samples = mData.assumingMemoryBound(to: Float.self)
					vDSP_vsmul(samples, 1, &scale, samples, 1, vDSP_Length(frameCount))
				}
			}
		}

		// 4. Mono downmix: average all channels, write result to each
		if mono && bufferCount >= 2 {
			var avg = [Float](repeating: 0, count: frameCount)
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				let samples = mData.assumingMemoryBound(to: Float.self)
				vDSP_vadd(avg, 1, samples, 1, &avg, 1, vDSP_Length(frameCount))
			}
			var divisor = Float(bufferCount)
			vDSP_vsdiv(avg, 1, &divisor, &avg, 1, vDSP_Length(frameCount))
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				let samples = mData.assumingMemoryBound(to: Float.self)
				avg.withUnsafeBufferPointer { src in
					samples.update(from: src.baseAddress!, count: frameCount)
				}
			}
		}
	}

	/// Interleaved: single buffer with samples as LRLRLR...
	private func processInterleaved(list: UnsafeMutableAudioBufferListPointer, frameCount: Int,
		eqOn: Bool, coeffs: [[Double]], gainLinear: Float, normalize: Bool, mono: Bool) {
		guard let mData = list[0].mData else { return }
		let channelCount = Int(list[0].mNumberChannels)
		let totalSamples = frameCount * channelCount
		guard totalSamples > 0 else { return }
		let samples = mData.assumingMemoryBound(to: Float.self)

		// 1. EQ (deinterleave → process per channel → reinterleave)
		if eqOn && !coeffs.isEmpty {
			applyEQInterleaved(samples: samples, frameCount: frameCount, channelCount: channelCount, coefficients: coeffs)
		}

		// 2. Output gain
		if gainLinear != 1.0 {
			var g = gainLinear
			vDSP_vsmul(samples, 1, &g, samples, 1, vDSP_Length(totalSamples))
		}

		// 3. Peak normalization / limiter
		if normalize {
			var peak: Float = 0
			vDSP_maxmgv(samples, 1, &peak, vDSP_Length(totalSamples))
			if peak > 1.0 {
				var scale = 1.0 / peak
				vDSP_vsmul(samples, 1, &scale, samples, 1, vDSP_Length(totalSamples))
			}
		}

		// 4. Mono downmix
		if mono && channelCount >= 2 {
			for f in 0..<frameCount {
				let idx = f * channelCount
				var sum: Float = 0
				for ch in 0..<channelCount { sum += samples[idx + ch] }
				let avg = sum / Float(channelCount)
				for ch in 0..<channelCount { samples[idx + ch] = avg }
			}
		}
	}

	/// Apply EQ biquad cascade to a single non-interleaved channel buffer.
	private func applyEQSingleChannel(samples: UnsafeMutablePointer<Float>, frameCount: Int, channelIndex: Int, coefficients: [[Double]]) {
		os_unfair_lock_lock(lock)
		let useRight = channelIndex > 0
		let delays = useRight ? _biquadDelaysR : _biquadDelaysL
		guard delays.count == coefficients.count else {
			os_unfair_lock_unlock(lock)
			return
		}

		var channel = [Double](repeating: 0, count: frameCount)
		for i in 0..<frameCount { channel[i] = Double(samples[i]) }

		for b in 0..<coefficients.count {
			let c = coefficients[b]
			guard c.count == 5 else { continue }
			if useRight {
				_biquadDelaysR[b].withUnsafeMutableBufferPointer { delayBuf in
					Self.applyBiquad(c, delay: delayBuf.baseAddress!, data: &channel, count: frameCount)
				}
			} else {
				_biquadDelaysL[b].withUnsafeMutableBufferPointer { delayBuf in
					Self.applyBiquad(c, delay: delayBuf.baseAddress!, data: &channel, count: frameCount)
				}
			}
		}

		for i in 0..<frameCount { samples[i] = Float(channel[i]) }
		os_unfair_lock_unlock(lock)
	}

	/// Apply EQ to interleaved audio by deinterleaving, processing each channel, and reinterleaving.
	private func applyEQInterleaved(samples: UnsafeMutablePointer<Float>, frameCount: Int, channelCount: Int, coefficients: [[Double]]) {
		os_unfair_lock_lock(lock)
		guard _biquadDelaysL.count == coefficients.count else {
			os_unfair_lock_unlock(lock)
			return
		}

		if channelCount == 1 {
			var channel = [Double](repeating: 0, count: frameCount)
			for i in 0..<frameCount { channel[i] = Double(samples[i]) }
			for b in 0..<coefficients.count {
				let c = coefficients[b]
				guard c.count == 5 else { continue }
				_biquadDelaysL[b].withUnsafeMutableBufferPointer { delayBuf in
					Self.applyBiquad(c, delay: delayBuf.baseAddress!, data: &channel, count: frameCount)
				}
			}
			for i in 0..<frameCount { samples[i] = Float(channel[i]) }
		} else {
			var left = [Double](repeating: 0, count: frameCount)
			var right = [Double](repeating: 0, count: frameCount)
			for i in 0..<frameCount {
				left[i] = Double(samples[i * channelCount])
				right[i] = Double(samples[i * channelCount + 1])
			}
			for b in 0..<coefficients.count {
				let c = coefficients[b]
				guard c.count == 5 else { continue }
				_biquadDelaysL[b].withUnsafeMutableBufferPointer { delayBuf in
					Self.applyBiquad(c, delay: delayBuf.baseAddress!, data: &left, count: frameCount)
				}
				_biquadDelaysR[b].withUnsafeMutableBufferPointer { delayBuf in
					Self.applyBiquad(c, delay: delayBuf.baseAddress!, data: &right, count: frameCount)
				}
			}
			for i in 0..<frameCount {
				samples[i * channelCount] = Float(left[i])
				samples[i * channelCount + 1] = Float(right[i])
			}
		}
		os_unfair_lock_unlock(lock)
	}

	/// Direct-form II transposed biquad filter (single section).
	private static func applyBiquad(_ c: [Double], delay: UnsafeMutablePointer<Double>, data: inout [Double], count: Int) {
		let b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4]
		var z1 = delay[0], z2 = delay[1]

		for i in 0..<count {
			let x = data[i]
			let y = b0 * x + z1
			z1 = b1 * x - a1 * y + z2
			z2 = b2 * x - a2 * y
			data[i] = y
		}

		delay[0] = z1
		delay[1] = z2
	}

	/// Peaking EQ biquad coefficients (Audio EQ Cookbook by Robert Bristow-Johnson).
	/// Returns [b0/a0, b1/a0, b2/a0, a1/a0, a2/a0].
	private static func peakingEQCoefficients(frequency: Float, gainDb: Float, q: Float, sampleRate: Float) -> [Double] {
		let A = Double(powf(10.0, gainDb / 40.0))
		let w0 = 2.0 * Double.pi * Double(frequency) / Double(sampleRate)
		let sinW0 = sin(w0)
		let cosW0 = cos(w0)
		let alpha = sinW0 / (2.0 * Double(q))

		let b0 = 1.0 + alpha * A
		let b1 = -2.0 * cosW0
		let b2 = 1.0 - alpha * A
		let a0 = 1.0 + alpha / A
		let a1 = -2.0 * cosW0
		let a2 = 1.0 - alpha / A

		return [b0/a0, b1/a0, b2/a0, a1/a0, a2/a0]
	}
}

// MARK: - Module

public final class YhwavAudioModule: Module {
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

	// Audio processing tap: item we attached the tap to, so we can clear when switching
	private weak var itemWithAudioTap: AVPlayerItem?

	private lazy var nowPlayingManager = NowPlayingManager(module: self)

	// MARK: - Search index
	private struct SearchEntry {
		let id: String
		let titleLower: String
		let artistLower: String
		let albumLower: String
	}
	private var searchIndex: [SearchEntry] = []
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
			self.setupAudioTapForCurrentItem()
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
				self.teardownAudioTap()
				self.queuePlayer?.removeAllItems()
				self.trackMetadata.removeAll()
				self.trackOrder.removeAll()
				self.lastEmittedState = "stopped"
				AudioDSPState.shared.resetFilterState()
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
			DispatchQueue.main.sync {
				let currentIdx = self.currentActiveTrackIndex()
				self.suppressTrackChangeEvents = true

				if currentIdx >= 0 && index - currentIdx == 1 {
					// One step forward: advance without rebuild — no audio cut, preserves preload
					player.advanceToNextItem()
				} else {
					// Backward, multi-step, or unknown current: full rebuild
					self.rebuildQueueFromOrder(makeCurrentIndex: index)
				}

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

		// MARK: - Search

		AsyncFunction("buildSearchIndex") { (tracks: [[String: Any]]) in
			let entries: [SearchEntry] = tracks.compactMap { dict in
				guard let id = dict["id"] as? String else { return nil }
				let title = (dict["title"] as? String ?? "").lowercased()
				let artist = (dict["artist"] as? String ?? "").lowercased()
				let album = (dict["album"] as? String ?? "").lowercased()
				return SearchEntry(id: id, titleLower: title, artistLower: artist, albumLower: album)
			}
			self.searchQueue.sync {
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

					hits.append((id: entry.id, score: score))
					if hits.count >= limit * 2 { break }
				}
			}

			hits.sort { $0.score > $1.score }
			return Array(hits.prefix(limit)).map { ["id": $0.id, "score": $0.score] }
		}
	}

	// MARK: - Audio session

	private func configureAudioSession() {
		do {
			try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
			try AVAudioSession.sharedInstance().setActive(true)
		} catch {
			print("YhwavAudio: Failed to set audio session: \(error)")
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
				self?.setupAudioTapForCurrentItem()
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
		AudioDSPState.shared.resetFilterState()
		if repeatMode == 1 {
			if let id = item.associatedTrackId(), let idx = trackOrder.firstIndex(of: id) {
				rebuildQueueFromOrder(makeCurrentIndex: idx)
				queuePlayer?.rate = rate
			}
			return
		}
		if repeatMode == 2, !trackOrder.isEmpty {
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

	// MARK: - Audio processing tap (DSP + level metering)

	private func setupAudioTapForCurrentItem() {
		guard let player = queuePlayer, let item = player.currentItem else {
			teardownAudioTap()
			return
		}
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
		let context = AudioTapContext(module: self)
		var callbacks = MTAudioProcessingTapCallbacks(
			version: kMTAudioProcessingTapCallbacksVersion_0,
			clientInfo: Unmanaged.passRetained(context).toOpaque(),
			init: { _, clientInfo, tapStorageOut in
				tapStorageOut.pointee = clientInfo
			},
			finalize: { tap in
				let ptr = MTAudioProcessingTapGetStorage(tap)
				Unmanaged<AudioTapContext>.fromOpaque(ptr).release()
			},
			prepare: { _, _, _ in },
			unprepare: { _ in },
			process: { tap, numberFrames, _, bufferListInOut, numberFramesOut, flagsOut in
				guard noErr == MTAudioProcessingTapGetSourceAudio(tap, numberFrames, bufferListInOut, flagsOut, nil, numberFramesOut) else { return }

				// Apply DSP effects (EQ, gain, normalization, mono)
				AudioDSPState.shared.processAudio(bufferListInOut, frameCount: UInt32(numberFrames))

				// Level metering (runs after DSP so visualizer reflects processed output)
				let ptr = MTAudioProcessingTapGetStorage(tap)
				let ctx = Unmanaged<AudioTapContext>.fromOpaque(ptr).takeUnretainedValue()
				let levels = AudioTapContext.computeLevels(bufferListInOut, frameCount: UInt32(numberFrames), bandCount: 5)
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
		teardownAudioTap()
		currentItemObservation?.invalidate()
		if let obs = itemDidEndObserver {
			NotificationCenter.default.removeObserver(obs)
		}
	}
}

// MARK: - Audio tap context (DSP + level metering)

private final class AudioTapContext {
	weak var module: YhwavAudioModule?
	private var lastSendTime: CFTimeInterval = 0
	private let minInterval: CFTimeInterval = 0.06
	private let lock = NSLock()

	init(module: YhwavAudioModule) {
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

private let associatedTrackIdKey = UnsafeRawPointer(bitPattern: "yhwav_track_id".hashValue)!

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
	weak var module: YhwavAudioModule?
	private var capabilities: Set<String> = ["Play", "Pause", "SkipToNext", "SkipToPrevious", "SeekTo"]
	private var cachedArtworkUrl: String?
	private var cachedArtwork: MPMediaItemArtwork?

	init(module: YhwavAudioModule) {
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

