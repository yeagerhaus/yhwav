import { type DependencyList, useEffect } from 'react';

type InitFn<T> = () => Promise<T | undefined> | T | undefined;
type DoneFn<T> = (v?: T, err?: Error) => Promise<void>;
// useAsyncEffect is a custom hook that allows you to use async/await in useEffect,
// then calls onDone when the async function is done if useEffect haven't been canceled.
export function useAsyncEffect<T>(init: InitFn<T>, deps: DependencyList = [], onDone?: DoneFn<T> | null) {
	useEffect(() => {
		let canceled = false;

		(async () => {
			try {
				const v = await init();
				if (v == null) return;
				if (!canceled && onDone) await onDone(v);
			} catch (err: any) {
				console.error('async error', err);
				if (!canceled && onDone) await onDone(undefined, err);
			}
		})();

		return () => {
			canceled = true;
		};
	}, deps);
}
