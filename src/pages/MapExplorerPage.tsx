import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bike,
  Car,
  Footprints,
  List,
  Map as MapIcon,
  MapPin,
  Navigation,
  Search,
} from 'lucide-react';
import { Accommodation, Category, Destination, RouteResult } from '../types/tourism.ts';
import { RWANDA_TRANSPORT_HUBS, RwandaMap } from '../components/map/RwandaMap.tsx';
import { SafeImage } from '../components/ui/SafeImage.tsx';

interface NominatimPlace {
  placeId: number;
  displayName: string;
  shortName: string;
  latitude: number;
  longitude: number;
  type: string;
}

export const MapExplorerPage: React.FC = () => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAccommodations, setShowAccommodations] = useState(true);
  const [showTransportHubs, setShowTransportHubs] = useState(true);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  const [selectedDest, setSelectedDest] = useState<Destination | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);

  // Nominatim Geocoding results
  const [geoResults, setGeoResults] = useState<NominatimPlace[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  // OSRM Route Calculator
  const [originKey, setOriginKey] = useState('hub:0');
  const [targetDestId, setTargetDestId] = useState<string>('');
  const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'cycling'>('driving');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/destinations').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/accommodations').then((r) => r.json()),
    ])
      .then(([d, c, a]) => {
        setDestinations(d.destinations || []);
        setCategories(c.categories || []);
        setAccommodations(a.accommodations || []);
        if (d.destinations?.length > 0) {
          setSelectedDest(d.destinations[0]);
          setTargetDestId(String(d.destinations[0].id));
        }
      })
      .catch((err) => console.error('Map load error:', err))
      .finally(() => setLoading(false));
  }, []);

  const filteredDestinations = useMemo(() => {
    return destinations.filter((d) => {
      const matchCat = selectedCategory === 'all' || d.category?.slug === selectedCategory;
      const q = searchText.trim().toLowerCase();
      const matchQ =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.district.toLowerCase().includes(q) ||
        d.province.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [destinations, selectedCategory, searchText]);

  const handleGeocodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    setGeoLoading(true);
    try {
      const res = await fetch(`/api/external/geocode?q=${encodeURIComponent(searchText)}`);
      const data = (await res.json()) as { results?: NominatimPlace[] };
      setGeoResults(data.results || []);
    } catch {
      setGeoResults([]);
    } finally {
      setGeoLoading(false);
    }
  };

  const handleCalculateRoute = async () => {
    setRouteError(null);
    const target = destinations.find((d) => String(d.id) === targetDestId);
    if (!target) return;

    let originCoord: { lat: number; lon: number } | null = null;
    if (originKey.startsWith('hub:')) {
      const hub = RWANDA_TRANSPORT_HUBS[Number(originKey.split(':')[1])];
      if (hub) originCoord = { lat: hub.latitude, lon: hub.longitude };
    } else if (originKey.startsWith('dest:')) {
      const od = destinations.find((d) => String(d.id) === originKey.split(':')[1]);
      if (od) originCoord = { lat: od.latitude, lon: od.longitude };
    }

    if (!originCoord) return;
    setRouting(true);
    try {
      const waypoints = `${originCoord.lon},${originCoord.lat};${target.longitude},${target.latitude}`;
      const res = await fetch(`/api/external/route?profile=${travelMode}&waypoints=${waypoints}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Routing failed');
      setRouteResult(data as RouteResult);
      setSelectedDest(target);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : 'Unable to compute route');
    } finally {
      setRouting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E3E9E4] pb-5">
        <div>
          <p className="text-xs font-semibold text-[#16865B]">OpenStreetMap · Leaflet · OSRM Routing</p>
          <h1 className="font-serif text-3xl font-bold text-[#123D2B]">
            Interactive Rwanda Tourism Map
          </h1>
        </div>

        {/* Mobile Map / List Switcher */}
        <div className="flex lg:hidden items-center gap-1 p-1 bg-white border border-[#E3E9E4] rounded-lg self-start">
          <button
            type="button"
            onClick={() => setMobileView('map')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              mobileView === 'map' ? 'bg-[#123D2B] text-white' : 'text-[#69766E]'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              mobileView === 'list' ? 'bg-[#123D2B] text-white' : 'text-[#69766E]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List ({filteredDestinations.length})</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control & Directory Panel */}
        <aside className={`lg:col-span-4 space-y-5 ${mobileView === 'map' ? 'hidden lg:block' : 'block'}`}>
          {/* Search + Nominatim Geocode */}
          <form onSubmit={handleGeocodeSearch} className="bg-white border border-[#E3E9E4] rounded-xl p-4 space-y-3">
            <label className="text-xs font-semibold text-[#123D2B] block">
              Search Places & Towns in Rwanda
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#69766E] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Musanze, Rubavu, Nyungwe..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
                />
              </div>
              <button
                type="submit"
                disabled={geoLoading}
                className="px-3 py-2 text-xs font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg cursor-pointer shrink-0"
              >
                {geoLoading ? '...' : 'Locate'}
              </button>
            </div>

            {geoResults.length > 0 && (
              <div className="border-t border-[#E3E9E4] pt-2.5 space-y-1">
                <p className="text-[11px] text-[#69766E]">Nominatim Place Matches:</p>
                {geoResults.slice(0, 3).map((place) => (
                  <button
                    key={place.placeId}
                    type="button"
                    onClick={() => {
                      setFocusPoint({ lat: place.latitude, lon: place.longitude, zoom: 12 });
                      setMobileView('map');
                    }}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-[#FAF9F5] text-[#123D2B] flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate pr-2">{place.shortName}</span>
                    <span className="text-[11px] text-[#16865B] shrink-0">Zoom →</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 pt-1">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter category on map"
                className="w-full px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              >
                <option value="all">All Tourism Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-4 pt-1 text-xs text-[#202923]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAccommodations}
                    onChange={(e) => setShowAccommodations(e.target.checked)}
                    className="accent-[#16865B]"
                  />
                  <span>Lodges & Hotels</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTransportHubs}
                    onChange={(e) => setShowTransportHubs(e.target.checked)}
                    className="accent-[#16865B]"
                  />
                  <span>Airports & Hubs</span>
                </label>
              </div>
            </div>
          </form>

          {/* OSRM Route & Distance Calculator */}
          <div className="bg-white border border-[#E3E9E4] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#16865B]" />
              <h2 className="font-semibold text-sm text-[#123D2B]">
                Route & Distance Calculator (OSRM)
              </h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[#69766E] mb-1">Starting Point</label>
                <select
                  value={originKey}
                  onChange={(e) => setOriginKey(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                >
                  <optgroup label="Airports & Transport Hubs">
                    {RWANDA_TRANSPORT_HUBS.map((hub, idx) => (
                      <option key={hub.name} value={`hub:${idx}`}>
                        {hub.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Tourism Destinations">
                    {destinations.map((d) => (
                      <option key={d.id} value={`dest:${d.id}`}>
                        {d.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[#69766E] mb-1">Destination</label>
                <select
                  value={targetDestId}
                  onChange={(e) => setTargetDestId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name} ({d.district})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setTravelMode('driving')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg border font-medium cursor-pointer ${
                    travelMode === 'driving'
                      ? 'bg-[#123D2B] text-white border-[#123D2B]'
                      : 'bg-[#FAF9F5] text-[#69766E] border-[#E3E9E4]'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Drive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTravelMode('cycling')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg border font-medium cursor-pointer ${
                    travelMode === 'cycling'
                      ? 'bg-[#123D2B] text-white border-[#123D2B]'
                      : 'bg-[#FAF9F5] text-[#69766E] border-[#E3E9E4]'
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Cycle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTravelMode('walking')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg border font-medium cursor-pointer ${
                    travelMode === 'walking'
                      ? 'bg-[#123D2B] text-white border-[#123D2B]'
                      : 'bg-[#FAF9F5] text-[#69766E] border-[#E3E9E4]'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>Walk</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCalculateRoute}
                disabled={routing || destinations.length === 0}
                className="w-full py-2.5 text-xs font-semibold text-white bg-[#16865B] hover:bg-[#123D2B] rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {routing ? 'Computing route...' : 'Calculate Route on Map'}
              </button>

              {routeError && <p className="text-red-600 text-xs">{routeError}</p>}

              {routeResult && (
                <div className="bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-[#123D2B] tabular-nums">
                    <span>{routeResult.distanceKm} km</span>
                    <span>
                      {Math.floor(routeResult.durationMin / 60)}h {routeResult.durationMin % 60}m
                    </span>
                  </div>
                  <p className="text-[11px] text-[#69766E]">
                    {routeResult.source} · {routeResult.profile} corridor
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Clickable Destination List */}
          <div className="bg-white border border-[#E3E9E4] rounded-xl p-4 space-y-3 max-h-[340px] overflow-y-auto">
            <h2 className="font-semibold text-xs text-[#69766E] tabular-nums">
              Destinations ({filteredDestinations.length})
            </h2>
            {loading ? (
              <div className="h-24 bg-[#FAF9F5] rounded animate-pulse" />
            ) : (
              <div className="space-y-2">
                {filteredDestinations.map((dest) => (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => {
                      setSelectedDest(dest);
                      setTargetDestId(String(dest.id));
                      setFocusPoint({ lat: dest.latitude, lon: dest.longitude, zoom: 11 });
                      setMobileView('map');
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-center gap-3 cursor-pointer ${
                      selectedDest?.id === dest.id
                        ? 'bg-[#FAF9F5] border-[#16865B]'
                        : 'bg-white border-[#E3E9E4] hover:border-[#16865B]/50'
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-[#16865B] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#123D2B] truncate">{dest.name}</p>
                      <p className="text-[11px] text-[#69766E] truncate">
                        {dest.district} · {dest.province}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right Interactive Map + Selected Card */}
        <div className={`lg:col-span-8 space-y-4 ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
          <RwandaMap
            destinations={filteredDestinations}
            accommodations={accommodations}
            showAccommodations={showAccommodations}
            showTransportHubs={showTransportHubs}
            selectedDestinationId={selectedDest?.id ?? null}
            onSelectDestination={(d) => {
              setSelectedDest(d);
              setTargetDestId(String(d.id));
            }}
            focusPoint={focusPoint}
            routeCoordinates={routeResult?.coordinates || []}
            heightClassName="h-[540px]"
          />

          {selectedDest && (
            <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 flex flex-col sm:flex-row gap-5 items-start">
              <div className="w-full sm:w-44 aspect-[4/3] rounded-lg overflow-hidden shrink-0 border border-[#E3E9E4]">
                <SafeImage
                  src={selectedDest.primaryImage}
                  alt={selectedDest.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-xs text-[#69766E] flex items-center gap-2">
                  <span>{selectedDest.category?.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedDest.district}, {selectedDest.province}</span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-[#123D2B]">
                  {selectedDest.name}
                </h3>
                <p className="text-sm text-[#69766E] line-clamp-2">{selectedDest.shortSummary}</p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <Link
                    to={`/destinations/${selectedDest.slug}`}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg"
                  >
                    Open Full Destination Guide
                  </Link>
                  <Link
                    to={`/planner?add=${selectedDest.id}`}
                    className="px-4 py-2 text-xs font-semibold text-[#123D2B] bg-[#FAF9F5] border border-[#E3E9E4] hover:border-[#16865B] rounded-lg"
                  >
                    Add to Itinerary
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
