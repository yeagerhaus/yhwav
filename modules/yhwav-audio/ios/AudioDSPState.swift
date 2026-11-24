import Accelerate
import AVFoundation
import os

/// Shared DSP state: EQ, output gain, peak limiting ("normalization") and mono, applied inside the
/// engine's custom render unit.
///
/// Real-time safety: `processAudio` runs on the audio render thread, so it never allocates, never
/// blocks, and never touches Swift collections. Control-side setters write *pending* parameters under a
/// lock; the render thread picks them up with `os_unfair_lock_trylock` (skipping the update for one
/// buffer if the lock is momentarily held) and copies them into render-owned, preallocated storage.
final class AudioDSPState {
	static let shared = AudioDSPState()

	private static let maxBands = 16
	private static let maxChannels = 8
	private static let coeffsPerBand = 5

	private let lock = os_unfair_lock_t.allocate(capacity: 1)

	// MARK: Control-side (pending) parameters — guarded by `lock`
	private var pendingEqEnabled = false
	private var pendingGainLinear: Float = 1.0
	private var pendingNormalize = false
	private var pendingMono = false
	private var pendingBandCount = 0
	private let pendingCoeffs: UnsafeMutablePointer<Double>
	private var pendingTrackGainLinear: Float = 1.0
	private var pendingVersion: UInt64 = 0
	private var pendingResetFilters = false

	// MARK: Render-side state — touched only on the render thread
	private var renderVersion: UInt64 = .max
	private var rEqEnabled = false
	private var rGainLinear: Float = 1.0
	private var rNormalize = false
	private var rMono = false
	private var rBandCount = 0
	/// Normalization: per-track ReplayGain target and the smoothed gain actually applied.
	private var rTrackGainTarget: Float = 1.0
	private var rTrackGainCurrent: Float = 1.0
	/// Safety limiter gain (≤ 1), with instant attack and slow release.
	private var rLimiterGain: Float = 1.0
	private let rCoeffs: UnsafeMutablePointer<Double>
	/// Biquad delay state: [channel][band][z1, z2].
	private let delays: UnsafeMutablePointer<Double>

	init() {
		lock.initialize(to: os_unfair_lock())
		let coeffCount = Self.maxBands * Self.coeffsPerBand
		pendingCoeffs = .allocate(capacity: coeffCount)
		pendingCoeffs.initialize(repeating: 0, count: coeffCount)
		rCoeffs = .allocate(capacity: coeffCount)
		rCoeffs.initialize(repeating: 0, count: coeffCount)
		let delayCount = Self.maxChannels * Self.maxBands * 2
		delays = .allocate(capacity: delayCount)
		delays.initialize(repeating: 0, count: delayCount)
	}

	deinit {
		pendingCoeffs.deallocate()
		rCoeffs.deallocate()
		delays.deallocate()
		lock.deinitialize(count: 1)
		lock.deallocate()
	}

	// MARK: - Control API (any thread except render)

	private func update(_ body: () -> Void) {
		os_unfair_lock_lock(lock)
		body()
		pendingVersion &+= 1
		os_unfair_lock_unlock(lock)
	}

	func setEqEnabled(_ v: Bool) {
		update { pendingEqEnabled = v }
	}

	func setOutputGainDb(_ db: Float) {
		let linear = powf(10.0, db / 20.0)
		update { pendingGainLinear = linear }
	}

	func setNormalizationEnabled(_ v: Bool) {
		update { pendingNormalize = v }
	}

	func setMonoEnabled(_ v: Bool) {
		update { pendingMono = v }
	}

	/// Per-track loudness gain (ReplayGain, dB) applied when normalization is on. Smoothed on the render
	/// thread so track changes and crossfades don't jump in level.
	func setTrackGainDb(_ db: Float?) {
		let clamped = max(-15, min(12, db ?? 0))
		let linear = powf(10.0, clamped / 20.0)
		update { pendingTrackGainLinear = linear }
	}

	func setEqualizerBands(_ bands: [(frequency: Float, gain: Float)], sampleRate: Float) {
		let clipped = Array(bands.prefix(Self.maxBands))
		update {
			if clipped.count != pendingBandCount { pendingResetFilters = true }
			pendingBandCount = clipped.count
			for (b, band) in clipped.enumerated() {
				let c = Self.peakingEQCoefficients(frequency: band.frequency, gainDb: band.gain, q: 1.414, sampleRate: sampleRate)
				for k in 0..<Self.coeffsPerBand {
					pendingCoeffs[b * Self.coeffsPerBand + k] = c[k]
				}
			}
		}
	}

