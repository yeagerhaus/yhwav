import { execSync } from 'node:child_process';

async function main(): Promise<void> {
	try {
		console.log('📦 Installing dependencies...');
		execSync('bun install', { stdio: 'inherit' });

		console.log('🚀 Starting dev server...');
		execSync('expo start --dev-client', { stdio: 'inherit' });
	} catch (err: any) {
		console.error('❌ Error:', err.message);
	}
	// try {
	// 	console.log('📱 Running on iOS Simulator...');
	// 	execSync('npx expo run:ios', { stdio: 'inherit' });
	// } catch (err: any) {
	// 	console.error('❌ Error launching iOS simulator:', err.message);
	// }
}

main();
