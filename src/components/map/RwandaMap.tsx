import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Layers, LocateFixed } from 'lucide-react';
import { Accommodation, Destination } from '../../types/tourism.ts';

export interface TransportHub {
  name: string;
  type: 'Airport' | 'Bus Terminal' | 'Lake Port';
  latitude: number;
  longitude: number;
  note: string;
}

export const RWANDA_TRANSPORT_HUBS: TransportHub[] = [
  {
    name: 'Kigali International Airport (KGL)',
    type: 'Airport',
    latitude: -1.9686,
    longitude: 30.1395,
    note: 'Primary international aviation gateway, 10 km east of Kigali city center.',
  },
  {
    name: 'Kamembe Airport (KME)',
    type: 'Airport',
    latitude: -2.4622,
    longitude: 28.9079,
    note: 'Domestic gateway serving Nyungwe National Park and southern Lake Kivu.',
  },
  {
    name: 'Rubavu Lakeside Port',
    type: 'Lake Port',
    latitude: -1.7031,
    longitude: 29.2564,
    note: 'Northern Lake Kivu ferry and private boat embarkation pier.',
  },
  {
    name: 'Nyabugogo Regional Bus Terminal',
    type: 'Bus Terminal',
    latitude: -1.9396,
    longitude: 30.0444,
    note: 'Inter-provincial express coach hub connecting Musanze, Huye, Karongi, and Kayonza.',
  },
];

type BaseLayerKey = 'osm' | 'topo' | 'voyager';

const BASE_LAYERS: Record<
  BaseLayerKey,
  { label: string; url: string; attribution: string }
