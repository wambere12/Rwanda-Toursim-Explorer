import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ExternalLink, MapPin, Phone, Search, Star } from 'lucide-react';
import { Accommodation } from '../types/tourism.ts';
import { SafeImage } from '../components/ui/SafeImage.tsx';

const TYPES = [
  { key: 'all', label: 'All Stays' },
  { key: 'lodge', label: 'Lodges' },
  { key: 'hotel', label: 'Hotels' },
  { key: 'resort', label: 'Resorts' },
  { key: 'guesthouse', label: 'Guesthouses' },
  { key: 'campsite', label: 'Campsites' },
  { key: 'apartment', label: 'Apartments' },
];

export const StaysPage: React.FC = () => {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (provinceFilter !== 'all') params.set('province', provinceFilter);
    if (query.trim()) params.set('q', query.trim());

    fetch(`/api/accommodations?${params.toString()}`)
      .then((r) => r.json())
      .then((d: { accommodations?: Accommodation[] }) => setAccommodations(d.accommodations || []))
      .catch((err) => console.error('Accommodations load error:', err))
      .finally(() => setLoading(false));
  }, [typeFilter, provinceFilter, query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <header className="space-y-2 border-b border-[#E3E9E4] pb-6">
        <p className="text-xs font-semibold text-[#16865B]">Accommodation Discovery</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#123D2B]">
          Lodges, Hotels, Resorts & Stays in Rwanda
        </h1>
        <p className="text-sm text-[#69766E] max-w-2xl">
          Verified properties near national parks, Lake Kivu, and Kigali. Contact details and
          official partner links are provided directly without fabricated availability claims.
        </p>
      </header>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E3E9E4] rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8 relative flex items-center">
            <Search className="w-4 h-4 text-[#69766E] absolute left-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lodge, hotel, or district..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
            />
          </div>
          <div className="md:col-span-4">
            <select
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              aria-label="Filter accommodations by province"
              className="w-full px-3 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
            >
              <option value="all">All Provinces</option>
              <option value="Kigali City">Kigali City</option>
              <option value="Northern">Northern Province</option>
              <option value="Southern">Southern Province</option>
              <option value="Eastern">Eastern Province</option>
              <option value="Western">Western Province</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === t.key
                  ? 'bg-[#123D2B] text-white'
                  : 'bg-[#FAF9F5] text-[#69766E] border border-[#E3E9E4] hover:text-[#123D2B]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white border border-[#E3E9E4] rounded-xl h-80 animate-pulse" />
          ))}
        </div>
      ) : accommodations.length === 0 ? (
        <div className="bg-white border border-[#E3E9E4] rounded-xl p-12 text-center space-y-3">
          <Building2 className="w-10 h-10 text-[#69766E] mx-auto" />
          <h2 className="font-serif text-xl font-semibold text-[#123D2B]">No properties found</h2>
          <p className="text-sm text-[#69766E]">Adjust your accommodation type or province filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accommodations.map((accom) => (
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
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-[#69766E]">
                    <span className="capitalize">
                      {accom.accommodationType} · {accom.province}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#202923] tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-[#D9A441] text-[#D9A441]" />
                      {accom.rating.toFixed(1)}
                    </span>
                  </div>

                  <h2 className="font-serif text-xl font-semibold text-[#123D2B]">{accom.name}</h2>
                  <p className="text-sm text-[#69766E] leading-relaxed">{accom.description}</p>

                  <p className="text-xs text-[#202923]">
                    Facilities: {accom.facilities.join(' · ')}
                  </p>

                  {accom.nearDestination && (
                    <p className="text-xs text-[#16865B]">
                      Near{' '}
                      <Link
                        to={`/destinations/${accom.nearDestination.slug}`}
                        className="font-medium underline"
                      >
                        {accom.nearDestination.name}
                      </Link>
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E3E9E4] space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[#69766E]">
                      <MapPin className="w-3.5 h-3.5 text-[#16865B]" />
                      {accom.address}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-semibold text-[#123D2B] tabular-nums">
                      {accom.verifiedPriceRange || 'Contact property for verified rates'}
                    </span>
                    {accom.externalBookingUrl && (
                      <a
                        href={accom.externalBookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#16865B] hover:text-[#123D2B] whitespace-nowrap"
                      >
                        <span>Visit website</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {accom.contactPhone && (
                    <p className="text-[#69766E] flex items-center gap-1.5 tabular-nums">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{accom.contactPhone}</span>
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
