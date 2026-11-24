module.exports = (api) => {
	api.cache(true);
	return {
		presets: ['babel-preset-expo'],
		env: {
			// Release bundles drop console.log/info/debug/warn; console.error stays for crash diagnostics.
			production: {
				plugins: [['transform-remove-console', { exclude: ['error'] }]],
			},
		},
	};
};