	func resetFilterState() {
		update { pendingResetFilters = true }
	}

	// MARK: - Render thread

	/// Apply all DSP effects to the audio buffer in place. Called on the real-time render thread.
	func processAudio(_ bufferList: UnsafeMutablePointer<AudioBufferList>, frameCount: UInt32) {
		let list = UnsafeMutableAudioBufferListPointer(bufferList)
		let bufferCount = list.count
		guard bufferCount > 0, frameCount > 0 else { return }

		syncParametersIfPossible()

		let fc = Int(frameCount)
		if bufferCount > 1 {
			processNonInterleaved(list: list, bufferCount: bufferCount, frameCount: fc)
		} else {
			processInterleaved(list: list, frameCount: fc)
		}
	}

	/// Copy pending parameters into render-owned storage without ever blocking the render thread.
	private func syncParametersIfPossible() {
		guard os_unfair_lock_trylock(lock) else { return }
		if pendingVersion != renderVersion {
			rEqEnabled = pendingEqEnabled
			rGainLinear = pendingGainLinear
			rNormalize = pendingNormalize
			rMono = pendingMono
			rTrackGainTarget = pendingTrackGainLinear
			rBandCount = pendingBandCount
			rCoeffs.update(from: pendingCoeffs, count: Self.maxBands * Self.coeffsPerBand)
			if pendingResetFilters {
				delays.update(repeating: 0, count: Self.maxChannels * Self.maxBands * 2)
				pendingResetFilters = false
			}
			renderVersion = pendingVersion
		}
		os_unfair_lock_unlock(lock)
	}

