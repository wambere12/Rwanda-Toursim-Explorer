// Cached external API service layer for Open-Meteo, OSRM, Nominatim, REST Countries, and Wikimedia Commons

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number): T {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'RwandaTourismExplorer/1.0 (https://rwandatourismexplorer.rw)',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

const WMO_WEATHER_LABELS: Record<number, { label: string; condition: string }> = {
  0: { label: 'Clear Sky', condition: 'clear' },
  1: { label: 'Mainly Clear', condition: 'partly-cloudy' },
  2: { label: 'Partly Cloudy', condition: 'partly-cloudy' },
  3: { label: 'Overcast', condition: 'cloudy' },
  45: { label: 'Morning Mist', condition: 'fog' },
  48: { label: 'Highland Fog', condition: 'fog' },
  51: { label: 'Light Drizzle', condition: 'rain' },
  53: { label: 'Moderate Drizzle', condition: 'rain' },
  55: { label: 'Dense Drizzle', condition: 'rain' },
  61: { label: 'Light Rain', condition: 'rain' },
  63: { label: 'Moderate Rain', condition: 'rain' },
  65: { label: 'Heavy Rain', condition: 'rain' },
  80: { label: 'Rain Showers', condition: 'rain' },
  81: { label: 'Moderate Showers', condition: 'rain' },
  82: { label: 'Heavy Showers', condition: 'rain' },
  95: { label: 'Thunderstorm', condition: 'storm' },
};

export function describeWeatherCode(code: number): { label: string; condition: string } {
  return WMO_WEATHER_LABELS[code] || { label: 'Partly Cloudy', condition: 'partly-cloudy' };
}

export async function fetchOpenMeteoWeather(lat: number, lon: number) {
  const key = `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = getCached<Record<string, unknown>>(key);
  if (cached) return cached;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=Africa%2FKigali&forecast_days=5`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  }
  const raw = (await response.json()) as {
    current?: {
      temperature_2m: number;
      relative_humidity_2m: number;
      precipitation_probability?: number;
      weather_code: number;
      wind_speed_10m: number;
      time: string;
    };
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
    };
  };

  if (!raw.current || !raw.daily) {
    throw new Error('Unexpected Open-Meteo response format');
  }

  const currentMeta = describeWeatherCode(raw.current.weather_code);
  const result = {
    source: 'Open-Meteo',
    timezone: 'Africa/Kigali',
    current: {
      temperatureC: raw.current.temperature_2m,
      humidityPercent: raw.current.relative_humidity_2m,
      rainProbability: raw.current.precipitation_probability ?? raw.daily.precipitation_probability_max[0] ?? 0,
      windSpeedKmh: raw.current.wind_speed_10m,
      weatherCode: raw.current.weather_code,
      label: currentMeta.label,
      condition: currentMeta.condition,
      observedAt: raw.current.time,
    },
    forecast: raw.daily.time.map((date, idx) => {
      const meta = describeWeatherCode(raw.daily!.weather_code[idx]);
      return {
        date,
        tempMaxC: raw.daily!.temperature_2m_max[idx],
        tempMinC: raw.daily!.temperature_2m_min[idx],
        rainProbability: raw.daily!.precipitation_probability_max[idx] ?? 0,
        weatherCode: raw.daily!.weather_code[idx],
        label: meta.label,
        condition: meta.condition,
      };
    }),
  };

  return setCached(key, result, 15 * 60 * 1000);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchOsrmRoute(
  waypoints: Array<{ lat: number; lon: number }>,
  profile: 'driving' | 'walking' | 'cycling' = 'driving'
) {
  if (waypoints.length < 2) {
    throw new Error('At least two waypoints are required for routing.');
  }

  const osrmProfile = profile === 'walking' ? 'foot' : profile === 'cycling' ? 'bike' : 'driving';
  const coordString = waypoints.map((w) => `${w.lon.toFixed(5)},${w.lat.toFixed(5)}`).join(';');
  const key = `osrm:${osrmProfile}:${coordString}`;
  const cached = getCached<Record<string, unknown>>(key);
  if (cached) return cached;

  try {
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordString}?overview=full&geometries=geojson&steps=false`;
    const response = await fetchWithTimeout(url, {}, 7000);
    if (!response.ok) {
      throw new Error(`OSRM returned HTTP ${response.status}`);
    }
    const raw = (await response.json()) as {
      code: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { type: string; coordinates: Array<[number, number]> };
        legs: Array<{ distance: number; duration: number; summary?: string }>;
      }>;
    };

    if (raw.code !== 'Ok' || !raw.routes || raw.routes.length === 0) {
      throw new Error('No road route returned by OSRM');
    }

    const best = raw.routes[0];
    // Convert GeoJSON [lon, lat] -> Leaflet [lat, lon]
    const coordinates = best.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
    const distanceKm = Number((best.distance / 1000).toFixed(1));
    // OSRM bike/foot speeds can differ from Rwanda mountainous terrain; driving uses OSRM duration directly
    const durationMin = Math.max(1, Math.round(best.duration / 60));

    const result = {
      source: 'OSRM',
      isFallbackEstimate: false,
      profile,
      distanceKm,
      durationMin,
      coordinates,
      legs: best.legs.map((leg) => ({
        distanceKm: Number((leg.distance / 1000).toFixed(1)),
        durationMin: Math.max(1, Math.round(leg.duration / 60)),
        summary: leg.summary || '',
      })),
    };
    return setCached(key, result, 30 * 60 * 1000);
  } catch (error) {
    // Graceful Haversine estimate fallback if public OSRM service is temporarily unreachable
    let totalKm = 0;
    const legs: Array<{ distanceKm: number; durationMin: number; summary: string }> = [];
    const speedKmh = profile === 'walking' ? 4.5 : profile === 'cycling' ? 16 : 48;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const straight = haversineKm(
        waypoints[i].lat,
        waypoints[i].lon,
        waypoints[i + 1].lat,
        waypoints[i + 1].lon
      );
      const roadAdjusted = Number((straight * 1.28).toFixed(1));
      totalKm += roadAdjusted;
      legs.push({
        distanceKm: roadAdjusted,
        durationMin: Math.max(1, Math.round((roadAdjusted / speedKmh) * 60)),
        summary: 'Estimated terrain corridor',
      });
    }

    return {
      source: 'Terrain Distance Estimate (OSRM fallback)',
      isFallbackEstimate: true,
      fallbackReason: error instanceof Error ? error.message : 'OSRM unavailable',
      profile,
      distanceKm: Number(totalKm.toFixed(1)),
      durationMin: Math.max(1, Math.round((totalKm / speedKmh) * 60)),
      coordinates: waypoints.map((w) => [w.lat, w.lon] as [number, number]),
      legs,
    };
  }
}

export async function fetchNominatimGeocode(query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];
  const key = `nominatim:${cleanQuery.toLowerCase()}`;
  const cached = getCached<Array<Record<string, unknown>>>(key);
  if (cached) return cached;

  const url =
    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=rw&limit=6&addressdetails=1&q=` +
    encodeURIComponent(cleanQuery);

  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim returned HTTP ${response.status}`);
  }

  const raw = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type?: string;
    class?: string;
    address?: {
      county?: string;
      state?: string;
      city?: string;
      town?: string;
      village?: string;
    };
  }>;

  const results = raw.map((item) => ({
    placeId: item.place_id,
    displayName: item.display_name,
    shortName: item.display_name.split(',')[0],
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    type: item.type || item.class || 'place',
    district: item.address?.county || item.address?.city || item.address?.town || null,
    province: item.address?.state || null,
  }));

  return setCached(key, results, 60 * 60 * 1000);
}

export async function fetchRwandaCountryInfo() {
  const key = 'restcountries:RWA';
  const cached = getCached<Record<string, unknown>>(key);
  if (cached) return cached;

  const url =
    'https://restcountries.com/v3.1/alpha/RWA?fields=name,capital,region,subregion,population,area,currencies,languages,timezones,idd,car,flags';
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`REST Countries returned HTTP ${response.status}`);
  }
  const raw = (await response.json()) as {
    name?: { common?: string; official?: string };
    capital?: string[];
    region?: string;
    subregion?: string;
    population?: number;
    area?: number;
    currencies?: Record<string, { name: string; symbol: string }>;
    languages?: Record<string, string>;
    timezones?: string[];
    idd?: { root?: string; suffixes?: string[] };
    car?: { side?: string };
    flags?: { svg?: string; png?: string; alt?: string };
  };

  const result = {
    source: 'REST Countries',
    commonName: raw.name?.common || 'Rwanda',
    officialName: raw.name?.official || 'Republic of Rwanda',
    capital: raw.capital?.[0] || 'Kigali',
    region: raw.region || 'Africa',
    subregion: raw.subregion || 'Eastern Africa',
    population: raw.population || 14000000,
    areaKm2: raw.area || 26338,
    currencyCode: 'RWF',
    currencyName: raw.currencies?.RWF?.name || 'Rwandan franc',
    currencySymbol: raw.currencies?.RWF?.symbol || 'FRw',
    languages: raw.languages ? Object.values(raw.languages) : ['Kinyarwanda', 'English', 'French', 'Swahili'],
    timezone: raw.timezones?.[0] || 'UTC+02:00',
    callingCode: raw.idd?.root ? `${raw.idd.root}${raw.idd.suffixes?.[0] || ''}` : '+250',
    drivingSide: raw.car?.side || 'right',
    flagUrl: raw.flags?.svg || raw.flags?.png || null,
  };

  return setCached(key, result, 24 * 60 * 60 * 1000);
}

export async function fetchWikimediaCommonsPhotos(query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];
  const key = `wikimedia:${cleanQuery.toLowerCase()}`;
  const cached = getCached<Array<Record<string, unknown>>>(key);
  if (cached) return cached;

  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
    `&gsrsearch=${encodeURIComponent(cleanQuery + ' Rwanda')}&gsrlimit=6&prop=imageinfo` +
    `&iiprop=url|extmetadata&iiurlwidth=960&format=json&origin=*`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Wikimedia Commons returned HTTP ${response.status}`);
  }

  const raw = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          pageid: number;
          title: string;
          imageinfo?: Array<{
            thumburl?: string;
            url?: string;
            extmetadata?: {
              Artist?: { value?: string };
              LicenseShortName?: { value?: string };
              ImageDescription?: { value?: string };
            };
          }>;
        }
      >;
    };
  };

  const pages = raw.query?.pages ? Object.values(raw.query.pages) : [];
  const stripHtml = (str?: string) => (str ? str.replace(/<[^>]+>/g, '').trim() : '');

  const results = pages
    .filter((p) => {
      const thumb = p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url || '';
      return /\.(jpe?g|png|webp)(\?|$)/i.test(thumb);
    })
    .slice(0, 4)
    .map((p) => {
      const info = p.imageinfo![0];
      return {
        pageId: p.pageid,
        title: p.title.replace(/^File:/, ''),
        imageUrl: info.thumburl || info.url || '',
        sourceUrl: info.url || '',
        artist: stripHtml(info.extmetadata?.Artist?.value) || 'Wikimedia Commons Contributor',
        license: stripHtml(info.extmetadata?.LicenseShortName?.value) || 'CC BY-SA',
        description: stripHtml(info.extmetadata?.ImageDescription?.value) || cleanQuery,
      };
    });

  return setCached(key, results, 6 * 60 * 60 * 1000);
}
