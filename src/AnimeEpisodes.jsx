import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

export default function AnimeEpisodes() {
  const [searchQuery, setSearchQuery] = useState('');
  const [animeResults, setAnimeResults] = useState([]);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [activeEmbedUrl, setActiveEmbedUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Fetch Trending Anime Directly on Page Mount (Anilist GraphQL Engine)
  useEffect(() => {
    async function loadTrending() {
      setLoading(true);
      const query = `
        query {
          Page(page: 1, perPage: 20) {
            media(status: RELEASING, type: ANIME, sort: TRENDING_DESC) {
              id
              title { english romaji }
              coverImage { large }
              episodes
            }
          }
        }
      `;
      try {
        const res = await fetch('https://anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query })
        });
        const json = await res.json();
        const items = json.data?.Page?.media || [];
        
        const normalized = items.map(item => ({
          id: item.id,
          title: item.title.english || item.title.romaji,
          image: item.coverImage.large,
          totalEpisodes: item.episodes || 12,
          slugName: (item.title.english || item.title.romaji).toLowerCase().replace(/[^a-z0-9]+/g, '-')
        }));
        setAnimeResults(normalized);
      } catch (err) {
        console.error("Anilist extraction engine failure:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrending();
  }, []);

  // 2. Global Multi-Million Title Search Query Handler
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    
    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 25) {
          media(search: $search, type: ANIME) {
            id
            title { english romaji }
            coverImage { large }
            episodes
          }
        }
      }
    `;
    try {
      const res = await fetch('https://anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { search: searchQuery } })
      });
      const json = await res.json();
      const items = json.data?.Page?.media || [];
      
      const normalized = items.map(item => ({
        id: item.id,
        title: item.title.english || item.title.romaji,
        image: item.coverImage.large,
        totalEpisodes: item.episodes || 12,
        slugName: (item.title.english || item.title.romaji).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      }));
      
      setAnimeResults(normalized);
      setSelectedAnime(null);
      setEpisodes([]);
      setActiveEmbedUrl('');
    } catch (err) {
      console.error("Anilist query execution failure:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Build Episode Selector Cards Locally
  const handleSelectAnime = (anime) => {
    setSelectedAnime(anime);
    
    const epList = [];
    for (let i = 1; i <= anime.totalEpisodes; i++) {
      epList.push({ number: i });
    }
    setEpisodes(epList);
    
    if (epList.length > 0) {
      handleSelectEpisode(anime.slugName, 1);
    }
  };

  // 4. Inject Premium Direct Streaming Source Embeds
  const handleSelectEpisode = (slugName, episodeNumber) => {
    // Connects to the high-speed unlocked streaming gateway index
    const streamTarget = `https://vidsrc.to{slugName}/${episodeNumber}`;
    setActiveEmbedUrl(streamTarget);
  };

  return (
    <div className="w-full text-white bg-zinc-950/40 p-2 rounded-xl border border-zinc-900 mt-4">
      
      {/* Universal Search Controller */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto mb-6 mt-2">
        <div className="relative flex-grow">
          <Search size={16} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search every anime in the world instantly..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded bg-zinc-900 border border-zinc-800 text-xs focus:outline-none focus:border-red-500 text-zinc-200"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-xs font-bold rounded transition">
          Search
        </button>
      </form>

      {loading && <div className="text-center py-10 text-zinc-500 text-xs tracking-widest uppercase">Querying Anilist Cluster Network...</div>}

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
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && selectedAnime && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Secure Dynamic Web Player Window */}
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
                Establishing streaming payload uplink connection...
              </div>
            )}
            <div className="mt-4 px-1">
              <button 
                onClick={() => { setSelectedAnime(null); setActiveEmbedUrl(''); }} 
                className="text-[10px] uppercase font-bold text-red-500 hover:underline mb-2 block"
              >
                ← Return to Library Catalog
              </button>
              <h2 className="text-lg font-bold text-zinc-100">{selectedAnime.title}</h2>
            </div>
          </div>

          {/* Chronological Episode Selector Grid */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 max-h-[400px] overflow-y-auto">
            <h3 className="font-bold text-[10px] tracking-wider text-red-500 uppercase mb-3">Select Episode</h3>
            <div className="grid grid-cols-4 gap-2">
              {episodes.map((ep) => (
                <button
                  key={ep.number}
                  onClick={() => handleSelectEpisode(selectedAnime.slugName, ep.number)}
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