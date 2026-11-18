import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Car,
  CheckCircle2,
  ExternalLink,
  Flag,
  Heart,
  MapPin,
  Mountain,
  Phone,
  Route,
  ShieldAlert,
  Star,
} from 'lucide-react';
import {
  Accommodation,
  Destination,
  NearbyDestination,
  Review,
  RouteResult,
} from '../types/tourism.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { SafeImage } from '../components/ui/SafeImage.tsx';
import { RwandaMap } from '../components/map/RwandaMap.tsx';
import { WeatherCard } from '../components/weather/WeatherCard.tsx';

interface WikimediaPhoto {
  pageId: number;
  title: string;
  imageUrl: string;
  sourceUrl: string;
  artist: string;
  license: string;
}

const KIGALI_AIRPORT = { lat: -1.9686, lon: 30.1395 };

export const DestinationDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { profile, apiFetch, signInWithGoogle } = useAuth();

  const [destination, setDestination] = useState<Destination | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [nearbyDestinations, setNearbyDestinations] = useState<NearbyDestination[]>([]);
  const [nearbyAccommodations, setNearbyAccommodations] = useState<Accommodation[]>([]);
  const [wikiPhotos, setWikiPhotos] = useState<WikimediaPhoto[]>([]);
  const [airportRoute, setAirportRoute] = useState<RouteResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review form state
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);

  // Report modal state
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        destination: Destination;
        reviews: Review[];
        nearbyDestinations: NearbyDestination[];
        nearbyAccommodations: Accommodation[];
      }>(`/api/destinations/${slug}`);
      setDestination(res.destination);
      setReviews(res.reviews);
      setNearbyDestinations(res.nearbyDestinations);
      setNearbyAccommodations(res.nearbyAccommodations);

      // Fetch live Wikimedia Commons photos & OSRM driving route from Kigali Airport
      const wikiQ = res.destination.wikimediaTitle || res.destination.name;
      fetch(`/api/external/wikimedia?query=${encodeURIComponent(wikiQ)}`)
        .then((r) => r.json())
        .then((d: { photos?: WikimediaPhoto[] }) => setWikiPhotos(d.photos || []))
        .catch(() => {});

      fetch(
        `/api/external/route?profile=driving&waypoints=${KIGALI_AIRPORT.lon},${KIGALI_AIRPORT.lat};${res.destination.longitude},${res.destination.latitude}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((r: RouteResult | null) => setAirportRoute(r))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Destination not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [slug]);

  const handleToggleCollection = async (collectionType: 'favorite' | 'saved') => {
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    if (!destination) return;
    const res = await apiFetch<{ active: boolean }>('/api/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ destinationId: destination.id, collectionType }),
    });
    setDestination((prev) =>
      prev
        ? {
            ...prev,
            isFavorited: collectionType === 'favorite' ? res.active : prev.isFavorited,
            isSaved: collectionType === 'saved' ? res.active : prev.isSaved,
          }
        : null
    );
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    if (!destination) return;
    setSubmittingReview(true);
    setReviewFeedback(null);
    try {
      const res = await apiFetch<{ updatedExisting: boolean }>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          destinationId: destination.id,
          rating,
          title: reviewTitle,
          comment: reviewComment,
          visitDate: visitDate || undefined,
        }),
      });
      setReviewFeedback(
        res.updatedExisting
          ? 'Your existing review for this destination has been updated.'
          : 'Thank you! Your review has been published.'
      );
      setReviewTitle('');
      setReviewComment('');
      await loadDetail();
    } catch (err) {
      setReviewFeedback(err instanceof Error ? err.message : 'Could not submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingReviewId || !reportReason.trim()) return;
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'review',
          targetId: reportingReviewId,
          reason: reportReason.trim(),
        }),
      });
      setReportingReviewId(null);
      setReportReason('');
      setReportSuccess('Report submitted for administrative review.');
    } catch (err) {
      setReportSuccess(err instanceof Error ? err.message : 'Failed to file report');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 animate-pulse">
        <div className="h-8 w-64 bg-[#E3E9E4] rounded" />
        <div className="h-[420px] bg-[#E3E9E4] rounded-xl" />
      </div>
    );
  }

  if (error || !destination) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-serif text-3xl font-bold text-[#123D2B]">Destination Not Found</h1>
        <p className="text-sm text-[#69766E]">{error || 'This destination does not exist.'}</p>
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#123D2B] text-white text-sm font-medium rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Discover</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#69766E] hover:text-[#123D2B]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Rwanda Destinations</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleToggleCollection('favorite')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              destination.isFavorited
                ? 'bg-[#D9A441]/15 border-[#D9A441] text-[#123D2B]'
                : 'bg-white border-[#E3E9E4] text-[#202923] hover:border-[#16865B]'
            }`}
          >
            <Heart className={`w-4 h-4 ${destination.isFavorited ? 'fill-[#D9A441] text-[#D9A441]' : ''}`} />
            <span>{destination.isFavorited ? 'Favorited' : 'Favorite'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleCollection('saved')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              destination.isSaved
                ? 'bg-[#16865B]/15 border-[#16865B] text-[#123D2B]'
                : 'bg-white border-[#E3E9E4] text-[#202923] hover:border-[#16865B]'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${destination.isSaved ? 'fill-[#16865B] text-[#16865B]' : ''}`} />
            <span>{destination.isSaved ? 'Saved' : 'Save for Trip'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/planner?add=${destination.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg transition-colors cursor-pointer"
          >
            <Route className="w-4 h-4" />
            <span>Add to Itinerary</span>
          </button>
        </div>
      </div>

      {/* Editorial Title & Metadata */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#69766E]">
          <span className="text-[#16865B] font-semibold">{destination.category?.name}</span>
          <span aria-hidden="true">·</span>
          <span>{destination.district} District, {destination.province} Province</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 text-[#202923] tabular-nums">
            <Star className="w-3.5 h-3.5 fill-[#D9A441] text-[#D9A441]" />
            {destination.avgRating.toFixed(1)} ({destination.reviewCount} reviews)
          </span>
          {destination.elevationMeters && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{destination.elevationMeters}m elevation</span>
            </>
          )}
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#123D2B] leading-tight">
          {destination.name}
        </h1>
        <p className="text-base sm:text-lg text-[#69766E] max-w-3xl leading-relaxed">
          {destination.shortSummary}
        </p>
      </header>

      {/* Primary Hero Image + Wikimedia Commons Gallery */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 aspect-[16/10] rounded-xl overflow-hidden border border-[#E3E9E4] bg-[#E3E9E4]/30">
          <SafeImage
            src={destination.primaryImage}
            alt={destination.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
          {wikiPhotos.slice(0, 2).map((photo) => (
            <div
              key={photo.pageId}
              className="relative aspect-[16/10] lg:aspect-auto lg:h-[190px] rounded-xl overflow-hidden border border-[#E3E9E4] bg-[#FAF9F5]"
            >
              <SafeImage
                src={photo.imageUrl}
                alt={photo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                <p className="text-[11px] text-white truncate">
                  Wikimedia Commons · {photo.license}
                </p>
              </div>
            </div>
          ))}
          {wikiPhotos.length === 0 && (
            <div className="lg:h-full rounded-xl border border-[#E3E9E4] bg-white p-6 flex flex-col justify-center space-y-2">
              <Mountain className="w-6 h-6 text-[#16865B]" />
              <p className="font-serif text-lg font-semibold text-[#123D2B]">
                Field GPS Coordinates
              </p>
              <p className="font-mono text-xs text-[#69766E] tabular-nums">
                {destination.latitude.toFixed(4)}° S, {destination.longitude.toFixed(4)}° E
              </p>
              <p className="text-xs text-[#69766E]">
                Best time to visit: {destination.bestSeason || 'Year-round'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Main Two-Column Editorial & Intelligence Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Content Column */}
        <div className="lg:col-span-8 space-y-10">
          <section className="space-y-4">
            <h2 className="font-serif text-2xl font-semibold text-[#123D2B]">
              Overview & Natural Heritage
            </h2>
            <p className="text-[15px] text-[#202923] leading-relaxed">
              {destination.description}
            </p>
          </section>

          {/* Activities */}
          <section className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#123D2B]">
              Available Activities
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {destination.activities.map((act) => (
                <div key={act} className="flex items-center gap-2.5 text-sm text-[#202923]">
                  <CheckCircle2 className="w-4 h-4 text-[#16865B] shrink-0" />
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Entrance & Guidelines */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#123D2B]">
                <Calendar className="w-4 h-4 text-[#16865B]" />
                <span>Entrance & Permits</span>
              </div>
              <p className="text-sm text-[#69766E] leading-relaxed">
                {destination.entranceInfo}
              </p>
              {destination.contactInfo && (
                <p className="text-xs text-[#202923] pt-2 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#16865B]" />
                  <span>{destination.contactInfo}</span>
                </p>
              )}
            </div>

            <div className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#123D2B]">
                <ShieldAlert className="w-4 h-4 text-[#D9A441]" />
                <span>Visitor Guidelines</span>
              </div>
              <p className="text-sm text-[#69766E] leading-relaxed">
                {destination.visitorGuidelines}
              </p>
              <p className="text-xs text-[#202923] pt-2">
                Recommended season: {destination.bestSeason}
              </p>
            </div>
          </section>

          {/* Interactive Location Map + Route from Kigali Airport */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-2xl font-semibold text-[#123D2B]">
                Location & Route from Kigali Airport (KGL)
              </h2>
              {airportRoute && (
                <div className="flex items-center gap-2 text-xs font-medium text-[#202923] tabular-nums">
                  <Car className="w-4 h-4 text-[#16865B]" />
                  <span>{airportRoute.distanceKm} km</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    ~{Math.floor(airportRoute.durationMin / 60)}h {airportRoute.durationMin % 60}m drive
                  </span>
                </div>
              )}
            </div>

            <RwandaMap
              destinations={[destination]}
              selectedDestinationId={destination.id}
              focusPoint={{ lat: destination.latitude, lon: destination.longitude, zoom: 10 }}
              routeCoordinates={airportRoute?.coordinates || []}
              clusterMarkers={false}
              heightClassName="h-[360px]"
            />
          </section>

          {/* Reviews & Ratings */}
          <section className="space-y-6 pt-4 border-t border-[#E3E9E4]">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold text-[#123D2B]">
                Traveler Reviews ({reviews.length})
              </h2>
              {reportSuccess && (
                <span className="text-xs text-[#16865B] font-medium">{reportSuccess}</span>
              )}
            </div>

            {/* Submit Review Form */}
            <form
              onSubmit={handleReviewSubmit}
              className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-base text-[#123D2B]">
                  Share Your Experience
                </h3>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 cursor-pointer"
                      aria-label={`${star} stars`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= rating ? 'fill-[#D9A441] text-[#D9A441]' : 'text-[#E3E9E4]'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Headline for your review"
                  className="px-3.5 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
                />
                <input
                  type="month"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  aria-label="Month visited"
                  className="px-3.5 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
                />
              </div>

              <textarea
                required
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Describe trail conditions, wildlife sightings, guide service, or practical tips..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#69766E]">
                  {profile
                    ? `Posting as ${profile.fullName}`
                    : 'Sign in with Google to publish a verified traveler review'}
                </span>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                >
                  {submittingReview ? 'Submitting...' : profile ? 'Publish Review' : 'Sign In & Review'}
                </button>
              </div>
              {reviewFeedback && (
                <p className="text-xs font-medium text-[#16865B]">{reviewFeedback}</p>
              )}
            </form>

            {/* Existing Reviews */}
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <p className="text-sm text-[#69766E]">
                  No reviews yet. Be the first traveler to share field notes for {destination.name}.
                </p>
              ) : (
                reviews.map((rev) => (
                  <article
                    key={rev.id}
                    className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-sm text-[#123D2B]">{rev.title}</h4>
                        <div className="text-xs text-[#69766E] flex items-center gap-2 mt-0.5">
                          <span className="font-medium text-[#202923]">{rev.authorName}</span>
                          {rev.authorNationality && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{rev.authorNationality}</span>
                            </>
                          )}
                          {rev.visitDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">Visited {rev.visitDate}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#202923] tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-[#D9A441] text-[#D9A441]" />
                          {rev.rating}.0
                        </span>
                        {profile && (
                          <button
                            type="button"
                            onClick={() => setReportingReviewId(rev.id)}
                            title="Report review"
                            className="text-[#69766E] hover:text-red-600 cursor-pointer"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[#202923] leading-relaxed">{rev.comment}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Sidebar: Weather + Nearby Attractions + Nearby Stays */}
        <aside className="lg:col-span-4 space-y-6">
          <WeatherCard
            latitude={destination.latitude}
            longitude={destination.longitude}
            locationName={destination.district}
          />

          {/* Nearby Attractions */}
          <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-4">
            <h3 className="font-serif text-lg font-semibold text-[#123D2B]">
              Nearby Attractions
            </h3>
            <div className="space-y-3">
              {nearbyDestinations.map((near) => (
                <Link
                  key={near.id}
                  to={`/destinations/${near.slug}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-14 h-12 rounded-lg overflow-hidden shrink-0 border border-[#E3E9E4]">
                    <SafeImage
                      src={near.primaryImage}
                      alt={near.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#123D2B] group-hover:text-[#16865B] truncate">
                      {near.name}
                    </p>
                    <p className="text-xs text-[#69766E] tabular-nums">
                      {near.district} · {near.distanceKm} km away
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Nearby Verified Accommodations */}
          <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-[#123D2B]">
                Nearby Stays
              </h3>
              <Link to="/stays" className="text-xs font-semibold text-[#16865B]">
                All stays →
              </Link>
            </div>
            <div className="space-y-3.5">
              {nearbyAccommodations.map((accom) => (
                <div key={accom.id} className="pb-3 border-b border-[#E3E9E4] last:border-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#123D2B] truncate">{accom.name}</p>
                    <span className="text-xs text-[#69766E] tabular-nums shrink-0">
                      {accom.distanceKm} km
                    </span>
                  </div>
                  <p className="text-xs text-[#69766E] capitalize">
                    {accom.accommodationType} · {accom.verifiedPriceRange || 'Contact property'}
                  </p>
                  {accom.externalBookingUrl && (
                    <a
                      href={accom.externalBookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#16865B] hover:underline"
                    >
                      <span>External booking info</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Coordinates Card */}
          <div className="bg-[#FAF9F5] border border-[#E3E9E4] rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#123D2B]">
              <MapPin className="w-4 h-4 text-[#16865B]" />
              <span>GIS Reference</span>
            </div>
            <p className="font-mono text-xs text-[#69766E] tabular-nums">
              Lat {destination.latitude.toFixed(5)} · Lon {destination.longitude.toFixed(5)}
            </p>
          </div>
        </aside>
      </div>

      {/* Review Report Modal */}
      {reportingReviewId && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="bg-white border border-[#E3E9E4] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-serif text-xl font-semibold text-[#123D2B]">
              Report Review Content
            </h3>
            <p className="text-xs text-[#69766E]">
              Flag inaccurate, promotional, or inappropriate content for moderation review.
            </p>
            <input
              type="text"
              required
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for reporting (e.g., spam or inaccurate info)"
              className="w-full px-3.5 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportingReviewId(null)}
                className="px-4 py-2 text-xs font-medium text-[#69766E] hover:text-[#202923] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] rounded-lg cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
