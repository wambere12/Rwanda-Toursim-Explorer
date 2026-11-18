import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  Check,
  Flag,
  FolderKanban,
  MapPin,
  MessageSquare,
  Plus,
  Settings,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Accommodation, Category, Destination } from '../types/tourism.ts';
import { useAuth } from '../context/AuthContext.tsx';

type AdminTab =
  | 'analytics'
  | 'destinations'
  | 'providers'
  | 'accommodations'
  | 'reviews'
  | 'users'
  | 'settings';

interface AdminOverview {
  stats: {
    totalUsers: number;
    totalDestinations: number;
    totalProviders: number;
    pendingProviders: number;
    totalReviews: number;
    totalInquiries: number;
    openReports: number;
    totalItineraries: number;
  };
  popularDestinations: Array<{
    id: number;
    name: string;
    province: string;
    district: string;
    popularityScore: number;
  }>;
  byProvince: Array<{ province: string; total: number }>;
  recentActivity: Array<{
    id: number;
    title: string;
    rating: number;
    authorName: string;
    destinationName: string;
    createdAt: string;
  }>;
}

interface AdminProvider {
  id: number;
  businessName: string;
  providerType: string;
  licenseNumber: string | null;
  district: string;
  contactEmail: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  nationality: string | null;
  roles: string[];
  createdAt: string;
}

interface AdminReview {
  id: number;
  rating: number;
  title: string;
  comment: string;
  moderationStatus: string;
  authorName: string;
  destinationName: string;
}

