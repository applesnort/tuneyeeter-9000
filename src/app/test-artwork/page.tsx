import { getCustomSession } from "@/lib/auth-utils";
import { redirect } from "next/navigation";

export default async function TestArtwork() {
  const session = await getCustomSession();
  
  if (!session) {
    redirect("/");
  }

  // Fetch first track from playlist
  const playlistResponse = await fetch(
    `https://api.spotify.com/v1/playlists/6lf0FyFnEoN7THbDebLJ8R/tracks?limit=1`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    }
  );

  if (!playlistResponse.ok) {
    return <div>Failed to fetch playlist</div>;
  }

  const playlistData = await playlistResponse.json();
  const firstTrack = playlistData.items[0]?.track;

  if (!firstTrack) {
    return <div>No tracks in playlist</div>;
  }

  // Search Apple Music
  const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
    firstTrack.name + " " + firstTrack.artists[0].name
  )}&entity=song&limit=5`;
  
  const appleResponse = await fetch(searchUrl);
  const appleData = await appleResponse.json();
  const appleTrack = appleData.results?.[0];

  // Get artwork URLs
  const spotifyArtUrl = firstTrack.album.images?.[0]?.url;
  const appleArtUrl = appleTrack?.artworkUrl100?.replace('100x100', '600x600');

  let comparisonResult = null;
  if (spotifyArtUrl && appleArtUrl) {
    try {
      const compareResponse = await fetch(
        `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/compare-artwork`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url1: spotifyArtUrl,
            url2: appleArtUrl,
          }),
        }
      );

      if (compareResponse.ok) {
        comparisonResult = await compareResponse.json();
      }
    } catch (error) {
      console.error("Comparison error:", error);
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Artwork Comparison Test</h1>
        
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Spotify Track</h2>
            <p className="font-medium">{firstTrack.name}</p>
            <p className="text-gray-600">{firstTrack.artists.map((a: any) => a.name).join(", ")}</p>
            <p className="text-gray-500">{firstTrack.album.name}</p>
            {spotifyArtUrl && (
              <img src={spotifyArtUrl} alt="Spotify artwork" className="mt-4 w-64 h-64" />
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Apple Music Match</h2>
            {appleTrack ? (
              <>
                <p className="font-medium">{appleTrack.trackName}</p>
                <p className="text-gray-600">{appleTrack.artistName}</p>
                <p className="text-gray-500">{appleTrack.collectionName}</p>
                {appleArtUrl && (
                  <img src={appleArtUrl} alt="Apple artwork" className="mt-4 w-64 h-64" />
                )}
              </>
            ) : (
              <p>No match found</p>
            )}
          </div>
        </div>

        {comparisonResult && (
          <div className="mt-8 p-6 bg-white rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Comparison Result</h3>
            <p className="text-3xl font-bold text-green-600">
              {comparisonResult.similarity?.toFixed(1)}% Similar
            </p>
            {comparisonResult.error && (
              <p className="text-red-600 mt-2">Error: {comparisonResult.error}</p>
            )}
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2">Debug Info</h3>
          <pre className="bg-white p-4 rounded text-xs overflow-auto">
{JSON.stringify({
  spotify: {
    name: firstTrack.name,
    artworkUrl: spotifyArtUrl
  },
  apple: {
    name: appleTrack?.trackName,
    artworkUrl: appleArtUrl
  },
  comparison: comparisonResult
}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}