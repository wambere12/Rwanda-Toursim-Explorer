import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. User Profiles (linked to Firebase Auth UID)
export const profiles = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull().default('Traveler'),
    avatarUrl: text('avatar_url'),
    nationality: text('nationality'),
    travelStyle: text('travel_style').default('Nature & Wildlife'),
    preferredCurrency: text('preferred_currency').default('USD'),
    travelHistory: jsonb('travel_history').$type<string[]>().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('profiles_email_idx').on(table.email)]
);

// 2. User Roles (RBAC: tourist, provider, admin)
export const userRoles = pgTable(
  'user_roles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull().default('tourist'),
    assignedBy: text('assigned_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_roles_user_role_uidx').on(table.userId, table.role)]
);

// 3. Destination Categories
export const destinationCategories = pgTable('destination_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  iconName: text('icon_name').notNull().default('Compass'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Destinations
export const destinations = pgTable(
  'destinations',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    categoryId: integer('category_id')
      .references(() => destinationCategories.id, { onDelete: 'restrict' })
      .notNull(),
    name: text('name').notNull(),
    shortSummary: text('short_summary').notNull(),
    description: text('description').notNull(),
    district: text('district').notNull(),
    province: text('province').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    entranceInfo: text('entrance_info').notNull(),
    activities: jsonb('activities').$type<string[]>().notNull().default([]),
    contactInfo: text('contact_info'),
    visitorGuidelines: text('visitor_guidelines').notNull(),
    bestSeason: text('best_season').default('June – September & December – February'),
    elevationMeters: integer('elevation_meters'),
    wikimediaTitle: text('wikimedia_title'),
    featured: boolean('featured').notNull().default(false),
    status: text('status').notNull().default('published'),
    popularityScore: integer('popularity_score').notNull().default(100),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('destinations_category_idx').on(table.categoryId),
    index('destinations_province_idx').on(table.province),
    index('destinations_featured_idx').on(table.featured),
  ]
);

// 5. Destination Images
export const destinationImages = pgTable(
  'destination_images',
  {
    id: serial('id').primaryKey(),
    destinationId: integer('destination_id')
      .references(() => destinations.id, { onDelete: 'cascade' })
      .notNull(),
    imageUrl: text('image_url').notNull(),
    caption: text('caption'),
    credit: text('credit'),
    isPrimary: boolean('is_primary').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('destination_images_dest_idx').on(table.destinationId)]
);

// 6. Tourism Providers (Tour Operators & Guides)
export const tourismProviders = pgTable(
  'tourism_providers',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    businessName: text('business_name').notNull(),
    providerType: text('provider_type').notNull().default('tour_operator'),
    licenseNumber: text('license_number'),
    description: text('description').notNull(),
    destinationCoverage: jsonb('destination_coverage').$type<string[]>().notNull().default([]),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone').notNull(),
    websiteUrl: text('website_url'),
    district: text('district').notNull(),
    verificationStatus: text('verification_status').notNull().default('pending'),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('providers_status_idx').on(table.verificationStatus)]
);

