export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  iconName: string;
  sortOrder: number;
}

export interface DestinationImage {
  id: number;
  destinationId: number;
  imageUrl: string;
  caption: string | null;
  credit: string | null;
  isPrimary: boolean;
}

export interface Destination {
  id: number;
  slug: string;
  categoryId: number;
  category?: Category | null;
  name: string;
  shortSummary: string;
  description: string;
  district: string;
  province: string;
  latitude: number;
  longitude: number;
  entranceInfo: string;
  activities: string[];
  contactInfo: string | null;
  visitorGuidelines: string;
  bestSeason: string | null;
  elevationMeters: number | null;
  wikimediaTitle: string | null;
  featured: boolean;
  popularityScore: number;
  primaryImage: string | null;
  images?: DestinationImage[];
  avgRating: number;
  reviewCount: number;
  isFavorited?: boolean;
  isSaved?: boolean;
}

export interface NearbyDestination {
  id: number;
  slug: string;
  name: string;
  district: string;
  province: string;
  latitude: number;
  longitude: number;
  primaryImage: string | null;
  distanceKm: number;
}

export interface Accommodation {
  id: number;
  slug: string;
  destinationId: number | null;
  name: string;
  accommodationType: 'hotel' | 'resort' | 'guesthouse' | 'lodge' | 'campsite' | 'apartment';
  description: string;
  district: string;
  province: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string | null;
  contactEmail: string | null;
  externalBookingUrl: string | null;
  verifiedPriceRange: string | null;
  facilities: string[];
  rating: number;
  primaryImage: string | null;
  nearDestination?: { id: number; name: string; slug: string } | null;
  distanceKm?: number;
}

export interface ProviderService {
  id: number;
  providerId: number;
  title: string;
  category: string;
  description: string;
  priceEstimate: string | null;
  durationText: string | null;
}

export interface TravelPackage {
  id: number;
  providerId: number;
  destinationId: number | null;
  title: string;
  summary: string;
  durationDays: number;
  priceUsd: number | null;
  inclusions: string[];
  maxGroupSize: number;
  isActive: boolean;
}

export interface TourismProvider {
  id: number;
  userId: number | null;
  businessName: string;
  providerType: 'tour_operator' | 'tour_guide' | 'transport_partner';
  licenseNumber: string | null;
  description: string;
  destinationCoverage: string[];
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string | null;
  district: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  services: ProviderService[];
  packages: TravelPackage[];
}

export interface ItineraryStop {
  id?: number;
  destinationId: number;
  sortOrder?: number;
  visitDurationMin: number;
  notes?: string | null;
  destination?: Destination | null;
}

export interface ItineraryDay {
  id?: number;
  dayNumber: number;
  dateLabel?: string | null;
  notes?: string | null;
  stops: ItineraryStop[];
}

export interface Itinerary {
  id: number;
  userId: number | null;
  shareCode: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  travelMode: 'driving' | 'walking' | 'cycling';
  totalDistanceKm: number;
  estimatedDurationMin: number;
  isPublic: boolean;
  days: ItineraryDay[];
}

export interface Review {
  id: number;
  rating: number;
  title: string;
  comment: string;
  visitDate: string | null;
  photoUrls: string[];
  createdAt: string;
  authorName: string;
  authorNationality: string | null;
  authorAvatar: string | null;
}

export interface WeatherForecast {
  source: string;
  timezone: string;
  current: {
    temperatureC: number;
    humidityPercent: number;
    rainProbability: number;
    windSpeedKmh: number;
    weatherCode: number;
    label: string;
    condition: string;
    observedAt: string;
  };
  forecast: Array<{
    date: string;
    tempMaxC: number;
    tempMinC: number;
    rainProbability: number;
    weatherCode: number;
    label: string;
    condition: string;
  }>;
}

export interface RouteResult {
  source: string;
  isFallbackEstimate: boolean;
  profile: 'driving' | 'walking' | 'cycling';
  distanceKm: number;
  durationMin: number;
  coordinates: Array<[number, number]>;
  legs: Array<{ distanceKm: number; durationMin: number; summary: string }>;
}

export interface CountryInfo {
  commonName: string;
  officialName: string;
  capital: string;
  region: string;
  subregion: string;
  population: number;
  areaKm2: number;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  languages: string[];
  timezone: string;
  callingCode: string;
  drivingSide: string;
  flagUrl: string | null;
}
