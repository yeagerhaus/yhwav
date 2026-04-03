import UIKit

/// Attaches the AppDelegate-created `UIWindow` to the phone's `UIWindowScene`.
///
/// With only a CarPlay entry in `UIApplicationSceneManifest`, iOS never provides a window scene for
/// the phone UI; a legacy `UIWindow(frame:)` then stays off-screen (black). Dev launcher still needs
/// the window to exist and be key in `didFinishLaunching`, so we only associate the scene here —
/// we do not create a second window or React root.
final class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
	func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
		guard let windowScene = scene as? UIWindowScene else { return }
		guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
		guard let window = appDelegate.window else { return }

		window.windowScene = windowScene
		window.frame = windowScene.coordinateSpace.bounds
		if !window.isKeyWindow {
			window.makeKeyAndVisible()
		}
	}
}
