import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  Plus,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { TourismProvider } from '../types/tourism.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface InquiryRow {
  id: number;
  senderName: string;
  senderEmail: string;
  travelDates: string;
  groupSize: number;
  message: string;
  status: string;
  createdAt: string;
}

export const ProvidersPage: React.FC = () => {
  const { profile, apiFetch, signInWithGoogle } = useAuth();

  const [providers, setProviders] = useState<TourismProvider[]>([]);
  const [myProvider, setMyProvider] = useState<TourismProvider | null>(null);
  const [myInquiries, setMyInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'directory' | 'portal'>('directory');

  // Inquiry Modal state
  const [inquiryProvider, setInquiryProvider] = useState<TourismProvider | null>(null);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [travelDates, setTravelDates] = useState('');
  const [groupSize, setGroupSize] = useState(2);
  const [inquiryMsg, setInquiryMsg] = useState('');
  const [inquiryStatus, setInquiryStatus] = useState<string | null>(null);

  // Provider Registration Form state
  const [businessName, setBusinessName] = useState('');
  const [providerType, setProviderType] = useState<'tour_operator' | 'tour_guide' | 'transport_partner'>('tour_operator');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [district, setDistrict] = useState('Kigali');
  const [coverageText, setCoverageText] = useState('Volcanoes National Park, Kigali');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [description, setDescription] = useState('');
  const [portalFeedback, setPortalFeedback] = useState<string | null>(null);

  // New Service / Package quick form
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgDays, setPkgDays] = useState(3);
  const [pkgPrice, setPkgPrice] = useState(650);
  const [pkgSummary, setPkgSummary] = useState('');

  const loadProviders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        providers: TourismProvider[];
        myProvider: TourismProvider | null;
      }>('/api/providers');
      setProviders(res.providers);
      setMyProvider(res.myProvider);
      if (res.myProvider) {
        setBusinessName(res.myProvider.businessName);
        setProviderType(res.myProvider.providerType);
        setLicenseNumber(res.myProvider.licenseNumber || '');
        setDistrict(res.myProvider.district);
        setCoverageText(res.myProvider.destinationCoverage.join(', '));
        setContactEmail(res.myProvider.contactEmail);
        setContactPhone(res.myProvider.contactPhone);
        setDescription(res.myProvider.description);

        const inq = await apiFetch<{ inquiries: InquiryRow[] }>('/api/providers/inquiries');
        setMyInquiries(inq.inquiries);
      }
    } catch (err) {
      console.error('Providers load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
  }, [profile?.id]);

  useEffect(() => {
    if (profile) {
      setSenderName(profile.fullName);
      setSenderEmail(profile.email);
      if (!contactEmail) setContactEmail(profile.email);
    }
  }, [profile]);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryProvider) return;
    try {
      await apiFetch('/api/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          providerId: inquiryProvider.id,
          senderName,
          senderEmail,
          travelDates,
          groupSize,
          message: inquiryMsg,
        }),
      });
      setInquiryStatus(`Inquiry sent directly to ${inquiryProvider.businessName}.`);
      setInquiryMsg('');
      setTravelDates('');
      setTimeout(() => {
        setInquiryProvider(null);
        setInquiryStatus(null);
      }, 1500);
    } catch (err) {
      setInquiryStatus(err instanceof Error ? err.message : 'Failed to send inquiry');
    }
  };

  const handleRegisterProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    setPortalFeedback(null);
    try {
      await apiFetch('/api/providers/register', {
        method: 'POST',
        body: JSON.stringify({
          businessName,
          providerType,
          licenseNumber,
          district,
          destinationCoverage: coverageText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          contactEmail,
          contactPhone,
          description,
        }),
      });
      setPortalFeedback(
        'Provider profile submitted. Administrative verification is required before public verified listing.'
      );
      await loadProviders();
    } catch (err) {
      setPortalFeedback(err instanceof Error ? err.message : 'Failed to save provider profile');
    }
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/providers/packages', {
        method: 'POST',
        body: JSON.stringify({
          title: pkgTitle,
          summary: pkgSummary,
          durationDays: Number(pkgDays),
          priceUsd: Number(pkgPrice),
          inclusions: ['Licensed Guide', 'Park Logistics'],
          maxGroupSize: 6,
        }),
      });
      setPkgTitle('');
      setPkgSummary('');
      setPortalFeedback('Travel package added to your provider catalog.');
      await loadProviders();
    } catch (err) {
      setPortalFeedback(err instanceof Error ? err.message : 'Failed to add travel package');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E3E9E4] pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#16865B]">Licensed Operators & Guides</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#123D2B]">
            Tourism Providers & Tour Packages
          </h1>
          <p className="text-sm text-[#69766E] max-w-2xl">
            Connect with administratively verified Rwandan tour operators, specialist guides, and
            safari transport partners.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white border border-[#E3E9E4] rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-3.5 py-2 text-xs font-medium rounded-md cursor-pointer ${
              activeTab === 'directory' ? 'bg-[#123D2B] text-white' : 'text-[#69766E]'
            }`}
          >
            Verified Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('portal')}
            className={`px-3.5 py-2 text-xs font-medium rounded-md cursor-pointer ${
              activeTab === 'portal' ? 'bg-[#123D2B] text-white' : 'text-[#69766E]'
            }`}
          >
            Partner Portal
          </button>
        </div>
      </header>

      {activeTab === 'directory' ? (
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
              <div key={i} className="bg-white border border-[#E3E9E4] rounded-xl h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {providers.map((prov) => (
                <article
                  key={prov.id}
                  className="bg-white border border-[#E3E9E4] rounded-xl p-6 flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#69766E] capitalize">
                        {prov.providerType.replace('_', ' ')} · {prov.district}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16865B]">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verified Operator</span>
                      </span>
                    </div>

                    <h2 className="font-serif text-2xl font-semibold text-[#123D2B]">
                      {prov.businessName}
                    </h2>
                    <p className="text-sm text-[#202923] leading-relaxed">{prov.description}</p>

                    <div className="text-xs text-[#69766E] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#16865B] shrink-0" />
                      <span>Coverage: {prov.destinationCoverage.join(' · ')}</span>
                    </div>

                    {prov.packages.length > 0 && (
                      <div className="pt-3 border-t border-[#E3E9E4] space-y-2">
                        <p className="text-xs font-semibold text-[#123D2B]">Available Packages</p>
                        {prov.packages.map((pkg) => (
                          <div
                            key={pkg.id}
                            className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-[#123D2B]">{pkg.title}</p>
                              <p className="text-[#69766E]">{pkg.durationDays} days · Max {pkg.maxGroupSize} guests</p>
                            </div>
                            {pkg.priceUsd && (
                              <span className="font-semibold text-[#123D2B] tabular-nums shrink-0">
                                ${pkg.priceUsd.toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#E3E9E4] flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-[#69766E] space-y-0.5">
                      <p className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{prov.contactEmail}</span>
                      </p>
                      <p className="flex items-center gap-1.5 tabular-nums">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{prov.contactPhone}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInquiryProvider(prov)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Inquiry</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )
      ) : (
        /* Partner Registration & Management Portal */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleRegisterProvider}
            className="lg:col-span-7 bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-2xl font-semibold text-[#123D2B]">
                {myProvider ? 'Manage Provider Profile' : 'Register as a Tourism Provider'}
              </h2>
              {myProvider && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    myProvider.verificationStatus === 'verified'
                      ? 'text-[#16865B]'
                      : 'text-[#D9A441]'
                  }`}
                >
                  {myProvider.verificationStatus === 'verified' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  <span className="capitalize">{myProvider.verificationStatus}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">Business / Guide Name</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">Provider Category</label>
                <select
                  value={providerType}
                  onChange={(e) =>
                    setProviderType(e.target.value as 'tour_operator' | 'tour_guide' | 'transport_partner')
                  }
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                >
                  <option value="tour_operator">Tour Operator</option>
                  <option value="tour_guide">Certified Tour Guide</option>
                  <option value="transport_partner">Safari Transport Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">RDB License Number</label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="RDB-TO-2026-..."
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">Base District</label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">Contact Phone</label>
                <input
                  type="text"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+250 788 ..."
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#69766E] mb-1">
                Destination Coverage (comma-separated)
              </label>
              <input
                type="text"
                required
                value={coverageText}
                onChange={(e) => setCoverageText(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#69766E] mb-1">Tour & Service Overview</label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg cursor-pointer"
            >
              {profile ? 'Submit Provider Application' : 'Sign In & Register'}
            </button>
            {portalFeedback && <p className="text-xs font-medium text-[#16865B]">{portalFeedback}</p>}
          </form>

          <div className="lg:col-span-5 space-y-6">
            {myProvider && (
              <>
                <form
                  onSubmit={handleAddPackage}
                  className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-3"
                >
                  <h3 className="font-serif text-lg font-semibold text-[#123D2B]">
                    Publish Tour Package
                  </h3>
                  <input
                    type="text"
                    required
                    value={pkgTitle}
                    onChange={(e) => setPkgTitle(e.target.value)}
                    placeholder="Package title (e.g., 3-Day Akagera Safari)"
                    className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={pkgDays}
                      onChange={(e) => setPkgDays(Number(e.target.value))}
                      placeholder="Days"
                      className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                    />
                    <input
                      type="number"
                      min={10}
                      value={pkgPrice}
                      onChange={(e) => setPkgPrice(Number(e.target.value))}
                      placeholder="Price USD"
                      className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={pkgSummary}
                    onChange={(e) => setPkgSummary(e.target.value)}
                    placeholder="Summary of itinerary and inclusions..."
                    className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#16865B] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Package</span>
                  </button>
                </form>

                <div className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-3">
                  <h3 className="font-serif text-lg font-semibold text-[#123D2B]">
                    Customer Inquiries ({myInquiries.length})
                  </h3>
                  {myInquiries.length === 0 ? (
                    <p className="text-xs text-[#69766E]">No traveler inquiries received yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {myInquiries.map((inq) => (
                        <div
                          key={inq.id}
                          className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] text-xs space-y-1"
                        >
                          <div className="flex justify-between font-semibold text-[#123D2B]">
                            <span>{inq.senderName}</span>
                            <span className="tabular-nums">{inq.groupSize} guests</span>
                          </div>
                          <p className="text-[#69766E]">
                            {inq.senderEmail} · {inq.travelDates}
                          </p>
                          <p className="text-[#202923] pt-1">{inq.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Inquiry Modal */}
      {inquiryProvider && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleInquirySubmit}
            className="bg-white border border-[#E3E9E4] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-serif text-xl font-semibold text-[#123D2B]">
              Inquire with {inquiryProvider.businessName}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
              <input
                type="email"
                required
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="Your email address"
                className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={travelDates}
                  onChange={(e) => setTravelDates(e.target.value)}
                  placeholder="Dates (e.g. Aug 10–14)"
                  className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  placeholder="Guests"
                  className="px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
              </div>
              <textarea
                rows={3}
                required
                value={inquiryMsg}
                onChange={(e) => setInquiryMsg(e.target.value)}
                placeholder="Tell the operator your interests, permit needs, or pick-up location..."
                className="w-full px-3 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
            </div>

            {inquiryStatus && <p className="text-xs font-medium text-[#16865B]">{inquiryStatus}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInquiryProvider(null)}
                className="px-4 py-2 text-xs font-medium text-[#69766E] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#123D2B] rounded-lg cursor-pointer"
              >
                Send Inquiry
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
