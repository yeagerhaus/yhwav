import 'dotenv/config';
import { execSync } from 'node:child_process';

const HOST_MODES = new Set(['lan', 'tunnel', 'localhost']);

function metroHost(): string {
	const h = process.env.EXPO_METRO_HOST ?? 'lan';
	return HOST_MODES.has(h) ? h : 'lan';
}

async function main(): Promise<void> {
	try {
		if (process.env.SKIP_BUN_INSTALL !== '1') {
			console.log('📦 Installing dependencies...');
			execSync('bun install', { stdio: 'inherit' });
		}

		const host = metroHost();
		const clear = process.env.EXPO_METRO_CLEAR === '1' ? ' --clear' : '';
		const packagerHost = process.env.REACT_NATIVE_PACKAGER_HOSTNAME?.trim();

		console.log(`🚀 Starting dev server (--host ${host})...`);
		if (host === 'tunnel') {
			console.log('   Using tunnel (works when LAN/hotspot picks the wrong IP).');
		}
		if (packagerHost) {
			console.log(`   REACT_NATIVE_PACKAGER_HOSTNAME=${packagerHost} (overrides auto-detected IP in QR / dev-client URL)`);
		} else if (host === 'lan') {
			console.log(
				'   Tip: if the URL shows the wrong IP (e.g. 172.20.10.x on hotspot), set REACT_NATIVE_PACKAGER_HOSTNAME in .env to your Mac’s Wi‑Fi IP.',
			);
		}

		execSync(`bunx expo start --dev-client --host ${host}${clear}`, {
			stdio: 'inherit',
			env: process.env,
		});
	} catch (err: any) {
		console.error('❌ Error:', err.message);
	}
}

main();
