import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass, MapPin, Search, X } from 'lucide-react';
import { Category, Destination } from '../types/tourism.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { DestinationCard } from '../components/tourism/DestinationCard.tsx';

const PROVINCES = ['all', 'Kigali City', 'Northern', 'Southern', 'Eastern', 'Western'];

export const DiscoverPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, apiFetch, signInWithGoogle } = useAuth();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [province, setProvince] = useState(searchParams.get('province') || 'all');
  const [sort, setSort] = useState<'popular' | 'name'>('popular');

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ categories: Category[] }>('/api/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category !== 'all') params.set('category', category);
    if (province !== 'all') params.set('province', province);
    params.set('sort', sort);

    apiFetch<{ destinations: Destination[] }>(`/api/destinations?${params.toString()}`)
      .then((res) => {
        if (active) setDestinations(res.destinations);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load destinations');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, category, province, sort, apiFetch]);

  const syncUrlFilters = (nextCat: string, nextProv: string, nextQ: string) => {
    const p = new URLSearchParams();
    if (nextQ.trim()) p.set('q', nextQ.trim());
    if (nextCat !== 'all') p.set('category', nextCat);
    if (nextProv !== 'all') p.set('province', nextProv);
    setSearchParams(p, { replace: true });
  };

  const handleToggleFavorite = async (destinationId: number) => {
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    const res = await apiFetch<{ active: boolean }>('/api/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ destinationId, collectionType: 'favorite' }),
    });
    setDestinations((prev) =>
      prev.map((d) => (d.id === destinationId ? { ...d, isFavorited: res.active } : d))
    );
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setProvince('all');
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <header className="space-y-2 border-b border-[#E3E9E4] pb-6">
        <p className="text-xs font-semibold text-[#16865B]">Tourism Discovery Directory</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#123D2B]">
          Explore Destinations Across Rwanda
        </h1>
        <p className="text-sm text-[#69766E] max-w-2xl">
          Filter parks, volcanoes, lakes, museums, waterfalls, and cultural villages by region or
          interest.
        </p>
      </header>

      {/* Search & Province / Sort Toolbar */}
      <div className="bg-white border border-[#E3E9E4] rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative flex items-center">
            <Search className="w-4 h-4 text-[#69766E] absolute left-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                syncUrlFilters(category, province, e.target.value);
              }}
              placeholder="Search by destination name, district, or keyword..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                syncUrlFilters(category, e.target.value, query);
              }}
              aria-label="Filter by Province"
              className="w-full px-3 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
            >
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p === 'all' ? 'All 5 Provinces' : `${p} Province`}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'popular' | 'name')}
              aria-label="Sort destinations"
              className="w-full px-3 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
            >
              <option value="popular">Sort by Popularity</option>
              <option value="name">Sort Alphabetically (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setCategory('all');
              syncUrlFilters('all', province, query);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              category === 'all'
                ? 'bg-[#123D2B] text-white'
                : 'bg-[#FAF9F5] text-[#69766E] border border-[#E3E9E4] hover:text-[#123D2B]'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategory(cat.slug);
                syncUrlFilters(cat.slug, province, query);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                category === cat.slug
                  ? 'bg-[#123D2B] text-white'
                  : 'bg-[#FAF9F5] text-[#69766E] border border-[#E3E9E4] hover:text-[#123D2B]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-[#69766E]">
        <span className="tabular-nums">
          {loading ? 'Loading destinations...' : `${destinations.length} destinations found`}
        </span>
        {(query || category !== 'all' || province !== 'all') && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-[#16865B] font-medium hover:text-[#123D2B] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-white border border-red-200 text-red-700 rounded-xl p-5 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white border border-[#E3E9E4] rounded-xl h-80 animate-pulse" />
          ))}
        </div>
      ) : destinations.length === 0 ? (
        <div className="bg-white border border-[#E3E9E4] rounded-xl p-12 text-center space-y-4">
          <Compass className="w-10 h-10 text-[#69766E] mx-auto" />
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-semibold text-[#123D2B]">
              No destinations match your filters
            </h2>
            <p className="text-sm text-[#69766E]">
              Try clearing your search keyword or exploring all provinces across Rwanda.
            </p>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#123D2B] rounded-lg cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            <span>Show all destinations</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {destinations.map((dest) => (
            <DestinationCard
              key={dest.id}
              destination={dest}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
};
