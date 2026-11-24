import Foundation

/// Debug-only logging for the audio module. Release builds compile this to a no-op, so track ids, cache
/// paths and error details never reach the device log in production.
@inline(__always)
func yhLog(_ message: @autoclosure () -> String) {
	#if DEBUG
	print(message())
	#endif
}