> = {
  osm: {
    label: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  topo: {
    label: 'Terrain & Peaks',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | OpenTopoMap',
  },
  voyager: {
    label: 'Clean Editorial',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
};

interface RwandaMapProps {
  destinations: Destination[];
  accommodations?: Accommodation[];
  showAccommodations?: boolean;
  showTransportHubs?: boolean;
  routeCoordinates?: Array<[number, number]>;
  selectedDestinationId?: number | null;
  onSelectDestination?: (dest: Destination) => void;
  focusPoint?: { lat: number; lon: number; zoom?: number } | null;
  heightClassName?: string;
  clusterMarkers?: boolean;
}

const RWANDA_CENTER: [number, number] = [-1.9403, 29.8739];

export const RwandaMap: React.FC<RwandaMapProps> = ({
  destinations,
  accommodations = [],
  showAccommodations = false,
  showTransportHubs = false,
  routeCoordinates = [],
  selectedDestinationId = null,
  onSelectDestination,
  focusPoint = null,
  heightClassName = 'h-[480px]',
  clusterMarkers = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>('voyager');
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: focusPoint ? [focusPoint.lat, focusPoint.lon] : RWANDA_CENTER,
      zoom: focusPoint?.zoom ?? 8,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    const layerDef = BASE_LAYERS[baseLayer];
    const tile = L.tileLayer(layerDef.url, {
      attribution: layerDef.attribution,
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tile;

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  // Switch tile layers cleanly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const layerDef = BASE_LAYERS[baseLayer];
    tileLayerRef.current = L.tileLayer(layerDef.url, {
      attribution: layerDef.attribution,
      maxZoom: 18,
    }).addTo(map);
  }, [baseLayer]);

  // Focus point updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.flyTo([focusPoint.lat, focusPoint.lon], focusPoint.zoom ?? 11, { duration: 0.7 });
  }, [focusPoint]);

  // Render destination, accommodation, and transport hub markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }

    const group: L.LayerGroup = clusterMarkers
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 42,
        })
      : L.layerGroup();

    destinations.forEach((dest) => {
      const isSelected = dest.id === selectedDestinationId;
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="rte-marker-pin ${isSelected ? 'rte-marker-active' : ''}" style="width: 30px; height: 30px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([dest.latitude, dest.longitude], { icon });
      const popupHtml = `
        <div style="font-family: Inter, sans-serif; width: 230px;">
          ${
            dest.primaryImage
              ? `<img src="${dest.primaryImage}" alt="${dest.name}" style="width:100%;height:112px;object-fit:cover;display:block;" />`
              : ''
          }
          <div style="padding: 10px 12px;">
            <div style="font-size:11px;color:#69766E;margin-bottom:3px;">${dest.province} · ${dest.district}</div>
            <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:14px;color:#123D2B;margin-bottom:4px;">${dest.name}</div>
            <div style="font-size:12px;color:#202923;line-height:1.4;margin-bottom:8px;">${dest.shortSummary.slice(0, 88)}...</div>
            <a href="/destinations/${dest.slug}" style="display:inline-block;font-size:12px;font-weight:600;color:#16865B;text-decoration:none;">Explore destination →</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        if (onSelectDestination) {
          onSelectDestination(dest);
        }
      });
      group.addLayer(marker);
    });

    if (showAccommodations) {
      accommodations.forEach((accom) => {
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="rte-marker-accom" style="width: 24px; height: 24px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([accom.latitude, accom.longitude], { icon });
        marker.bindPopup(`
          <div style="padding:10px 12px;font-family:Inter,sans-serif;width:210px;">
            <div style="font-size:11px;color:#69766E;text-transform:capitalize;">${accom.accommodationType} · ${accom.district}</div>
            <div style="font-weight:600;font-size:13px;color:#123D2B;margin:3px 0;">${accom.name}</div>
            <div style="font-size:12px;color:#202923;">${accom.verifiedPriceRange || 'Contact property for rates'}</div>
          </div>
        `);
        group.addLayer(marker);
      });
    }

    if (showTransportHubs) {
      RWANDA_TRANSPORT_HUBS.forEach((hub) => {
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="rte-marker-hub" style="width: 24px; height: 24px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([hub.latitude, hub.longitude], { icon });
        marker.bindPopup(`
          <div style="padding:10px 12px;font-family:Inter,sans-serif;width:210px;">
            <div style="font-size:11px;color:#69766E;">${hub.type}</div>
            <div style="font-weight:600;font-size:13px;color:#123D2B;margin:3px 0;">${hub.name}</div>
            <div style="font-size:12px;color:#202923;">${hub.note}</div>
          </div>
        `);
        group.addLayer(marker);
      });
    }

    group.addTo(map);
    markersLayerRef.current = group;
  }, [destinations, accommodations, showAccommodations, showTransportHubs, selectedDestinationId, clusterMarkers, onSelectDestination]);

  // Route Polyline Visualization
  const routeKey = useMemo(() => JSON.stringify(routeCoordinates.slice(0, 6)), [routeCoordinates]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (routeCoordinates.length >= 2) {
      const polyline = L.polyline(routeCoordinates, {
        color: '#16865B',
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
      routeLayerRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [44, 44] });
    }
  }, [routeKey, routeCoordinates]);

  const handleResetRwanda = () => {
    mapRef.current?.flyTo(RWANDA_CENTER, 8, { duration: 0.6 });
  };

  return (
    <div className={`relative w-full ${heightClassName} rounded-xl overflow-hidden border border-[#E3E9E4] bg-[#E3E9E4]/40`}>
      <div ref={containerRef} className="w-full h-full z-10" />

      {/* Map Layer & Reset Controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={handleResetRwanda}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/95 text-[#202923] border border-[#E3E9E4] rounded-lg shadow-sm hover:border-[#16865B] cursor-pointer"
          title="Center on Rwanda"
        >
          <LocateFixed className="w-3.5 h-3.5 text-[#16865B]" />
          <span className="hidden sm:inline">Rwanda View</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setLayerMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/95 text-[#202923] border border-[#E3E9E4] rounded-lg shadow-sm hover:border-[#16865B] cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-[#123D2B]" />
            <span>{BASE_LAYERS[baseLayer].label}</span>
          </button>

          {layerMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white border border-[#E3E9E4] rounded-lg shadow-lg py-1 z-30">
              {(Object.keys(BASE_LAYERS) as BaseLayerKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setBaseLayer(key);
                    setLayerMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs cursor-pointer ${
                    baseLayer === key
                      ? 'bg-[#123D2B] text-white font-medium'
                      : 'text-[#202923] hover:bg-[#FAF9F5]'
                  }`}
                >
                  {BASE_LAYERS[key].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