interface AdminReport {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface PlatformSetting {
  id: number;
  key: string;
  value: string;
  description: string | null;
}

export const AdminDashboardPage: React.FC = () => {
  const { profile, isAdmin, loading, apiFetch, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<AdminTab>('analytics');

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [fetching, setFetching] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Create Destination form
  const [newDestName, setNewDestName] = useState('');
  const [newDestCatId, setNewDestCatId] = useState<number>(1);
  const [newDestDistrict, setNewDestDistrict] = useState('');
  const [newDestProvince, setNewDestProvince] = useState('Northern');
  const [newDestLat, setNewDestLat] = useState(-1.5);
  const [newDestLon, setNewDestLon] = useState(29.6);
  const [newDestSummary, setNewDestSummary] = useState('');
  const [newDestDesc, setNewDestDesc] = useState('');

  // Create Category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Create Accommodation form
  const [newAccomName, setNewAccomName] = useState('');
  const [newAccomType, setNewAccomType] = useState<'lodge' | 'hotel' | 'resort' | 'guesthouse' | 'campsite' | 'apartment'>('lodge');
  const [newAccomDistrict, setNewAccomDistrict] = useState('Musanze');
  const [newAccomProvince, setNewAccomProvince] = useState('Northern');
  const [newAccomPrice, setNewAccomPrice] = useState('$150 – $280 / night');

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setFetching(true);
    try {
      const [ov, destRes, catRes, provRes, accomRes, userRes, revRes, repRes, setRes] =
        await Promise.all([
          apiFetch<AdminOverview>('/api/admin/overview'),
          apiFetch<{ destinations: Destination[] }>('/api/destinations'),
          apiFetch<{ categories: Category[] }>('/api/categories'),
          apiFetch<{ providers: AdminProvider[] }>('/api/admin/providers'),
          apiFetch<{ accommodations: Accommodation[] }>('/api/accommodations'),
          apiFetch<{ users: AdminUser[] }>('/api/admin/users'),
          apiFetch<{ reviews: AdminReview[] }>('/api/admin/reviews'),
          apiFetch<{ reports: AdminReport[] }>('/api/admin/reports'),
          apiFetch<{ settings: PlatformSetting[] }>('/api/admin/settings'),
        ]);
      setOverview(ov);
      setDestinations(destRes.destinations);
      setCategories(catRes.categories);
      if (catRes.categories[0]) setNewDestCatId(catRes.categories[0].id);
      setProviders(provRes.providers);
      setAccommodations(accomRes.accommodations);
      setUsers(userRes.users);
      setReviews(revRes.reviews);
      setReports(repRes.reports);
      setSettings(setRes.settings);
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, [isAdmin]);

  const notify = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleCreateDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/destinations', {
      method: 'POST',
      body: JSON.stringify({
        name: newDestName,
        categoryId: Number(newDestCatId),
        district: newDestDistrict,
        province: newDestProvince,
        latitude: Number(newDestLat),
        longitude: Number(newDestLon),
        shortSummary: newDestSummary,
        description: newDestDesc,
        entranceInfo: 'Check Rwanda Development Board reception on arrival.',
        activities: ['Guided Tour', 'Photography'],
        visitorGuidelines: 'Respect conservation rules and local community guidance.',
        featured: false,
      }),
    });
    setNewDestName('');
    setNewDestDistrict('');
    setNewDestSummary('');
    setNewDestDesc('');
    notify('Destination published.');
    await loadAdminData();
  };

  const handleDeleteDestination = async (id: number) => {
    await apiFetch(`/api/admin/destinations/${id}`, { method: 'DELETE' });
    notify('Destination deleted.');
    await loadAdminData();
  };

  const handleToggleFeatured = async (dest: Destination) => {
    await apiFetch(`/api/admin/destinations/${dest.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ featured: !dest.featured }),
    });
    await loadAdminData();
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: newCatName, description: newCatDesc }),
    });
    setNewCatName('');
    setNewCatDesc('');
    notify('Category added.');
    await loadAdminData();
  };

  const handleVerifyProvider = async (id: number, status: 'verified' | 'rejected') => {
    await apiFetch(`/api/admin/providers/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    notify(`Provider marked as ${status}.`);
    await loadAdminData();
  };

  const handleCreateAccommodation = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/accommodations', {
      method: 'POST',
      body: JSON.stringify({
        name: newAccomName,
        accommodationType: newAccomType,
        description: `${newAccomName} located in ${newAccomDistrict}, ${newAccomProvince} Province.`,
        district: newAccomDistrict,
        province: newAccomProvince,
        address: `${newAccomDistrict} Center`,
        latitude: -1.94,
        longitude: 30.06,
        verifiedPriceRange: newAccomPrice,
        facilities: ['Wi-Fi', 'Breakfast', '24h Reception'],
      }),
    });
    setNewAccomName('');
    notify('Accommodation added.');
    await loadAdminData();
  };

  const handleDeleteAccommodation = async (id: number) => {
    await apiFetch(`/api/admin/accommodations/${id}`, { method: 'DELETE' });
    notify('Accommodation removed.');
    await loadAdminData();
  };

  const handleModerateReview = async (id: number, status: 'approved' | 'flagged' | 'removed') => {
    await apiFetch(`/api/admin/reviews/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    notify(`Review marked ${status}.`);
    await loadAdminData();
  };

  const handleResolveReport = async (id: number, status: 'resolved' | 'dismissed') => {
    await apiFetch(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    notify(`Report ${status}.`);
    await loadAdminData();
  };

  const handleToggleUserRole = async (userId: number, role: 'admin' | 'provider', hasRole: boolean) => {
    await apiFetch(`/api/admin/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ role, action: hasRole ? 'remove' : 'add' }),
    });
    notify('User roles updated.');
    await loadAdminData();
  };

  const handleSaveSetting = async (setting: PlatformSetting, nextValue: string) => {
    await apiFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        key: setting.key,
        value: nextValue,
        description: setting.description || undefined,
      }),
    });
    notify(`Updated ${setting.key}`);
    await loadAdminData();
  };

  if (loading) {
    return <div className="p-12 text-center text-sm text-[#69766E]">Checking access...</div>;
  }

  if (!profile || !isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-5">
        <Shield className="w-12 h-12 text-[#123D2B] mx-auto" />
        <h1 className="font-serif text-3xl font-bold text-[#123D2B]">
          Administrator Access Required
        </h1>
        <p className="text-sm text-[#69766E]">
          This workspace is restricted to authorized Rwanda Tourism Explorer administrators for
          destination management, provider verification, and moderation.
        </p>
        {!profile && (
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="px-6 py-3 text-sm font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg cursor-pointer"
          >
            Sign In with Google
          </button>
        )}
      </div>
    );
  }

  const SIDEBAR_ITEMS: Array<{ key: AdminTab; label: string; icon: React.ReactNode }> = [
    { key: 'analytics', label: 'Analytics Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'destinations', label: 'Destinations & Categories', icon: <MapPin className="w-4 h-4" /> },
    { key: 'providers', label: 'Provider Verification', icon: <FolderKanban className="w-4 h-4" /> },
    { key: 'accommodations', label: 'Accommodations', icon: <Building2 className="w-4 h-4" /> },
    { key: 'reviews', label: 'Reviews & Reports', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'users', label: 'Users & Roles', icon: <Users className="w-4 h-4" /> },
    { key: 'settings', label: 'Platform Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const maxProvinceCount = Math.max(...(overview?.byProvince.map((p) => p.total) || [1]), 1);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-white">
      {/* Forest Green SaaS Sidebar */}
      <aside className="lg:w-64 bg-[#123D2B] text-[#FAF9F5] p-5 shrink-0 space-y-6">
        <div className="border-b border-white/15 pb-4">
          <p className="text-xs text-[#D9A441] font-medium">Governance Console</p>
          <h1 className="font-serif text-xl font-bold text-white mt-0.5">Tourism Admin</h1>
        </div>

        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                tab === item.key
                  ? 'bg-[#16865B] text-white'
                  : 'text-[#FAF9F5]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main White SaaS Workspace */}
      <main className="flex-1 p-6 lg:p-10 bg-white space-y-8 overflow-x-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E3E9E4] pb-4">
          <div>
            <p className="text-xs text-[#69766E]">Rwanda Tourism Explorer / Administration</p>
            <h2 className="font-serif text-2xl font-bold text-[#123D2B]">
              {SIDEBAR_ITEMS.find((i) => i.key === tab)?.label}
            </h2>
          </div>
          {actionMsg && (
            <span className="text-xs font-semibold text-[#16865B]">{actionMsg}</span>
          )}
        </div>

        {fetching && !overview ? (
          <div className="h-48 bg-[#FAF9F5] rounded-xl animate-pulse" />
        ) : null}

        {/* TAB 1: ANALYTICS OVERVIEW */}
        {tab === 'analytics' && overview && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Registered Users', value: overview.stats.totalUsers },
                { label: 'Published Destinations', value: overview.stats.totalDestinations },
                { label: 'Tourism Providers', value: `${overview.stats.totalProviders} (${overview.stats.pendingProviders} pending)` },
                { label: 'Reviews & Inquiries', value: `${overview.stats.totalReviews} / ${overview.stats.totalInquiries}` },
              ].map((kpi) => (
                <div key={kpi.label} className="border border-[#E3E9E4] rounded-xl p-5 bg-[#FAF9F5]/50">
                  <p className="text-xs text-[#69766E]">{kpi.label}</p>
                  <p className="text-2xl font-semibold text-[#123D2B] mt-1 tabular-nums">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Destinations by Province Chart */}
              <div className="lg:col-span-6 border border-[#E3E9E4] rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-sm text-[#123D2B]">
                  Destinations Distribution by Province
                </h3>
                <div className="space-y-3">
                  {overview.byProvince.map((row) => (
                    <div key={row.province} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#202923]">{row.province}</span>
                        <span className="font-mono text-[#69766E] tabular-nums">{row.total}</span>
                      </div>
                      <div className="h-2.5 bg-[#FAF9F5] rounded-full overflow-hidden border border-[#E3E9E4]">
                        <div
                          className="h-full bg-[#16865B] rounded-full"
                          style={{ width: `${Math.round((row.total / maxProvinceCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Popular Destinations Leaderboard */}
              <div className="lg:col-span-6 border border-[#E3E9E4] rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-sm text-[#123D2B]">
                  Most Popular Destinations
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E3E9E4] text-[#69766E] text-left">
                      <th className="pb-2 font-medium">Destination</th>
                      <th className="pb-2 font-medium">Province</th>
                      <th className="pb-2 font-medium text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E9E4]">
                    {overview.popularDestinations.map((d) => (
                      <tr key={d.id} className="h-9">
                        <td className="font-medium text-[#123D2B]">{d.name}</td>
                        <td className="text-[#69766E]">{d.province}</td>
                        <td className="text-right font-mono tabular-nums text-[#16865B]">
                          {d.popularityScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DESTINATIONS & CATEGORIES */}
        {tab === 'destinations' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleCreateDestination}
                className="lg:col-span-8 border border-[#E3E9E4] rounded-xl p-6 space-y-4"
              >
                <h3 className="font-semibold text-sm text-[#123D2B]">Add New Destination</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newDestName}
                    onChange={(e) => setNewDestName(e.target.value)}
                    placeholder="Destination name"
                    className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                  />
                  <select
                    value={newDestCatId}
                    onChange={(e) => setNewDestCatId(Number(e.target.value))}
                    className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={newDestDistrict}
                    onChange={(e) => setNewDestDistrict(e.target.value)}
                    placeholder="District (e.g., Musanze)"
                    className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                  />
                  <select
                    value={newDestProvince}
                    onChange={(e) => setNewDestProvince(e.target.value)}
                    className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                  >
                    <option value="Kigali City">Kigali City</option>
                    <option value="Northern">Northern</option>
                    <option value="Southern">Southern</option>
                    <option value="Eastern">Eastern</option>
                    <option value="Western">Western</option>
                  </select>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDestLat}
                    onChange={(e) => setNewDestLat(Number(e.target.value))}
                    placeholder="Latitude"
                    className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg font-mono"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDestLon}
                    onChange={(e) => setNewDestLon(Number(e.target.value))}
                    placeholder="Longitude"
                    className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg font-mono"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={newDestSummary}
                  onChange={(e) => setNewDestSummary(e.target.value)}
                  placeholder="Short editorial summary"
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
                <textarea
                  rows={2}
                  required
                  value={newDestDesc}
                  onChange={(e) => setNewDestDesc(e.target.value)}
                  placeholder="Full destination description..."
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Publish Destination</span>
                </button>
              </form>

              <form
                onSubmit={handleCreateCategory}
                className="lg:col-span-4 border border-[#E3E9E4] rounded-xl p-6 space-y-3"
              >
                <h3 className="font-semibold text-sm text-[#123D2B]">Add Category</h3>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
                <textarea
                  rows={2}
                  required
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Category description"
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#16865B] rounded-lg cursor-pointer"
                >
                  Create Category
                </button>
              </form>
            </div>

            <div className="border border-[#E3E9E4] rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#FAF9F5] border-b border-[#E3E9E4] text-[#69766E] text-left">
                  <tr>
                    <th className="p-3.5 font-medium">Destination</th>
                    <th className="p-3.5 font-medium">Category</th>
                    <th className="p-3.5 font-medium">Location</th>
                    <th className="p-3.5 font-medium">Featured</th>
                    <th className="p-3.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E9E4]">
                  {destinations.map((d) => (
                    <tr key={d.id} className="hover:bg-[#FAF9F5]/60">
                      <td className="p-3.5 font-semibold text-[#123D2B]">{d.name}</td>
                      <td className="p-3.5 text-[#69766E]">{d.category?.name}</td>
                      <td className="p-3.5 text-[#69766E]">
                        {d.district}, {d.province}
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(d)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                            d.featured
                              ? 'bg-[#D9A441]/20 text-[#123D2B]'
                              : 'bg-[#FAF9F5] text-[#69766E] border border-[#E3E9E4]'
                          }`}
                        >
                          {d.featured ? 'Featured' : 'Standard'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteDestination(d.id)}
                          className="text-[#69766E] hover:text-red-600 cursor-pointer"
                          aria-label={`Delete ${d.name}`}
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PROVIDER VERIFICATION */}
        {tab === 'providers' && (
          <div className="border border-[#E3E9E4] rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#FAF9F5] border-b border-[#E3E9E4] text-[#69766E] text-left">
                <tr>
                  <th className="p-3.5 font-medium">Business</th>
                  <th className="p-3.5 font-medium">Type & License</th>
                  <th className="p-3.5 font-medium">District</th>
                  <th className="p-3.5 font-medium">Status</th>
                  <th className="p-3.5 font-medium text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E9E4]">
                {providers.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3.5">
                      <p className="font-semibold text-[#123D2B]">{p.businessName}</p>
                      <p className="text-[#69766E]">{p.contactEmail}</p>
                    </td>
                    <td className="p-3.5 capitalize text-[#202923]">
                      {p.providerType.replace('_', ' ')} · {p.licenseNumber || 'Unlisted'}
                    </td>
                    <td className="p-3.5 text-[#69766E]">{p.district}</td>
                    <td className="p-3.5 capitalize font-semibold text-[#123D2B]">
                      {p.verificationStatus}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleVerifyProvider(p.id, 'verified')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#16865B] text-white rounded cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Verify</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyProvider(p.id, 'rejected')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#E3E9E4] text-[#69766E] rounded cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: ACCOMMODATIONS */}
        {tab === 'accommodations' && (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateAccommodation}
              className="border border-[#E3E9E4] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3"
            >
              <input
                type="text"
                required
                value={newAccomName}
                onChange={(e) => setNewAccomName(e.target.value)}
                placeholder="Property name"
                className="sm:col-span-2 px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
              <select
                value={newAccomType}
                onChange={(e) =>
                  setNewAccomType(
                    e.target.value as 'lodge' | 'hotel' | 'resort' | 'guesthouse' | 'campsite' | 'apartment'
                  )
                }
                className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              >
                <option value="lodge">Lodge</option>
                <option value="hotel">Hotel</option>
                <option value="resort">Resort</option>
                <option value="guesthouse">Guesthouse</option>
                <option value="campsite">Campsite</option>
                <option value="apartment">Apartment</option>
              </select>
              <input
                type="text"
                required
                value={newAccomDistrict}
                onChange={(e) => setNewAccomDistrict(e.target.value)}
                placeholder="District"
                className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold text-white bg-[#123D2B] rounded-lg cursor-pointer"
              >
                + Add Stay
              </button>
            </form>

            <div className="border border-[#E3E9E4] rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#FAF9F5] border-b border-[#E3E9E4] text-[#69766E] text-left">
                  <tr>
                    <th className="p-3.5 font-medium">Name</th>
                    <th className="p-3.5 font-medium">Type</th>
                    <th className="p-3.5 font-medium">Location</th>
                    <th className="p-3.5 font-medium">Verified Range</th>
                    <th className="p-3.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E9E4]">
                  {accommodations.map((a) => (
                    <tr key={a.id}>
                      <td className="p-3.5 font-semibold text-[#123D2B]">{a.name}</td>
                      <td className="p-3.5 capitalize">{a.accommodationType}</td>
                      <td className="p-3.5 text-[#69766E]">
                        {a.district}, {a.province}
                      </td>
                      <td className="p-3.5 tabular-nums">{a.verifiedPriceRange}</td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteAccommodation(a.id)}
                          className="text-[#69766E] hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: REVIEWS & REPORTS MODERATION */}
        {tab === 'reviews' && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-[#123D2B] flex items-center gap-2">
                <Flag className="w-4 h-4 text-[#D9A441]" />
                <span>Flagged Reports Queue ({reports.length})</span>
              </h3>
              <div className="border border-[#E3E9E4] rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#FAF9F5] border-b border-[#E3E9E4] text-[#69766E] text-left">
                    <tr>
                      <th className="p-3 font-medium">Target</th>
                      <th className="p-3 font-medium">Reason</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E9E4]">
                    {reports.map((rep) => (
                      <tr key={rep.id}>
                        <td className="p-3 capitalize font-medium">
                          {rep.targetType} #{rep.targetId}
                        </td>
                        <td className="p-3 text-[#202923]">{rep.reason}</td>
                        <td className="p-3 capitalize font-semibold">{rep.status}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleResolveReport(rep.id, 'resolved')}
                            className="px-2.5 py-1 bg-[#16865B] text-white rounded cursor-pointer"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveReport(rep.id, 'dismissed')}
                            className="px-2.5 py-1 border border-[#E3E9E4] rounded cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-[#123D2B]">
                Traveler Reviews Moderation ({reviews.length})
              </h3>
              <div className="border border-[#E3E9E4] rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#FAF9F5] border-b border-[#E3E9E4] text-[#69766E] text-left">
                    <tr>
                      <th className="p-3 font-medium">Destination & Author</th>
                      <th className="p-3 font-medium">Review</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E9E4]">
                    {reviews.map((r) => (
                      <tr key={r.id}>
                        <td className="p-3">
                          <p className="font-semibold text-[#123D2B]">{r.destinationName}</p>
                          <p className="text-[#69766E]">
                            {r.authorName} · {r.rating}/5
                          </p>
                        </td>
                        <td className="p-3 max-w-md">
                          <p className="font-medium text-[#202923]">{r.title}</p>
                          <p className="text-[#69766E] line-clamp-2">{r.comment}</p>
                        </td>
                        <td className="p-3 capitalize font-semibold">{r.moderationStatus}</td>
                        <td className="p-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleModerateReview(r.id, 'approved')}
                            className="px-2.5 py-1 bg-[#16865B] text-white rounded cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModerateReview(r.id, 'removed')}
                            className="px-2.5 py-1 border border-[#E3E9E4] text-red-600 rounded cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: USERS & ROLES */}
        {tab === 'users' && (
          <div className="border border-[#E3E9E4] rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#FAF9F5] border-b border-[#E3E9E4] text-[#69766E] text-left">
                <tr>
                  <th className="p-3.5 font-medium">User</th>
                  <th className="p-3.5 font-medium">Email</th>
                  <th className="p-3.5 font-medium">Active Roles</th>
                  <th className="p-3.5 font-medium text-right">Manage Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E9E4]">
                {users.map((u) => {
                  const isAdm = u.roles.includes('admin');
                  const isProv = u.roles.includes('provider');
                  return (
                    <tr key={u.id}>
                      <td className="p-3.5 font-semibold text-[#123D2B]">{u.fullName}</td>
                      <td className="p-3.5 text-[#69766E]">{u.email}</td>
                      <td className="p-3.5 capitalize">{u.roles.join(' · ')}</td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleToggleUserRole(u.id, 'provider', isProv)}
                          className="px-2.5 py-1 border border-[#E3E9E4] rounded cursor-pointer hover:border-[#16865B]"
                        >
                          {isProv ? 'Revoke Provider' : 'Grant Provider'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleUserRole(u.id, 'admin', isAdm)}
                          className="px-2.5 py-1 border border-[#E3E9E4] rounded cursor-pointer hover:border-[#16865B]"
                        >
                          {isAdm ? 'Revoke Admin' : 'Grant Admin'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 7: PLATFORM SETTINGS */}
        {tab === 'settings' && (
          <div className="space-y-4 max-w-2xl">
            {settings.map((s) => (
              <SettingRow key={s.id} setting={s} onSave={handleSaveSetting} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const SettingRow: React.FC<{
  setting: PlatformSetting;
  onSave: (s: PlatformSetting, val: string) => Promise<void>;
}> = ({ setting, onSave }) => {
  const [val, setVal] = useState(setting.value);
  return (
    <div className="border border-[#E3E9E4] rounded-xl p-4 space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs font-semibold text-[#123D2B]">{setting.key}</span>
        <span className="text-xs text-[#69766E]">{setting.description}</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
        />
        <button
          type="button"
          onClick={() => onSave(setting, val)}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] rounded-lg cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
};
