import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Bookmark, Check, Heart, MapPin, Route, Star, User } from 'lucide-react';
import { Destination, Itinerary } from '../types/tourism.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { SafeImage } from '../components/ui/SafeImage.tsx';

interface FavoriteRow {
  id: number;
  collectionType: 'favorite' | 'saved';
  destination: Destination;
}

interface UserReviewRow {
  id: number;
  rating: number;
  title: string;
  comment: string;
  moderationStatus: string;
  destinationName: string;
  destinationSlug: string;
}

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  linkUrl: string | null;
  createdAt: string;
}

export const ProfilePage: React.FC = () => {
  const { profile, roles, loading, apiFetch, refreshProfile, signInWithGoogle } = useAuth();

  const [fullName, setFullName] = useState('');
  const [nationality, setNationality] = useState('');
  const [travelStyle, setTravelStyle] = useState('Nature & Wildlife');
  const [preferredCurrency, setPreferredCurrency] = useState<'USD' | 'RWF' | 'EUR' | 'GBP'>('USD');
  const [historyText, setHistoryText] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [reviews, setReviews] = useState<UserReviewRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName);
    setNationality(profile.nationality || '');
    setTravelStyle(profile.travelStyle || 'Nature & Wildlife');
    setPreferredCurrency((profile.preferredCurrency as 'USD' | 'RWF' | 'EUR' | 'GBP') || 'USD');
    setHistoryText((profile.travelHistory || []).join(', '));

    Promise.all([
      apiFetch<{ favorites: FavoriteRow[] }>('/api/favorites'),
      apiFetch<{ mine: Itinerary[] }>('/api/itineraries'),
      apiFetch<{ reviews: UserReviewRow[] }>('/api/reviews/mine'),
      apiFetch<{ notifications: NotificationRow[] }>('/api/notifications'),
    ])
      .then(([favRes, itinRes, revRes, notifRes]) => {
        setFavorites(favRes.favorites);
        setItineraries(itinRes.mine);
        setReviews(revRes.reviews);
        setNotifications(notifRes.notifications);
      })
      .catch((err) => console.error('Profile data load error:', err));
  }, [profile?.id, apiFetch]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          nationality: nationality || null,
          travelStyle,
          preferredCurrency,
          travelHistory: historyText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      await refreshProfile();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  };

  const markRead = async (id: number) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 animate-pulse space-y-6">
        <div className="h-10 w-64 bg-[#E3E9E4] rounded" />
        <div className="h-64 bg-[#E3E9E4] rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-5">
        <User className="w-12 h-12 text-[#16865B] mx-auto" />
        <h1 className="font-serif text-3xl font-bold text-[#123D2B]">
          Sign In to Your Traveler Profile
        </h1>
        <p className="text-sm text-[#69766E]">
          Save favorite Rwanda destinations, manage multi-day itineraries, track travel history, and
          publish verified destination reviews.
        </p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="px-6 py-3 text-sm font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg cursor-pointer"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E3E9E4] pb-6">
        <div>
          <p className="text-xs font-semibold text-[#16865B]">
            Traveler Account · {roles.join(' / ')}
          </p>
          <h1 className="font-serif text-3xl font-bold text-[#123D2B]">{profile.fullName}</h1>
          <p className="text-sm text-[#69766E]">{profile.email}</p>
        </div>
        {roles.includes('admin') && (
          <Link
            to="/admin"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg self-start"
          >
            Open Admin Dashboard
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Preferences Form */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-5 bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-4"
        >
          <h2 className="font-serif text-xl font-semibold text-[#123D2B]">
            Preferences & Travel History
          </h2>

          <div>
            <label className="block text-xs font-medium text-[#69766E] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#69766E] mb-1">Nationality</label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="e.g., Rwanda, UK, USA"
                className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#69766E] mb-1">Currency</label>
              <select
                value={preferredCurrency}
                onChange={(e) =>
                  setPreferredCurrency(e.target.value as 'USD' | 'RWF' | 'EUR' | 'GBP')
                }
                className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              >
                <option value="USD">USD ($)</option>
                <option value="RWF">RWF (FRw)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#69766E] mb-1">Travel Style</label>
            <select
              value={travelStyle}
              onChange={(e) => setTravelStyle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
            >
              <option value="Nature & Wildlife">Nature & Wildlife</option>
              <option value="Luxury Eco-Lodges">Luxury Eco-Lodges</option>
              <option value="Adventure & Trekking">Adventure & Trekking</option>
              <option value="Cultural Heritage & Museums">Cultural Heritage & Museums</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#69766E] mb-1">
              Visited Places (Travel History, comma-separated)
            </label>
            <textarea
              rows={2}
              value={historyText}
              onChange={(e) => setHistoryText(e.target.value)}
              placeholder="Kigali, Musanze, Lake Kivu..."
              className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            {profileSaved ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#16865B]">
                <Check className="w-4 h-4" />
                <span>Preferences saved</span>
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg cursor-pointer"
            >
              {savingProfile ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>

        {/* Right: Saved Places, Itineraries, Reviews & Notifications */}
        <div className="lg:col-span-7 space-y-6">
          {/* Saved & Favorited Destinations */}
          <section className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-[#123D2B]">
                Saved & Favorited Destinations ({favorites.length})
              </h2>
              <Link to="/discover" className="text-xs font-semibold text-[#16865B]">
                Discover more →
              </Link>
            </div>

            {favorites.length === 0 ? (
              <p className="text-sm text-[#69766E]">
                You haven’t saved any destinations yet. Tap the heart or bookmark icon on any
                attraction.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {favorites.map((fav) => (
                  <Link
                    key={fav.id}
                    to={`/destinations/${fav.destination.slug}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] hover:border-[#16865B]"
                  >
                    <div className="w-16 h-14 rounded overflow-hidden shrink-0">
                      <SafeImage
                        src={fav.destination.primaryImage}
                        alt={fav.destination.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[11px] text-[#69766E]">
                        {fav.collectionType === 'favorite' ? (
                          <Heart className="w-3 h-3 fill-[#D9A441] text-[#D9A441]" />
                        ) : (
                          <Bookmark className="w-3 h-3 fill-[#16865B] text-[#16865B]" />
                        )}
                        <span className="capitalize">{fav.collectionType}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#123D2B] truncate">
                        {fav.destination.name}
                      </p>
                      <p className="text-xs text-[#69766E] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{fav.destination.district}</span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Saved Itineraries */}
          <section className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-[#123D2B]">
                Saved Itineraries ({itineraries.length})
              </h2>
              <Link to="/planner" className="text-xs font-semibold text-[#16865B]">
                Open Planner →
              </Link>
            </div>
            {itineraries.length === 0 ? (
              <p className="text-sm text-[#69766E]">
                No custom itineraries saved yet. Build one in the Travel Planner.
              </p>
            ) : (
              <div className="space-y-2.5">
                {itineraries.map((it) => (
                  <Link
                    key={it.id}
                    to={`/planner/${it.shareCode}`}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] hover:border-[#16865B]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#123D2B]">{it.title}</p>
                      <p className="text-xs text-[#69766E] tabular-nums">
                        {it.startDate} → {it.endDate} · {it.totalDistanceKm} km
                      </p>
                    </div>
                    <Route className="w-4 h-4 text-[#16865B]" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Reviews & Notifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-3">
              <h3 className="font-serif text-lg font-semibold text-[#123D2B]">
                Your Reviews ({reviews.length})
              </h3>
              {reviews.length === 0 ? (
                <p className="text-xs text-[#69766E]">No reviews published yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {reviews.map((r) => (
                    <Link
                      key={r.id}
                      to={`/destinations/${r.destinationSlug}`}
                      className="block p-3 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] text-xs space-y-1"
                    >
                      <div className="flex justify-between font-semibold text-[#123D2B]">
                        <span className="truncate">{r.destinationName}</span>
                        <span className="inline-flex items-center gap-0.5 tabular-nums">
                          <Star className="w-3 h-3 fill-[#D9A441] text-[#D9A441]" />
                          {r.rating}
                        </span>
                      </div>
                      <p className="text-[#69766E] truncate">{r.title}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#16865B]" />
                <h3 className="font-serif text-lg font-semibold text-[#123D2B]">Notifications</h3>
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-[#69766E]">You’re all caught up.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-lg border text-xs space-y-1 ${
                        n.isRead ? 'bg-[#FAF9F5] border-[#E3E9E4]' : 'bg-white border-[#16865B]'
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[#123D2B]">{n.title}</span>
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            className="text-[11px] text-[#16865B] font-medium cursor-pointer"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                      <p className="text-[#69766E]">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