// 7. Provider Services
export const providerServices = pgTable(
  'provider_services',
  {
    id: serial('id').primaryKey(),
    providerId: integer('provider_id')
      .references(() => tourismProviders.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    priceEstimate: text('price_estimate'),
    durationText: text('duration_text'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('provider_services_provider_idx').on(table.providerId)]
);

// 8. Travel Packages
export const travelPackages = pgTable(
  'travel_packages',
  {
    id: serial('id').primaryKey(),
    providerId: integer('provider_id')
      .references(() => tourismProviders.id, { onDelete: 'cascade' })
      .notNull(),
    destinationId: integer('destination_id').references(() => destinations.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    durationDays: integer('duration_days').notNull().default(1),
    priceUsd: integer('price_usd'),
    inclusions: jsonb('inclusions').$type<string[]>().notNull().default([]),
    maxGroupSize: integer('max_group_size').notNull().default(8),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('travel_packages_provider_idx').on(table.providerId)]
);

// 9. Accommodations
export const accommodations = pgTable(
  'accommodations',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    destinationId: integer('destination_id').references(() => destinations.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    accommodationType: text('accommodation_type').notNull(),
    description: text('description').notNull(),
    district: text('district').notNull(),
    province: text('province').notNull(),
    address: text('address').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    externalBookingUrl: text('external_booking_url'),
    verifiedPriceRange: text('verified_price_range'),
    facilities: jsonb('facilities').$type<string[]>().notNull().default([]),
    rating: doublePrecision('rating').notNull().default(4.6),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('accommodations_type_idx').on(table.accommodationType),
    index('accommodations_dest_idx').on(table.destinationId),
  ]
);

// 10. Accommodation Images
export const accommodationImages = pgTable(
  'accommodation_images',
  {
    id: serial('id').primaryKey(),
    accommodationId: integer('accommodation_id')
      .references(() => accommodations.id, { onDelete: 'cascade' })
      .notNull(),
    imageUrl: text('image_url').notNull(),
    caption: text('caption'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('accommodation_images_accom_idx').on(table.accommodationId)]
);

// 11. Itineraries
export const itineraries = pgTable(
  'itineraries',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    shareCode: text('share_code').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    travelMode: text('travel_mode').notNull().default('driving'),
    totalDistanceKm: doublePrecision('total_distance_km').notNull().default(0),
    estimatedDurationMin: integer('estimated_duration_min').notNull().default(0),
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('itineraries_user_idx').on(table.userId)]
);

// 12. Itinerary Days
export const itineraryDays = pgTable(
  'itinerary_days',
  {
    id: serial('id').primaryKey(),
    itineraryId: integer('itinerary_id')
      .references(() => itineraries.id, { onDelete: 'cascade' })
      .notNull(),
    dayNumber: integer('day_number').notNull(),
    dateLabel: text('date_label'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('itinerary_days_itin_idx').on(table.itineraryId)]
);

// 13. Itinerary Destinations
export const itineraryDestinations = pgTable(
  'itinerary_destinations',
  {
    id: serial('id').primaryKey(),
    itineraryDayId: integer('itinerary_day_id')
      .references(() => itineraryDays.id, { onDelete: 'cascade' })
      .notNull(),
    destinationId: integer('destination_id')
      .references(() => destinations.id, { onDelete: 'cascade' })
      .notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    visitDurationMin: integer('visit_duration_min').notNull().default(180),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('itinerary_dest_day_idx').on(table.itineraryDayId)]
);

// 14. Reviews (one review per user per destination)
export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    destinationId: integer('destination_id')
      .references(() => destinations.id, { onDelete: 'cascade' })
      .notNull(),
    rating: integer('rating').notNull(),
    title: text('title').notNull(),
    comment: text('comment').notNull(),
    visitDate: text('visit_date'),
    photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
    moderationStatus: text('moderation_status').notNull().default('approved'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reviews_user_dest_uidx').on(table.userId, table.destinationId),
    index('reviews_dest_idx').on(table.destinationId),
  ]
);

// 15. Favorites & Saved Destinations
export const favorites = pgTable(
  'favorites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    destinationId: integer('destination_id')
      .references(() => destinations.id, { onDelete: 'cascade' })
      .notNull(),
    collectionType: text('collection_type').notNull().default('favorite'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('favorites_user_dest_type_uidx').on(
      table.userId,
      table.destinationId,
      table.collectionType
    ),
  ]
);

// 16. Inquiries (Tourist -> Provider)
export const inquiries = pgTable(
  'inquiries',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    providerId: integer('provider_id')
      .references(() => tourismProviders.id, { onDelete: 'cascade' })
      .notNull(),
    packageId: integer('package_id').references(() => travelPackages.id, {
      onDelete: 'set null',
    }),
    senderName: text('sender_name').notNull(),
    senderEmail: text('sender_email').notNull(),
    travelDates: text('travel_dates').notNull(),
    groupSize: integer('group_size').notNull().default(2),
    message: text('message').notNull(),
    status: text('status').notNull().default('new'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('inquiries_provider_idx').on(table.providerId)]
);

// 17. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    category: text('category').notNull().default('system'),
    isRead: boolean('is_read').notNull().default(false),
    linkUrl: text('link_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

// 18. Reports (Moderation Queue)
export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    reporterId: integer('reporter_id').references(() => profiles.id, { onDelete: 'set null' }),
    targetType: text('target_type').notNull(),
    targetId: integer('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').notNull().default('open'),
    resolvedBy: text('resolved_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('reports_status_idx').on(table.status)]
);

// 19. Platform Settings (Admin configurable)
export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Drizzle Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  roles: many(userRoles),
  itineraries: many(itineraries),
  reviews: many(reviews),
  favorites: many(favorites),
  notifications: many(notifications),
  providers: many(tourismProviders),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  profile: one(profiles, {
    fields: [userRoles.userId],
    references: [profiles.id],
  }),
}));

export const destinationCategoriesRelations = relations(destinationCategories, ({ many }) => ({
  destinations: many(destinations),
}));

export const destinationsRelations = relations(destinations, ({ one, many }) => ({
  category: one(destinationCategories, {
    fields: [destinations.categoryId],
    references: [destinationCategories.id],
  }),
  images: many(destinationImages),
  reviews: many(reviews),
  accommodations: many(accommodations),
  packages: many(travelPackages),
}));

export const destinationImagesRelations = relations(destinationImages, ({ one }) => ({
  destination: one(destinations, {
    fields: [destinationImages.destinationId],
    references: [destinations.id],
  }),
}));

export const tourismProvidersRelations = relations(tourismProviders, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [tourismProviders.userId],
    references: [profiles.id],
  }),
  services: many(providerServices),
  packages: many(travelPackages),
  inquiries: many(inquiries),
}));

