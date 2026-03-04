const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// Force all react-navigation packages to resolve to the single top-level instance.
// expo-router ships its own nested copies of these packages, which causes duplicate
// React context objects (e.g. PreventRemoveContext) that don't match, crashing at runtime.
config.resolver.extraNodeModules = {
	'@react-navigation/native': path.resolve(__dirname, 'node_modules/@react-navigation/native'),
	'@react-navigation/core': path.resolve(__dirname, 'node_modules/@react-navigation/core'),
	'@react-navigation/native-stack': path.resolve(__dirname, 'node_modules/@react-navigation/native-stack'),
};

module.exports = config;
