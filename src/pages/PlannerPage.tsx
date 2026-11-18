import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  Copy,
  Plus,
  Route,
  Save,
  Share2,
  Trash2,
} from 'lucide-react';
import { Destination, Itinerary, ItineraryDay, RouteResult } from '../types/tourism.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { RwandaMap } from '../components/map/RwandaMap.tsx';

export const PlannerPage: React.FC = () => {
  const { shareCode } = useParams<{ shareCode?: string }>();
  const [searchParams] = useSearchParams();
  const { profile, apiFetch, signInWithGoogle } = useAuth();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [recommended, setRecommended] = useState<Itinerary[]>([]);
  const [myItineraries, setMyItineraries] = useState<Itinerary[]>([]);

  // Active editor state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeShareCode, setActiveShareCode] = useState<string | null>(null);
  const [title, setTitle] = useState('My Rwanda Discovery Route');
  const [description, setDescription] = useState('Custom multi-day itinerary across Rwanda.');
  const [startDate, setStartDate] = useState('2026-07-15');
  const [endDate, setEndDate] = useState('2026-07-18');
  const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'cycling'>('driving');
  const [isPublic, setIsPublic] = useState(false);
  const [days, setDays] = useState<ItineraryDay[]>([
    { dayNumber: 1, dateLabel: 'Day 1', notes: '', stops: [] },
    { dayNumber: 2, dateLabel: 'Day 2', notes: '', stops: [] },
  ]);

  const [selectedAddDestId, setSelectedAddDestId] = useState<string>('');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const loadData = async () => {
    const [destRes, itinRes] = await Promise.all([
      apiFetch<{ destinations: Destination[] }>('/api/destinations'),
      apiFetch<{ recommended: Itinerary[]; mine: Itinerary[] }>('/api/itineraries'),
    ]);
    setDestinations(destRes.destinations);
    setRecommended(itinRes.recommended);
    setMyItineraries(itinRes.mine);
    if (destRes.destinations.length > 0 && !selectedAddDestId) {
      setSelectedAddDestId(String(destRes.destinations[0].id));
    }

    // Handle ?add=destId
    const addId = Number(searchParams.get('add'));
    if (addId) {
      const found = destRes.destinations.find((d) => d.id === addId);
      if (found) {
        setDays((prev) => {
          const next = [...prev];
          if (!next[0].stops.some((s) => s.destinationId === found.id)) {
            next[0] = {
              ...next[0],
              stops: [
                ...next[0].stops,
                { destinationId: found.id, visitDurationMin: 180, destination: found },
              ],
            };
          }
          return next;
        });
      }
    }

    // Load shared itinerary if shareCode in URL
    if (shareCode) {
      const shared = await apiFetch<{ itinerary: Itinerary }>(`/api/itineraries/${shareCode}`).catch(() => null);
      if (shared?.itinerary) {
        loadItineraryIntoEditor(shared.itinerary, false);
      }
    }
  };

  useEffect(() => {
    void loadData();
  }, [shareCode, profile?.id]);

  const loadItineraryIntoEditor = (itin: Itinerary, asOwnerEdit: boolean) => {
    setEditingId(asOwnerEdit ? itin.id : null);
    setActiveShareCode(itin.shareCode);
    setTitle(asOwnerEdit ? itin.title : `${itin.title} (Copy)`);
    setDescription(itin.description || '');
    setStartDate(itin.startDate);
    setEndDate(itin.endDate);
    setTravelMode(itin.travelMode);
    setIsPublic(asOwnerEdit ? itin.isPublic : false);
    setDays(
      itin.days.length > 0
        ? itin.days.map((d) => ({
            dayNumber: d.dayNumber,
            dateLabel: d.dateLabel || `Day ${d.dayNumber}`,
            notes: d.notes || '',
            stops: d.stops.map((s) => ({
              destinationId: s.destinationId,
              visitDurationMin: s.visitDurationMin,
              notes: s.notes || '',
              destination: s.destination || destinations.find((x) => x.id === s.destinationId) || null,
            })),
          }))
        : [{ dayNumber: 1, dateLabel: 'Day 1', notes: '', stops: [] }]
    );
    setFeedback(asOwnerEdit ? `Editing "${itin.title}"` : `Loaded "${itin.title}" into planner`);
  };

  // Ordered sequence of destinations across all days for OSRM route visualization
  const orderedStops = useMemo(() => {
    const all: Destination[] = [];
    days.forEach((day) => {
      day.stops.forEach((s) => {
        const d = s.destination || destinations.find((x) => x.id === s.destinationId);
        if (d) all.push(d);
      });
    });
    return all;
  }, [days, destinations]);

  useEffect(() => {
    if (orderedStops.length < 2) {
      setRouteResult(null);
      return;
    }
    const waypoints = orderedStops.map((d) => `${d.longitude},${d.latitude}`).join(';');
    fetch(`/api/external/route?profile=${travelMode}&waypoints=${waypoints}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res: RouteResult | null) => setRouteResult(res))
      .catch(() => {});
  }, [orderedStops, travelMode]);

  const handleAddStop = () => {
    const dest = destinations.find((d) => String(d.id) === selectedAddDestId);
    if (!dest) return;
    setDays((prev) =>
      prev.map((day, idx) =>
        idx === selectedDayIndex
          ? {
              ...day,
              stops: [
                ...day.stops,
                { destinationId: dest.id, visitDurationMin: 180, destination: dest },
              ],
            }
          : day
      )
    );
  };

  const handleAddDay = () => {
    setDays((prev) => [
      ...prev,
      { dayNumber: prev.length + 1, dateLabel: `Day ${prev.length + 1}`, notes: '', stops: [] },
    ]);
  };

  const moveStop = (dayIdx: number, stopIdx: number, dir: -1 | 1) => {
    setDays((prev) =>
      prev.map((day, idx) => {
        if (idx !== dayIdx) return day;
        const targetIdx = stopIdx + dir;
        if (targetIdx < 0 || targetIdx >= day.stops.length) return day;
        const nextStops = [...day.stops];
        [nextStops[stopIdx], nextStops[targetIdx]] = [nextStops[targetIdx], nextStops[stopIdx]];
        return { ...day, stops: nextStops };
      })
    );
  };

  const removeStop = (dayIdx: number, stopIdx: number) => {
    setDays((prev) =>
      prev.map((day, idx) =>
        idx === dayIdx
          ? { ...day, stops: day.stops.filter((_, sIdx) => sIdx !== stopIdx) }
          : day
      )
    );
  };

  const handleSaveItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        title,
        description,
        startDate,
        endDate,
        travelMode,
        totalDistanceKm: routeResult?.distanceKm || 0,
        estimatedDurationMin: routeResult?.durationMin || 0,
        isPublic,
        days: days.map((d, idx) => ({
          dayNumber: idx + 1,
          dateLabel: d.dateLabel || `Day ${idx + 1}`,
          notes: d.notes || '',
          stops: d.stops.map((s) => ({
            destinationId: s.destinationId,
            visitDurationMin: s.visitDurationMin,
            notes: s.notes || '',
          })),
        })),
      };

      const res = editingId
        ? await apiFetch<{ itinerary: Itinerary }>(`/api/itineraries/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ itinerary: Itinerary }>('/api/itineraries', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setEditingId(res.itinerary.id);
      setActiveShareCode(res.itinerary.shareCode);
      setFeedback('Itinerary saved to your account.');
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to save itinerary');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItinerary = async (id: number) => {
    try {
      await apiFetch(`/api/itineraries/${id}`, { method: 'DELETE' });
      if (editingId === id) setEditingId(null);
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to delete itinerary');
    }
  };

  const handleCopyShareLink = async () => {
    if (!activeShareCode) return;
    const url = `${window.location.origin}/planner/${activeShareCode}`;
    await navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E3E9E4] pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#16865B]">Multi-Day Trip Builder</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#123D2B]">
            Rwanda Travel Itinerary Planner
          </h1>
          <p className="text-sm text-[#69766E]">
            Arrange destinations day by day, compute live OSRM road distances, save plans, and share
            routes.
          </p>
        </div>

        {activeShareCode && (
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white border border-[#E3E9E4] hover:border-[#16865B] text-[#123D2B] rounded-lg cursor-pointer self-start"
          >
            {copiedShare ? <Check className="w-4 h-4 text-[#16865B]" /> : <Share2 className="w-4 h-4" />}
            <span>{copiedShare ? 'Share Link Copied' : 'Copy Share Link'}</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Day-by-day Planner Form */}
        <form onSubmit={handleSaveItinerary} className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-[#E3E9E4] rounded-xl p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#123D2B]">
              Trip Configuration
            </h2>

            <div>
              <label className="block text-xs font-medium text-[#69766E] mb-1">Itinerary Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg focus:outline-none focus:border-[#16865B]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#69766E] mb-1">Travel Mode</label>
                <select
                  value={travelMode}
                  onChange={(e) => setTravelMode(e.target.value as 'driving' | 'walking' | 'cycling')}
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
                >
                  <option value="driving">4x4 / Driving</option>
                  <option value="cycling">Cycling</option>
                  <option value="walking">Trekking / Walking</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#69766E] mb-1">Notes</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              />
            </div>
          </div>

          {/* Add Destination Stop Toolbar */}
          <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#123D2B]">Add Destination to Day</h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <select
                value={selectedAddDestId}
                onChange={(e) => setSelectedAddDestId(e.target.value)}
                className="sm:col-span-6 px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              >
                {destinations.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name} ({d.province})
                  </option>
                ))}
              </select>

              <select
                value={selectedDayIndex}
                onChange={(e) => setSelectedDayIndex(Number(e.target.value))}
                className="sm:col-span-3 px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E3E9E4] rounded-lg"
              >
                {days.map((day, idx) => (
                  <option key={idx} value={idx}>
                    Day {idx + 1}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddStop}
                className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#16865B] hover:bg-[#123D2B] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stop</span>
              </button>
            </div>
          </div>

          {/* Day Cards */}
          <div className="space-y-4">
            {days.map((day, dayIdx) => (
              <div key={dayIdx} className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#16865B]" />
                    <input
                      type="text"
                      value={day.dateLabel || `Day ${dayIdx + 1}`}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((d, i) => (i === dayIdx ? { ...d, dateLabel: e.target.value } : d))
                        )
                      }
                      className="font-semibold text-sm text-[#123D2B] bg-transparent border-b border-transparent focus:border-[#16865B] focus:outline-none"
                    />
                  </div>
                  {days.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDays((prev) => prev.filter((_, i) => i !== dayIdx))}
                      className="text-xs text-[#69766E] hover:text-red-600 cursor-pointer"
                    >
                      Remove day
                    </button>
                  )}
                </div>

                {day.stops.length === 0 ? (
                  <p className="text-xs text-[#69766E] py-3 border border-dashed border-[#E3E9E4] rounded-lg text-center">
                    No stops scheduled for Day {dayIdx + 1} yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {day.stops.map((stop, stopIdx) => {
                      const dest =
                        stop.destination || destinations.find((x) => x.id === stop.destinationId);
                      return (
                        <div
                          key={`${dayIdx}-${stopIdx}`}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4]"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#123D2B] truncate">
                              {dest?.name || 'Destination'}
                            </p>
                            <p className="text-xs text-[#69766E]">
                              {dest?.district} · {stop.visitDurationMin} min visit
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveStop(dayIdx, stopIdx, -1)}
                              className="p-1.5 text-[#69766E] hover:text-[#123D2B] cursor-pointer"
                              aria-label="Move stop up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStop(dayIdx, stopIdx, 1)}
                              className="p-1.5 text-[#69766E] hover:text-[#123D2B] cursor-pointer"
                              aria-label="Move stop down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStop(dayIdx, stopIdx)}
                              className="p-1.5 text-[#69766E] hover:text-red-600 cursor-pointer"
                              aria-label="Remove stop"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddDay}
              className="w-full py-2.5 text-xs font-semibold text-[#123D2B] bg-white border border-dashed border-[#16865B]/50 hover:border-[#16865B] rounded-xl cursor-pointer"
            >
              + Add Another Day
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-[#202923] cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="accent-[#16865B]"
              />
              <span>Allow public viewing via share link</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#123D2B] hover:bg-[#16865B] rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : profile ? 'Save Itinerary' : 'Sign In & Save'}</span>
            </button>
          </div>
          {feedback && <p className="text-xs font-medium text-[#16865B]">{feedback}</p>}
        </form>

        {/* Right: Live Route Map + Saved & Recommended Itineraries */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-[#16865B]" />
                <h2 className="font-semibold text-sm text-[#123D2B]">Route Visualization</h2>
              </div>
              {routeResult ? (
                <div className="text-xs font-semibold text-[#123D2B] tabular-nums">
                  {routeResult.distanceKm} km · {Math.floor(routeResult.durationMin / 60)}h{' '}
                  {routeResult.durationMin % 60}m ({travelMode})
                </div>
              ) : (
                <span className="text-xs text-[#69766E]">Add at least 2 stops to draw route</span>
              )}
            </div>

            <RwandaMap
              destinations={orderedStops.length > 0 ? orderedStops : destinations}
              routeCoordinates={routeResult?.coordinates || []}
              clusterMarkers={false}
              heightClassName="h-[380px]"
            />
          </div>

          {/* Saved Personal Itineraries */}
          {myItineraries.length > 0 && (
            <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-3">
              <h3 className="font-serif text-lg font-semibold text-[#123D2B]">
                Your Saved Itineraries
              </h3>
              <div className="space-y-2.5">
                {myItineraries.map((it) => (
                  <div
                    key={it.id}
                    className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#123D2B] truncate">{it.title}</p>
                      <p className="text-xs text-[#69766E] tabular-nums">
                        {it.days.length} days · {it.totalDistanceKm} km · {it.startDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadItineraryIntoEditor(it, true)}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-[#E3E9E4] hover:border-[#16865B] rounded-md cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItinerary(it.id)}
                        className="p-1.5 text-[#69766E] hover:text-red-600 cursor-pointer"
                        aria-label="Delete itinerary"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Public Templates */}
          <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-3">
            <h3 className="font-serif text-lg font-semibold text-[#123D2B]">
              Curated Rwanda Templates
            </h3>
            <div className="space-y-2.5">
              {recommended.map((it) => (
                <div
                  key={it.id}
                  className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#123D2B] truncate">{it.title}</p>
                    <p className="text-xs text-[#69766E] tabular-nums">
                      {it.days.length} days · {it.totalDistanceKm} km
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadItineraryIntoEditor(it, false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#123D2B] bg-white border border-[#E3E9E4] hover:border-[#16865B] rounded-md cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Load</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