export const providerServicesRelations = relations(providerServices, ({ one }) => ({
  provider: one(tourismProviders, {
    fields: [providerServices.providerId],
    references: [tourismProviders.id],
  }),
}));

export const travelPackagesRelations = relations(travelPackages, ({ one }) => ({
  provider: one(tourismProviders, {
    fields: [travelPackages.providerId],
    references: [tourismProviders.id],
  }),
  destination: one(destinations, {
    fields: [travelPackages.destinationId],
    references: [destinations.id],
  }),
}));

export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
  destination: one(destinations, {
    fields: [accommodations.destinationId],
    references: [destinations.id],
  }),
  images: many(accommodationImages),
}));

export const accommodationImagesRelations = relations(accommodationImages, ({ one }) => ({
  accommodation: one(accommodations, {
    fields: [accommodationImages.accommodationId],
    references: [accommodations.id],
  }),
}));

export const itinerariesRelations = relations(itineraries, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [itineraries.userId],
    references: [profiles.id],
  }),
  days: many(itineraryDays),
}));

export const itineraryDaysRelations = relations(itineraryDays, ({ one, many }) => ({
  itinerary: one(itineraries, {
    fields: [itineraryDays.itineraryId],
    references: [itineraries.id],
  }),
  stops: many(itineraryDestinations),
}));

export const itineraryDestinationsRelations = relations(itineraryDestinations, ({ one }) => ({
  day: one(itineraryDays, {
    fields: [itineraryDestinations.itineraryDayId],
    references: [itineraryDays.id],
  }),
  destination: one(destinations, {
    fields: [itineraryDestinations.destinationId],
    references: [destinations.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  author: one(profiles, {
    fields: [reviews.userId],
    references: [profiles.id],
  }),
  destination: one(destinations, {
    fields: [reviews.destinationId],
    references: [destinations.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  profile: one(profiles, {
    fields: [favorites.userId],
    references: [profiles.id],
  }),
  destination: one(destinations, {
    fields: [favorites.destinationId],
    references: [destinations.id],
  }),
}));

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  provider: one(tourismProviders, {
    fields: [inquiries.providerId],
    references: [tourismProviders.id],
  }),
  travelPackage: one(travelPackages, {
    fields: [inquiries.packageId],
    references: [travelPackages.id],
  }),
}));
