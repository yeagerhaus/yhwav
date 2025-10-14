/**
 * Convert a hex color and a decimal alpha to an 8-digit hex color (including alpha).
 *
 * @param hex - The input color in hex format. Examples: "#abc", "#AABBCC"
 * @param alpha - A number between 0 and 1 representing opacity.
 * @returns The resulting color in 8-digit hex format: "#RRGGBBAA".
 */
export function hexWithOpacity(hex: string, alpha: number): string {
	// 1. Normalize the `alpha` to be strictly within [0, 1].
	const clampedAlpha = Math.max(0, Math.min(1, alpha));

	// 2. Remove leading "#" if present.
	let cleanHex = hex.replace(/^#/, '');

	// 3. Validate (and if needed, expand) the hex code.
	//    - If it's a 3-character shorthand (e.g. "abc"), convert it to 6-digit form ("aabbcc").
	if (/^[0-9A-Fa-f]{3}$/.test(cleanHex)) {
		cleanHex = cleanHex
			.split('')
			.map((char) => char + char)
			.join('');
	} else if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
		// If it's neither 3-digit nor 6-digit valid hex, fall back to black or throw an error.
		// Here we simply default to "000000".
		cleanHex = '000000';
	}

	// 4. Separate out the R, G, B components.
	const r = cleanHex.slice(0, 2);
	const g = cleanHex.slice(2, 4);
	const b = cleanHex.slice(4, 6);

	// 5. Convert the alpha to a 2-digit hexadecimal.
	const alphaInt = Math.round(clampedAlpha * 255);
	const alphaHex = alphaInt.toString(16).padStart(2, '0');

	// 6. Combine everything into an 8-digit color code.
	return `#${r}${g}${b}${alphaHex}`;
}
