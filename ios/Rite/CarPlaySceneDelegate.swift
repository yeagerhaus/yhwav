import CarPlay

/// Connects the CarPlay template scene to react-native-carplay (`RNCarPlay`).
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
	// iOS 16+ / iOS 26: preferred signature without window parameter
	func templateApplicationScene(
		_ templateApplicationScene: CPTemplateApplicationScene,
		didConnect interfaceController: CPInterfaceController
	) {
		RNCarPlay.connect(with: interfaceController, window: templateApplicationScene.carWindow)
	}

	// Legacy signature retained for older OS versions
	func templateApplicationScene(
		_ templateApplicationScene: CPTemplateApplicationScene,
		didConnect interfaceController: CPInterfaceController,
		to window: CPWindow
	) {
		RNCarPlay.connect(with: interfaceController, window: window)
	}

	func templateApplicationScene(
		_ templateApplicationScene: CPTemplateApplicationScene,
		didDisconnect interfaceController: CPInterfaceController,
		from window: CPWindow
	) {
		RNCarPlay.disconnect()
	}
}
