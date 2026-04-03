import CarPlay

/// Connects the CarPlay template scene to react-native-carplay (`RNCarPlay`).
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
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
