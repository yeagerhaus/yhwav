import { execSync } from 'node:child_process';

async function main(): Promise<void> {
	try {
		console.log('📦 Installing dependencies with bun...');
		execSync('bun i', { stdio: 'inherit' });
	} catch (err: any) {
		console.error('❌ Error installing dependencies:', err.message);
	}

	try {
		console.log('🚀 Starting Metro bundler in background...');
		execSync('expo start -c &', { stdio: 'inherit', shell: '/bin/bash' });
	} catch (err: any) {
		console.error('❌ Error starting Metro:', err.message);
	}

	try {
		console.log('📱 Running on iOS Simulator...');
		execSync('npx expo run:ios', { stdio: 'inherit' });
	} catch (err: any) {
		console.error('❌ Error launching iOS simulator:', err.message);
	}
}

main();
