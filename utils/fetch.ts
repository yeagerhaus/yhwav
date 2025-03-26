import { apiURL, appVersion } from '@/constants';
import { type FetchRequestInit, fetch } from 'expo/fetch';

export type HttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export type FetchOptions = {
	sessionID?: string;
	headers?: Record<string, string>;
	noCache?: boolean;
	asText?: boolean;
	signal?: AbortSignal;
};

export type SuccessResponse<T> = [T, undefined];
export type ErrorResponse = [undefined, Error];
export type APIResponse<T> = SuccessResponse<T> | ErrorResponse;
export type UnresolvedAPIResponse<T> = Promise<APIResponse<T>>;

export type BodyType = Record<string, unknown> | string | FormData | Blob | ((req: Request) => any);

/**
 * Performs an HTTP request to the specified URL with the given parameters.
 *
 * @template T - The expected type of the successful response data.
 * @param {string} url - The endpoint URL. If it starts with '/', it's appended to the base `apiURL`.
 * @param {FetchOptions} [opts={}] - Additional options to configure the request.
 * @returns {Promise<[T | undefined, Error | undefined]>} - A promise that resolves to a tuple containing the response data (or text) and an error if any.
 *
 * @example
 * // Making a GET request
 * const [data, error] = await fetchAPI<User>('/users/1');
 *
 * Making a POST request with payload
 * const [data, error] = await fetchAPI<User>('/users', { name: 'John Doe', method: 'POST' });
 *
 *  Making a request with additional headers and disabling cache
 * const [data, error] = await fetchAPI('/data', 'GET', { headers: { Authorization: 'Bearer token' }, noCache: true });
 */
export async function fetchAPI<T = any>(
	url: string,
	method: HttpMethods = 'GET',
	body: any = null,
	opts: FetchOptions = {},
): UnresolvedAPIResponse<T> {
	if (url.startsWith('/')) url = apiURL + url;

	// Initialize the request configuration
	const req: FetchRequestInit = {
		method: method || 'GET',
		headers: {
			'Content-Type': body ? 'application/json' : '',
			'Cache-Control': opts.noCache ? 'no-cache, no-store, must-revalidate' : '',
			Pragma: opts.noCache ? 'no-cache' : '',
			Expires: opts.noCache ? '0' : '',
			'User-Agent': appVersion,
			...opts.headers,
		} as Record<string, string>,
		body: undefined as any,
		signal: opts.signal,
	};

	// Process the request body based on its type
	if (body) {
		req.body = body;
		if (body instanceof FormData || body instanceof Blob) {
			(req.headers as Record<string, string>)['Content-Type'] = 'multipart/form-data';
		} else if (body != null) {
			req.body = JSON.stringify(body);
		}
	}

	// console.log('fetch', url, method, req.body);

	try {
		// Perform fetch request
		const resp = await fetch(url, req);

		const responseBody = await resp.text();

		// If the response is unsuccessful and no body, generate an error message
		if (!responseBody && resp.status > 299) {
			return [undefined, new Error(`Error ${resp.status} ${resp.statusText}`)];
		}

		// Return raw text response if needed
		if (opts.asText) return [responseBody as T, undefined];
		// console.log('REQ', url, req, responseBody);
		// Try to parse JSON response
		try {
			const json = JSON.parse(responseBody);

			// Handle custom API error response format
			if (json.error) {
				return [undefined, new Error(json.error)];
			}

			if (json.errors && json.errors.length > 0) {
				const firstError = json.errors[0];
				const errorMessage = typeof firstError === 'object' ? firstError.message || firstError.code : firstError;
				return [undefined, new Error(errorMessage)];
			}

			return [json.data, undefined];
		} catch {
			// Handle JSON parsing errors
			return [undefined, new Error('Invalid JSON response')];
		}
	} catch (err: any) {
		// Handle fetch errors
		return [undefined, err];
	}
}
