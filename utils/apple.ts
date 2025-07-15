export async function fetchArtistInfoFromApple(artistName: string): Promise<{
    image?: string;
    artistLinkUrl?: string;
} | null> {
    try {
        const res = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`
        );
        const json = await res.json();

        const album = json.results?.[0];
        if (!album) return null;

        const highResArtwork = album.artworkUrl100?.replace('100x100bb.jpg', '512x512bb.jpg');

        return {
        image: highResArtwork,
        artistLinkUrl: album.artistViewUrl,
        };
    } catch (err) {
        console.warn(`Apple Music lookup failed for ${artistName}`, err);
        return null;
    }
}
