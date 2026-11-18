import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  ExternalLink,
  Globe,
  MapPin,
  Plane,
  Route,
  Search,
  Trees,
} from 'lucide-react';
import {
  Accommodation,
  Category,
  CountryInfo,
  Destination,
  Itinerary,
} from '../types/tourism.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { DestinationCard } from '../components/tourism/DestinationCard.tsx';
import { RwandaMap } from '../components/map/RwandaMap.tsx';
import { SafeImage } from '../components/ui/SafeImage.tsx';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, apiFetch, signInWithGoogle } = useAuth();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [countryInfo, setCountryInfo] = useState<CountryInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ destinations: Destination[] }>('/api/destinations'),
      apiFetch<{ categories: Category[] }>('/api/categories'),
      apiFetch<{ accommodations: Accommodation[] }>('/api/accommodations'),
      apiFetch<{ recommended: Itinerary[] }>('/api/itineraries'),
      fetch('/api/external/country').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([destRes, catRes, accomRes, itinRes, countryRes]) => {
        if (!active) return;
        setDestinations(destRes.destinations);
        setCategories(catRes.categories);
        setAccommodations(accomRes.accommodations);
        setItineraries(itinRes.recommended);
        if (countryRes) setCountryInfo(countryRes as CountryInfo);
      })
      .catch((err) => console.error('Homepage load error:', err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiFetch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedProvince !== 'all') params.set('province', selectedProvince);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    navigate(`/discover?${params.toString()}`);
  };

  const handleToggleFavorite = async (destinationId: number) => {
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    try {
      const res = await apiFetch<{ active: boolean }>('/api/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ destinationId, collectionType: 'favorite' }),
      });
      setDestinations((prev) =>
        prev.map((d) => (d.id === destinationId ? { ...d, isFavorited: res.active } : d))
      );
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  };

  const featuredDestinations = destinations.filter((d) => d.featured).slice(0, 4);
  const displayFeatured = featuredDestinations.length > 0 ? featuredDestinations : destinations.slice(0, 4);

  return (
    <div className="space-y-20 pb-20">
      {/* 1. Editorial Hero Section */}
      <section className="relative bg-[#123D2B] overflow-hidden">
        <div className="absolute inset-0">
          <SafeImage
            src="/src/assets/images/hero_volcanoes_rwanda_1794986076294.jpg"
            alt="Virunga Volcanoes and emerald hills of Rwanda at sunrise"
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#123D2B]/90 via-[#123D2B]/45 to-[#123D2B]/30" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-medium text-[#D9A441] tracking-wide">
              Republic of Rwanda · Land of a Thousand Hills
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-[56px] font-bold text-white leading-[1.12]">
              Discover Rwanda. Experience the Extraordinary.
            </h1>
            <p className="text-base sm:text-lg text-[#FAF9F5]/90 max-w-2xl leading-relaxed">
              Explore protected national parks, volcanic peaks, Lake Kivu shorelines, and living
              cultural heritage with real-time weather, interactive GIS routing, and verified stays.
            </p>
          </div>

          {/* Integrated Destination Search Interface */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-10 bg-white border border-[#E3E9E4] rounded-xl p-3 sm:p-4 shadow-lg max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-3"
          >
            <div className="md:col-span-5 relative flex items-center">
              <Search className="w-4 h-4 text-[#69766E] absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search parks, lakes, museums, districts..."
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg text-[#202923] placeholder:text-[#69766E] focus:outline-none focus:border-[#16865B]"
                aria-label="Search destinations"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by category"
                className="w-full px-3 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg text-[#202923] focus:outline-none focus:border-[#16865B]"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                aria-label="Filter by province"
                className="w-full px-3 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg text-[#202923] focus:outline-none focus:border-[#16865B]"
              >
                <option value="all">All Provinces</option>
                <option value="Kigali City">Kigali City</option>
                <option value="Northern">Northern</option>
                <option value="Southern">Southern</option>
                <option value="Eastern">Eastern</option>
                <option value="Western">Western</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full h-full px-4 py-2.5 text-sm font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Explore
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 2. Featured Rwanda Destinations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#16865B] tracking-wide">
              01. Signature Landscapes
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#123D2B]">
              Featured Rwanda Destinations
            </h2>
          </div>
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#16865B] hover:text-[#123D2B] whitespace-nowrap"
          >
            <span>View all {destinations.length || 12} destinations</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="bg-white border border-[#E3E9E4] rounded-xl h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayFeatured.map((dest) => (
              <DestinationCard
                key={dest.id}
                destination={dest}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3. Interactive Tourism Map Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-[#E3E9E4] rounded-xl p-6 lg:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#16865B] tracking-wide">
                02. Geospatial Discovery
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#123D2B]">
                Interactive Rwanda Tourism Map
              </h2>
              <p className="text-sm text-[#69766E] max-w-2xl">
                Inspect national parks, cultural landmarks, regional airports, and calculate real
                driving, walking, or cycling corridors across all five provinces.
              </p>
            </div>
            <Link
              to="/map"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Compass className="w-4 h-4" />
              <span>Open Full GIS Map & Router</span>
            </Link>
          </div>

          <RwandaMap
            destinations={destinations}
            accommodations={accommodations}
            showTransportHubs={true}
            heightClassName="h-[420px]"
          />
        </div>
      </section>

      {/* 4. Popular Travel Experiences (11 Categories) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#16865B] tracking-wide">
            03. Curated Themes
          </p>
          <h2 className="font-serif text-3xl font-semibold text-[#123D2B]">
            Explore by Experience
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.slice(0, 9).map((cat) => (
            <Link
              key={cat.id}
              to={`/discover?category=${cat.slug}`}
              className="group bg-white border border-[#E3E9E4] hover:border-[#16865B] rounded-xl p-5 flex items-start justify-between gap-4 transition-colors"
            >
              <div className="space-y-1.5">
                <h3 className="font-semibold text-base text-[#123D2B] group-hover:text-[#16865B] transition-colors">
                  {cat.name}
                </h3>
                <p className="text-xs text-[#69766E] leading-relaxed line-clamp-2">
                  {cat.description}
                </p>
              </div>
              <Trees className="w-5 h-5 text-[#16865B] shrink-0 mt-0.5" />
            </Link>
          ))}
        </div>
      </section>

      {/* 5. Recommended Multi-Day Itineraries */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#16865B] tracking-wide">
              04. Travel Planning
            </p>
            <h2 className="font-serif text-3xl font-semibold text-[#123D2B]">
              Recommended Rwanda Itineraries
            </h2>
          </div>
          <Link
            to="/planner"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#16865B] hover:text-[#123D2B] whitespace-nowrap"
          >
            <span>Build custom itinerary</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {itineraries.map((itin) => (
            <div
              key={itin.id}
              className="bg-white border border-[#E3E9E4] rounded-xl p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-[#69766E] tabular-nums">
                  <span>{itin.days.length} Days</span>
                  <span aria-hidden="true">·</span>
                  <span>{itin.totalDistanceKm} km route</span>
                  <span aria-hidden="true">·</span>
                  <span>{Math.round(itin.estimatedDurationMin / 60)}h {itin.estimatedDurationMin % 60}m drive</span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-[#123D2B]">
                  {itin.title}
                </h3>
                <p className="text-sm text-[#69766E] leading-relaxed">
                  {itin.description}
                </p>

                <div className="pt-2 space-y-1.5">
                  {itin.days.map((day) => (
                    <div key={day.dayNumber} className="text-xs text-[#202923] flex items-center gap-2">
                      <span className="font-semibold text-[#16865B] whitespace-nowrap">
                        Day {day.dayNumber}:
                      </span>
                      <span className="truncate text-[#69766E]">
                        {day.stops.map((s) => s.destination?.name).filter(Boolean).join(' → ') || day.dateLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E3E9E4] flex items-center justify-between">
                <Link
                  to={`/planner/${itin.shareCode}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#123D2B] hover:text-[#16865B]"
                >
                  <Route className="w-4 h-4 text-[#16865B]" />
                  <span>Open Route in Planner</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Accommodation Discovery */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#16865B] tracking-wide">
              05. Where to Stay
            </p>
            <h2 className="font-serif text-3xl font-semibold text-[#123D2B]">
              Verified Lodges, Hotels & Retreats
            </h2>
          </div>
          <Link
            to="/stays"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#16865B] hover:text-[#123D2B] whitespace-nowrap"
          >
            <span>Browse all accommodations</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {accommodations.slice(0, 3).map((accom) => (
            <article
              key={accom.id}
              className="bg-white border border-[#E3E9E4] rounded-xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-[#E3E9E4]/30">
                <SafeImage
                  src={accom.primaryImage}
                  alt={accom.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="text-xs text-[#69766E] capitalize flex items-center gap-2">
                    <span>{accom.accommodationType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{accom.district}</span>
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-[#123D2B]">
                    {accom.name}
                  </h3>
                  <p className="text-sm text-[#69766E] line-clamp-2">{accom.description}</p>
                </div>

                <div className="pt-3 border-t border-[#E3E9E4] flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[#202923] tabular-nums">
                    {accom.verifiedPriceRange || 'Contact for rates'}
                  </span>
                  {accom.externalBookingUrl && (
                    <a
                      href={accom.externalBookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#16865B] hover:text-[#123D2B] whitespace-nowrap"
                    >
                      <span>Partner site</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 7. Rwanda Tourism Information Section (REST Countries + Aviation/Road Corridors) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-[#E3E9E4] rounded-xl p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-semibold text-[#16865B] tracking-wide">
              06. Essential Travel Intelligence
            </p>
            <h2 className="font-serif text-3xl font-semibold text-[#123D2B]">
              Preparing for Your Journey to Rwanda
            </h2>
            <p className="text-sm text-[#69766E] leading-relaxed">
              Rwanda’s compact paved highway network connects Kigali International Airport (KGL) to
              every major national park within 2.5 to 5 hours. Domestic scheduled flights also link
              Kigali with Kamembe (KME) near Nyungwe Forest.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#123D2B]">
                  <Plane className="w-4 h-4 text-[#16865B]" />
                  <span>Primary Gateways</span>
                </div>
                <p className="text-xs text-[#69766E] leading-relaxed">
                  Kigali International Airport (KGL) handles regional and intercontinental arrivals;
                  Kamembe Airport (KME) serves southwestern rainforest circuits.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#123D2B]">
                  <MapPin className="w-4 h-4 text-[#16865B]" />
                  <span>Park Permits & Conservation</span>
                </div>
                <p className="text-xs text-[#69766E] leading-relaxed">
                  Mountain gorilla and chimpanzee trekking permits are regulated daily; advance
                  reservations through licensed RDB operators are essential.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#FAF9F5] border border-[#E3E9E4] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-[#E3E9E4] pb-3">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-[#16865B]" />
                <h3 className="font-semibold text-sm text-[#123D2B]">
                  Country Snapshot (REST Countries)
                </h3>
              </div>
              {countryInfo?.flagUrl && (
                <img
                  src={countryInfo.flagUrl}
                  alt="Flag of Rwanda"
                  referrerPolicy="no-referrer"
                  className="w-8 h-5 object-cover rounded border border-[#E3E9E4]"
                />
              )}
            </div>

            <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <dt className="text-[#69766E]">Capital</dt>
                <dd className="font-semibold text-[#202923] mt-0.5">{countryInfo?.capital || 'Kigali'}</dd>
              </div>
              <div>
                <dt className="text-[#69766E]">Currency</dt>
                <dd className="font-semibold text-[#202923] mt-0.5">
                  {countryInfo ? `${countryInfo.currencyCode} (${countryInfo.currencySymbol})` : 'RWF (FRw)'}
                </dd>
              </div>
              <div>
                <dt className="text-[#69766E]">Timezone</dt>
                <dd className="font-semibold text-[#202923] mt-0.5 tabular-nums">
                  {countryInfo?.timezone || 'UTC+02:00'}
                </dd>
              </div>
              <div>
                <dt className="text-[#69766E]">Dialing & Driving</dt>
                <dd className="font-semibold text-[#202923] mt-0.5 tabular-nums capitalize">
                  {countryInfo ? `${countryInfo.callingCode} · ${countryInfo.drivingSide}-hand` : '+250 · Right-hand'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[#69766E]">Official Languages</dt>
                <dd className="font-semibold text-[#202923] mt-0.5">
                  {countryInfo?.languages?.join(', ') || 'Kinyarwanda, English, French, Swahili'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[#69766E]">Area & Population</dt>
                <dd className="font-semibold text-[#202923] mt-0.5 tabular-nums">
                  {countryInfo
                    ? `${countryInfo.areaKm2.toLocaleString()} km² · ${(countryInfo.population / 1_000_000).toFixed(1)}M residents`
                    : '26,338 km² · 14.0M residents'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
};