	/// Run the EQ cascade in place over one channel. `stride` is 1 for planar data or the channel count
	/// for interleaved data.
	private func applyEQ(samples: UnsafeMutablePointer<Float>, frameCount: Int, stride: Int, channel: Int) {
		let ch = min(channel, Self.maxChannels - 1)
		for b in 0..<rBandCount {
			let c = rCoeffs + b * Self.coeffsPerBand
			let b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4]
			let d = delays + (ch * Self.maxBands + b) * 2
			var z1 = d[0], z2 = d[1]
			var i = 0
			for _ in 0..<frameCount {
				let x = Double(samples[i])
				let y = b0 * x + z1
				z1 = b1 * x - a1 * y + z2
				z2 = b2 * x - a2 * y
				samples[i] = Float(y)
				i += stride
			}
			d[0] = z1
			d[1] = z2
		}
	}

	private func processNonInterleaved(list: UnsafeMutableAudioBufferListPointer, bufferCount: Int, frameCount: Int) {
		if rEqEnabled && rBandCount > 0 {
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				applyEQ(samples: mData.assumingMemoryBound(to: Float.self), frameCount: frameCount, stride: 1, channel: ch)
			}
		}

		if rGainLinear != 1.0 {
			var g = rGainLinear
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				let samples = mData.assumingMemoryBound(to: Float.self)
				vDSP_vsmul(samples, 1, &g, samples, 1, vDSP_Length(frameCount))
			}
		}

		if rNormalize {
			// 1) Smoothed per-track loudness gain.
			let (gStart, gEnd) = advanceTrackGain(frameCount: frameCount)
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				applyRamp(mData.assumingMemoryBound(to: Float.self), frameCount: frameCount, stride: 1, from: gStart, to: gEnd)
			}
			// 2) Safety limiter against clipping from positive gain.
			var globalPeak: Float = 0
			for ch in 0..<bufferCount {
				guard let mData = list[ch].mData else { continue }
				var peak: Float = 0
				vDSP_maxmgv(mData.assumingMemoryBound(to: Float.self), 1, &peak, vDSP_Length(frameCount))
				if peak > globalPeak { globalPeak = peak }
			}
			let (lStart, lEnd) = advanceLimiter(peak: globalPeak, frameCount: frameCount)
			if lStart < 1 || lEnd < 1 {
				for ch in 0..<bufferCount {
					guard let mData = list[ch].mData else { continue }
					applyRamp(mData.assumingMemoryBound(to: Float.self), frameCount: frameCount, stride: 1, from: lStart, to: lEnd)
				}
			}
		} else {
			rTrackGainCurrent = 1
			rLimiterGain = 1
		}

		if rMono && bufferCount >= 2 {
			// Average across channels frame by frame — no scratch buffer needed.
			let divisor = Float(bufferCount)
			for i in 0..<frameCount {
				var sum: Float = 0
				for ch in 0..<bufferCount {
					if let mData = list[ch].mData { sum += mData.assumingMemoryBound(to: Float.self)[i] }
				}
				let avg = sum / divisor
				for ch in 0..<bufferCount {
					if let mData = list[ch].mData { mData.assumingMemoryBound(to: Float.self)[i] = avg }
				}
			}
		}
	}

	private func processInterleaved(list: UnsafeMutableAudioBufferListPointer, frameCount: Int) {
		guard let mData = list[0].mData else { return }
		let channelCount = Int(list[0].mNumberChannels)
		let totalSamples = frameCount * channelCount
		guard totalSamples > 0 else { return }
		let samples = mData.assumingMemoryBound(to: Float.self)

		if rEqEnabled && rBandCount > 0 {
			for ch in 0..<min(channelCount, Self.maxChannels) {
				applyEQ(samples: samples + ch, frameCount: frameCount, stride: channelCount, channel: ch)
			}
		}

		if rGainLinear != 1.0 {
			var g = rGainLinear
			vDSP_vsmul(samples, 1, &g, samples, 1, vDSP_Length(totalSamples))
		}

		if rNormalize {
			let (gStart, gEnd) = advanceTrackGain(frameCount: frameCount)
			for ch in 0..<channelCount {
				applyRamp(samples + ch, frameCount: frameCount, stride: channelCount, from: gStart, to: gEnd)
			}
			var peak: Float = 0
			vDSP_maxmgv(samples, 1, &peak, vDSP_Length(totalSamples))
			let (lStart, lEnd) = advanceLimiter(peak: peak, frameCount: frameCount)
			if lStart < 1 || lEnd < 1 {
				for ch in 0..<channelCount {
					applyRamp(samples + ch, frameCount: frameCount, stride: channelCount, from: lStart, to: lEnd)
				}
			}
		} else {
			rTrackGainCurrent = 1
			rLimiterGain = 1
		}

		if rMono && channelCount >= 2 {
			for f in 0..<frameCount {
				let idx = f * channelCount
				var sum: Float = 0
				for ch in 0..<channelCount { sum += samples[idx + ch] }
				let avg = sum / Float(channelCount)
				for ch in 0..<channelCount { samples[idx + ch] = avg }
			}
		}
	}

	// MARK: - Gain smoothing (render thread)

	/// One-pole smoothing coefficient for a time constant, from the buffer length (assumes ~44.1–48 kHz).
	private func smoothing(frameCount: Int, seconds: Float) -> Float {
		1 - expf(-Float(frameCount) / (46_000 * seconds))
	}

	/// Moves the applied track gain toward its target (~300 ms) and returns the ramp for this buffer.
	private func advanceTrackGain(frameCount: Int) -> (Float, Float) {
		let start = rTrackGainCurrent
		rTrackGainCurrent += (rTrackGainTarget - rTrackGainCurrent) * smoothing(frameCount: frameCount, seconds: 0.3)
		return (start, rTrackGainCurrent)
	}

	/// Limiter: clamp instantly when the buffer would clip (attack), recover slowly (~1 s release).
	private func advanceLimiter(peak: Float, frameCount: Int) -> (Float, Float) {
		let start = rLimiterGain
		let needed: Float = peak > 1 ? 1 / peak : 1
		if needed < rLimiterGain {
			rLimiterGain = needed
			// Attack: apply the reduction for the whole buffer so nothing clips.
			return (needed, needed)
		}
		rLimiterGain += (needed - rLimiterGain) * smoothing(frameCount: frameCount, seconds: 1.0)
		return (start, rLimiterGain)
	}

	/// Multiply one channel by a gain that ramps linearly from `from` to `to` across the buffer.
	private func applyRamp(_ samples: UnsafeMutablePointer<Float>, frameCount: Int, stride: Int, from: Float, to: Float) {
		if from == 1 && to == 1 { return }
		let step = frameCount > 1 ? (to - from) / Float(frameCount - 1) : 0
		var g = from
		var i = 0
		for _ in 0..<frameCount {
			samples[i] *= g
			g += step
			i += stride
		}
	}

	// MARK: - Coefficients (control side)

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

		return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
	}
}
