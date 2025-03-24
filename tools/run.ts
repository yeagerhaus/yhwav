import { execSync } from 'node:child_process';

async function main(): Promise<void> {
    try {
		console.log('Running command: bun i');
		execSync('bun i', { stdio: 'inherit' });
	} catch (err: any) {
		console.error('Error executing command:', err.message);
	}

    try {
		console.log(`Running command: expo start -c`);
		execSync('expo start -c', { stdio: 'inherit' });
	} catch (err: any) {
		console.error('Error executing command:', err.message);
	}
}

main();
