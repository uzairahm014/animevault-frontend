import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

export default function AnimeEpisodes() {
  const [searchQuery, setSearchQuery] = useState('');
  const [animeResults, setAnimeResults] = useState([]);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [activeEmbedUrl, setActiveEmbedUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Load Trending Anime Automatically On Mount
  useEffect(() => {
    async function loadTrending() {
      setLoading(true);
      try {
        const res = await fetch('https://vercel.app');
        const json = await res.json();
        setAnimeResults(json.results || []);
      } catch (err) {
        console.error("Failed syncing streaming library aggregator:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrending();
  }, []);

  // 2. Automated Global Library Search Query handler
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://vercel.app{encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      setAnimeResults(json.results || []);
      setSelectedAnime(null);
      setEpisodes([]);
      setActiveEmbedUrl('');
    } catch (err) {
      console.error("Search query execution node failure:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Full Dynamic Episode List for Selected Anime Node
  const handleSelectAnime = async (anime) => {
    setSelectedAnime(anime);
    setLoading(true);
    try {
      const res = await fetch(`https://vercel.app{anime.id}`);
      const json = await res.json();
      setEpisodes(json.episodes || []);
      if (json.episodes && json.episodes.length > 0) {
        handleSelectEpisode(json.episodes[0].id);
      }
    } catch (err) {
      console.error("Failed extracting track library profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  // 4. Fetch Secure Direct Streaming Player Context
  const handleSelectEpisode = async (episodeId) => {
    try {
      const res = await fetch(`https://vercel.app{episodeId}`);
      const json = await res.json();
      if (json.headers?.Referer) {
        setActiveEmbedUrl(json.headers.Referer);
      } else if (json.sources && json.sources.length > 0) {
        setActiveEmbedUrl(json.sources[0].url);
      } else if (json.download) {
        setActiveEmbedUrl(json.download);
      }
    } catch (err) {
      console.error("Failed compiling episode stream context source:", err);
    }
  };

  return (
    <div className="w-full text-white bg-zinc-950/40 p-2 rounded-xl border border-zinc-900">
      
      {/* Universal Search Controller */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto mb-6 mt-2">
        <div className="relative flex-grow">
          <Search size={16} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search thousands of automated titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded bg-zinc-900 border border-zinc-800 text-xs focus:outline-none focus:border-red-500 text-zinc-200"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-xs font-bold rounded transition">
          Query
        </button>
      </form>

      {loading && <div className="text-center py-10 text-zinc-500 text-xs tracking-widest uppercase">Syncing Cloud Media Array...</div>}

      {!loading && !selectedAnime && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {animeResults.map((anime) => (
            <div 
              key={anime.id} 
              onClick={() => handleSelectAnime(anime)}
              className="bg-zinc-900/50 border border-zinc-900 rounded-lg overflow-hidden group cursor-pointer hover:border-red-500/40 transition duration-300"
            >
              <div className="aspect-[3/4] relative bg-zinc-950">
                <img src={anime.image} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
              </div>
              <div className="p-2.5">
                <h4 className="font-semibold text-xs line-clamp-1 text-zinc-200 group-hover:text-red-400 transition">{anime.title}</h4>
                {anime.episodeNumber && <p className="text-[10px] text-zinc-500 mt-0.5">Episode {anime.episodeNumber}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && selectedAnime && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Streaming Output Screen Window */}
          <div className="lg:col-span-2">
            {activeEmbedUrl ? (
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-900 shadow-2xl">
                <iframe
                  src={activeEmbedUrl}
                  className="absolute top-0 left-0 w-full h-full border-0"
                  allowFullScreen
                  scrolling="no"
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              </div>
            ) : (
              <div className="w-full aspect-video bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 text-xs">
                Extracting encrypted cloud distribution link nodes...
              </div>
            )}
            <div className="mt-4 px-1">
              <button 
                onClick={() => setSelectedAnime(null)} 
                className="text-[10px] uppercase font-bold text-red-500 hover:underline mb-2 block"
              >
                ← Return to Library Catalog
              </button>
              <h2 className="text-lg font-bold text-zinc-100">{selectedAnime.title}</h2>
            </div>
          </div>

          {/* Automated Running Tracklist Segment Panel */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 max-h-[400px] overflow-y-auto">
            <h3 className="font-bold text-[10px] tracking-wider text-red-500 uppercase mb-3">Episode Selection</h3>
            <div className="grid grid-cols-4 gap-2">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep.id)}
                  className="bg-zinc-950 border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-white py-2 rounded text-center text-xs font-medium transition"
                >
                  {ep.number}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}