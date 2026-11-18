import { Router, Request, Response } from 'express';
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  accommodationImages,
  accommodations,
  destinationCategories,
  destinationImages,
  destinations,
  favorites,
  inquiries,
  itineraries,
  itineraryDays,
  itineraryDestinations,
  notifications,
  platformSettings,
  profiles,
  providerServices,
  reports,
  reviews,
  tourismProviders,
  travelPackages,
  userRoles,
} from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import { AuthRequest, optionalAuth, requireAuth, requireRole } from '../middleware/auth.ts';
import {
  fetchNominatimGeocode,
  fetchOpenMeteoWeather,
  fetchOsrmRoute,
  fetchRwandaCountryInfo,
  fetchWikimediaCommonsPhotos,
  haversineKm,
} from '../services/externalApis.ts';

export const apiRouter = Router();

// Simple sliding-window rate limiter for API mutations and public proxies
const rateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: () => void) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl}:${req.method === 'GET' ? 'read' : 'write'}`;
    const now = Date.now();
    const record = rateMap.get(key);
    if (!record || now > record.resetAt) {
      rateMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (record.count >= maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait briefly and try again.' });
    }
    record.count += 1;
    return next();
  };
}

apiRouter.use(rateLimit(180, 60_000));

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rwanda-tourism-explorer', timestamp: new Date().toISOString() });
});

// ========================
// AUTH & USER PROFILE
// ========================
apiRouter.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json({ profile: req.profile, roles: req.roles });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  nationality: z.string().max(80).nullable().optional(),
  travelStyle: z.string().max(100).nullable().optional(),
  preferredCurrency: z.enum(['USD', 'RWF', 'EUR', 'GBP']).optional(),
  travelHistory: z.array(z.string().max(120)).max(30).optional(),
});

apiRouter.patch('/auth/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid profile data', details: parsed.error.flatten() });
    }
    const [updated] = await db
      .update(profiles)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, req.profile!.id))
      .returning();

    res.json({ profile: updated, roles: req.roles });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ========================
// CATEGORIES & DESTINATIONS
// ========================
apiRouter.get('/categories', async (_req, res) => {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(destinationCategories)
      .orderBy(asc(destinationCategories.sortOrder), asc(destinationCategories.name));
    res.json({ categories: rows });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

apiRouter.get('/destinations', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const { q, category, province, featured, sort } = req.query as Record<string, string | undefined>;

    const allCategories = await db.select().from(destinationCategories);
    const catMap = new Map(allCategories.map((c) => [c.id, c]));
    const catSlugToId = new Map(allCategories.map((c) => [c.slug, c.id]));

    const conditions = [eq(destinations.status, 'published')];

    if (category && category !== 'all') {
      const catId = catSlugToId.get(category);
      if (catId) conditions.push(eq(destinations.categoryId, catId));
    }
    if (province && province !== 'all') {
      conditions.push(eq(destinations.province, province));
    }
    if (featured === 'true') {
      conditions.push(eq(destinations.featured, true));
    }
    if (q && q.trim()) {
      const pattern = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(destinations.name, pattern),
          ilike(destinations.district, pattern),
          ilike(destinations.province, pattern),
          ilike(destinations.shortSummary, pattern)
        )!
      );
    }

    const orderClause =
      sort === 'name'
        ? asc(destinations.name)
        : desc(destinations.popularityScore);

    const destRows = await db
      .select()
      .from(destinations)
      .where(and(...conditions))
      .orderBy(orderClause);

    const destIds = destRows.map((d) => d.id);
    const imageRows =
      destIds.length > 0
        ? await db
            .select()
            .from(destinationImages)
            .where(inArray(destinationImages.destinationId, destIds))
            .orderBy(asc(destinationImages.sortOrder))
        : [];

    const reviewAgg =
      destIds.length > 0
        ? await db
            .select({
              destinationId: reviews.destinationId,
              avgRating: sql<number>`ROUND(AVG(${reviews.rating})::numeric, 1)`,
              reviewCount: count(),
            })
            .from(reviews)
            .where(
              and(
                inArray(reviews.destinationId, destIds),
                eq(reviews.moderationStatus, 'approved')
              )
            )
            .groupBy(reviews.destinationId)
        : [];

    const aggMap = new Map(
      reviewAgg.map((r) => [
        r.destinationId,
        { avgRating: Number(r.avgRating || 0), reviewCount: Number(r.reviewCount || 0) },
      ])
    );

    const userFavs = req.profile
      ? await db
          .select()
          .from(favorites)
          .where(eq(favorites.userId, req.profile.id))
      : [];

    const enriched = destRows.map((d) => {
      const imgs = imageRows.filter((i) => i.destinationId === d.id);
      const primary = imgs.find((i) => i.isPrimary) || imgs[0] || null;
      const stats = aggMap.get(d.id) || { avgRating: 4.8, reviewCount: 0 };
      return {
        ...d,
        category: catMap.get(d.categoryId) || null,
        primaryImage: primary?.imageUrl || null,
        images: imgs,
        avgRating: stats.avgRating,
        reviewCount: stats.reviewCount,
        isFavorited: userFavs.some(
          (f) => f.destinationId === d.id && f.collectionType === 'favorite'
        ),
        isSaved: userFavs.some(
          (f) => f.destinationId === d.id && f.collectionType === 'saved'
        ),
      };
    });

    res.json({ destinations: enriched });
  } catch (err) {
    console.error('Error fetching destinations:', err);
    res.status(500).json({ error: 'Failed to load destinations' });
  }
});

apiRouter.get('/destinations/:slug', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const slug = String(req.params.slug);
    const [dest] = await db
      .select()
      .from(destinations)
      .where(eq(destinations.slug, slug))
      .limit(1);

    if (!dest) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    const [cat] = await db
      .select()
      .from(destinationCategories)
      .where(eq(destinationCategories.id, dest.categoryId))
      .limit(1);

    const imgs = await db
      .select()
      .from(destinationImages)
      .where(eq(destinationImages.destinationId, dest.id))
      .orderBy(asc(destinationImages.sortOrder));

    const reviewRows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        visitDate: reviews.visitDate,
        photoUrls: reviews.photoUrls,
        createdAt: reviews.createdAt,
        authorName: profiles.fullName,
        authorNationality: profiles.nationality,
        authorAvatar: profiles.avatarUrl,
      })
      .from(reviews)
      .innerJoin(profiles, eq(reviews.userId, profiles.id))
      .where(
        and(
          eq(reviews.destinationId, dest.id),
          eq(reviews.moderationStatus, 'approved')
        )
      )
      .orderBy(desc(reviews.createdAt));

    // Nearby destinations computed using Haversine distance
    const allPublished = await db
      .select()
      .from(destinations)
      .where(eq(destinations.status, 'published'));
    const allImgs = await db
      .select()
      .from(destinationImages)
      .where(eq(destinationImages.isPrimary, true));
    const imgByDest = new Map(allImgs.map((i) => [i.destinationId, i.imageUrl]));

    const nearbyDestinations = allPublished
      .filter((other) => other.id !== dest.id)
      .map((other) => ({
        id: other.id,
        slug: other.slug,
        name: other.name,
        district: other.district,
        province: other.province,
        latitude: other.latitude,
        longitude: other.longitude,
        primaryImage: imgByDest.get(other.id) || null,
        distanceKm: Number(
          haversineKm(dest.latitude, dest.longitude, other.latitude, other.longitude).toFixed(1)
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);

    // Nearby accommodations
    const allAccoms = await db.select().from(accommodations);
    const accomImgs = await db
      .select()
      .from(accommodationImages)
      .where(eq(accommodationImages.isPrimary, true));
    const accomImgMap = new Map(accomImgs.map((i) => [i.accommodationId, i.imageUrl]));

    const nearbyAccommodations = allAccoms
      .map((a) => ({
        ...a,
        primaryImage: accomImgMap.get(a.id) || null,
        distanceKm: Number(
          haversineKm(dest.latitude, dest.longitude, a.latitude, a.longitude).toFixed(1)
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);

    const userFavs = req.profile
      ? await db
          .select()
          .from(favorites)
          .where(
            and(eq(favorites.userId, req.profile.id), eq(favorites.destinationId, dest.id))
          )
      : [];

    const avgRating =
      reviewRows.length > 0
        ? Number(
            (
              reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length
            ).toFixed(1)
          )
        : 4.8;

    res.json({
      destination: {
        ...dest,
        category: cat || null,
        images: imgs,
        primaryImage: imgs.find((i) => i.isPrimary)?.imageUrl || imgs[0]?.imageUrl || null,
        avgRating,
        reviewCount: reviewRows.length,
        isFavorited: userFavs.some((f) => f.collectionType === 'favorite'),
        isSaved: userFavs.some((f) => f.collectionType === 'saved'),
      },
      reviews: reviewRows,
      nearbyDestinations,
      nearbyAccommodations,
    });
  } catch (err) {
    console.error('Error fetching destination detail:', err);
    res.status(500).json({ error: 'Failed to load destination details' });
  }
});

// ========================
// ACCOMMODATIONS
// ========================
apiRouter.get('/accommodations', async (req, res) => {
  try {
    await ensureSeeded();
    const { type, province, q, destinationId } = req.query as Record<string, string | undefined>;
    const conditions = [];
    if (type && type !== 'all') conditions.push(eq(accommodations.accommodationType, type));
    if (province && province !== 'all') conditions.push(eq(accommodations.province, province));
    if (destinationId) conditions.push(eq(accommodations.destinationId, Number(destinationId)));
    if (q && q.trim()) {
      const pattern = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(accommodations.name, pattern),
          ilike(accommodations.district, pattern),
          ilike(accommodations.description, pattern)
        )!
      );
    }

    const rows =
      conditions.length > 0
        ? await db.select().from(accommodations).where(and(...conditions)).orderBy(desc(accommodations.rating))
        : await db.select().from(accommodations).orderBy(desc(accommodations.rating));

    const imgs = await db.select().from(accommodationImages);
    const destRows = await db.select({ id: destinations.id, name: destinations.name, slug: destinations.slug }).from(destinations);
    const destMap = new Map(destRows.map((d) => [d.id, d]));

    res.json({
      accommodations: rows.map((a) => ({
        ...a,
        primaryImage: imgs.find((i) => i.accommodationId === a.id)?.imageUrl || null,
        nearDestination: a.destinationId ? destMap.get(a.destinationId) || null : null,
      })),
    });
  } catch (err) {
    console.error('Error fetching accommodations:', err);
    res.status(500).json({ error: 'Failed to load accommodations' });
  }
});

// ========================
// TOURISM PROVIDERS & PACKAGES
// ========================
apiRouter.get('/providers', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const verifiedRows = await db
      .select()
      .from(tourismProviders)
      .where(eq(tourismProviders.verificationStatus, 'verified'))
      .orderBy(asc(tourismProviders.businessName));

    let myProvider = null;
    if (req.profile) {
      const [mine] = await db
        .select()
        .from(tourismProviders)
        .where(eq(tourismProviders.userId, req.profile.id))
        .limit(1);
      myProvider = mine || null;
    }

    const providerIds = [
      ...new Set([
        ...verifiedRows.map((p) => p.id),
        ...(myProvider ? [myProvider.id] : []),
      ]),
    ];

    const serviceRows =
      providerIds.length > 0
        ? await db
            .select()
            .from(providerServices)
            .where(inArray(providerServices.providerId, providerIds))
        : [];

    const packageRows =
      providerIds.length > 0
        ? await db
            .select()
            .from(travelPackages)
            .where(inArray(travelPackages.providerId, providerIds))
        : [];

    const hydrate = (p: typeof verifiedRows[number]) => ({
      ...p,
      services: serviceRows.filter((s) => s.providerId === p.id),
      packages: packageRows.filter((pk) => pk.providerId === p.id),
    });

    res.json({
      providers: verifiedRows.map(hydrate),
      myProvider: myProvider ? hydrate(myProvider) : null,
    });
  } catch (err) {
    console.error('Error fetching providers:', err);
    res.status(500).json({ error: 'Failed to load tourism providers' });
  }
});

const registerProviderSchema = z.object({
  businessName: z.string().min(3).max(140),
  providerType: z.enum(['tour_operator', 'tour_guide', 'transport_partner']),
  licenseNumber: z.string().max(80).optional(),
  description: z.string().min(20).max(1200),
  destinationCoverage: z.array(z.string()).min(1).max(15),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(6).max(40),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  district: z.string().min(2).max(80),
});

apiRouter.post('/providers/register', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = registerProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid provider registration details', details: parsed.error.flatten() });
    }

    const [existing] = await db
      .select()
      .from(tourismProviders)
      .where(eq(tourismProviders.userId, req.profile!.id))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(tourismProviders)
        .set({
          ...parsed.data,
          websiteUrl: parsed.data.websiteUrl || null,
          updatedAt: new Date(),
        })
        .where(eq(tourismProviders.id, existing.id))
        .returning();
      return res.json({ provider: updated });
    }

    const [created] = await db
      .insert(tourismProviders)
      .values({
        userId: req.profile!.id,
        ...parsed.data,
        websiteUrl: parsed.data.websiteUrl || null,
        verificationStatus: 'pending',
      })
      .returning();

    await db
      .insert(userRoles)
      .values({ userId: req.profile!.id, role: 'provider', assignedBy: 'self-registration' })
      .onConflictDoNothing();

    await db.insert(notifications).values({
      userId: req.profile!.id,
      title: 'Provider Application Submitted',
      message: `${created.businessName} is queued for Rwanda Tourism Explorer administrative verification.`,
      category: 'provider',
      linkUrl: '/providers',
    });

    res.status(201).json({ provider: created });
  } catch (err) {
    console.error('Error registering provider:', err);
    res.status(500).json({ error: 'Failed to submit provider registration' });
  }
});

const createServiceSchema = z.object({
  title: z.string().min(3).max(120),
  category: z.string().min(2).max(80),
  description: z.string().min(10).max(800),
  priceEstimate: z.string().max(60).optional(),
  durationText: z.string().max(60).optional(),
});

apiRouter.post('/providers/services', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid service data' });

    const [provider] = await db
      .select()
      .from(tourismProviders)
      .where(eq(tourismProviders.userId, req.profile!.id))
      .limit(1);

    if (!provider) return res.status(404).json({ error: 'Provider profile not found' });

    const [service] = await db
      .insert(providerServices)
      .values({ providerId: provider.id, ...parsed.data })
      .returning();

    res.status(201).json({ service });
  } catch (err) {
    console.error('Error creating provider service:', err);
    res.status(500).json({ error: 'Failed to add provider service' });
  }
});

const createPackageSchema = z.object({
  title: z.string().min(3).max(140),
  summary: z.string().min(15).max(1000),
  destinationId: z.number().int().positive().nullable().optional(),
  durationDays: z.number().int().min(1).max(30),
  priceUsd: z.number().int().min(10).max(50000).optional(),
  inclusions: z.array(z.string()).max(12).default([]),
  maxGroupSize: z.number().int().min(1).max(40).default(8),
});

apiRouter.post('/providers/packages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = createPackageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid travel package data' });

    const [provider] = await db
      .select()
      .from(tourismProviders)
      .where(eq(tourismProviders.userId, req.profile!.id))
      .limit(1);

    if (!provider) return res.status(404).json({ error: 'Provider profile not found' });

    const [pkg] = await db
      .insert(travelPackages)
      .values({ providerId: provider.id, ...parsed.data })
      .returning();

    res.status(201).json({ package: pkg });
  } catch (err) {
    console.error('Error creating travel package:', err);
    res.status(500).json({ error: 'Failed to create travel package' });
  }
});

const inquirySchema = z.object({
  providerId: z.number().int().positive(),
  packageId: z.number().int().positive().nullable().optional(),
  senderName: z.string().min(2).max(100),
  senderEmail: z.string().email(),
  travelDates: z.string().min(3).max(120),
  groupSize: z.number().int().min(1).max(40),
  message: z.string().min(10).max(1500),
});

apiRouter.post('/inquiries', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = inquirySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please complete all required inquiry fields.' });
    }

    const [provider] = await db
      .select()
      .from(tourismProviders)
      .where(eq(tourismProviders.id, parsed.data.providerId))
      .limit(1);

    if (!provider) return res.status(404).json({ error: 'Tourism provider not found' });

    const [created] = await db
      .insert(inquiries)
      .values({
        userId: req.profile?.id ?? null,
        ...parsed.data,
      })
      .returning();

    if (provider.userId) {
      await db.insert(notifications).values({
        userId: provider.userId,
        title: `New Traveler Inquiry from ${parsed.data.senderName}`,
        message: `Travel dates: ${parsed.data.travelDates} · Group of ${parsed.data.groupSize}`,
        category: 'inquiry',
        linkUrl: '/providers',
      });
    }

    res.status(201).json({ inquiry: created });
  } catch (err) {
    console.error('Error submitting inquiry:', err);
    res.status(500).json({ error: 'Failed to send inquiry' });
  }
});

apiRouter.get('/providers/inquiries', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [provider] = await db
      .select()
      .from(tourismProviders)
      .where(eq(tourismProviders.userId, req.profile!.id))
      .limit(1);

    if (!provider) return res.json({ inquiries: [] });

    const rows = await db
      .select()
      .from(inquiries)
      .where(eq(inquiries.providerId, provider.id))
      .orderBy(desc(inquiries.createdAt));

    res.json({ inquiries: rows });
  } catch (err) {
    console.error('Error fetching inquiries:', err);
    res.status(500).json({ error: 'Failed to load inquiries' });
  }
});

// ========================
// ITINERARIES (TRAVEL PLANNER)
// ========================
async function hydrateItineraries(itinRows: Array<typeof itineraries.$inferSelect>) {
  if (itinRows.length === 0) return [];
  const itinIds = itinRows.map((i) => i.id);
  const days = await db
    .select()
    .from(itineraryDays)
    .where(inArray(itineraryDays.itineraryId, itinIds))
    .orderBy(asc(itineraryDays.dayNumber));

  const dayIds = days.map((d) => d.id);
  const stops =
    dayIds.length > 0
      ? await db
          .select()
          .from(itineraryDestinations)
          .where(inArray(itineraryDestinations.itineraryDayId, dayIds))
          .orderBy(asc(itineraryDestinations.sortOrder))
      : [];

  const destIds = [...new Set(stops.map((s) => s.destinationId))];
  const destRows =
    destIds.length > 0
      ? await db.select().from(destinations).where(inArray(destinations.id, destIds))
      : [];
  const destImgRows =
    destIds.length > 0
      ? await db
          .select()
          .from(destinationImages)
          .where(and(inArray(destinationImages.destinationId, destIds), eq(destinationImages.isPrimary, true)))
      : [];
  const imgMap = new Map(destImgRows.map((i) => [i.destinationId, i.imageUrl]));
  const destMap = new Map(
    destRows.map((d) => [d.id, { ...d, primaryImage: imgMap.get(d.id) || null }])
  );

  return itinRows.map((itin) => ({
    ...itin,
    days: days
      .filter((d) => d.itineraryId === itin.id)
      .map((d) => ({
        ...d,
        stops: stops
          .filter((s) => s.itineraryDayId === d.id)
          .map((s) => ({
            ...s,
            destination: destMap.get(s.destinationId) || null,
          })),
      })),
  }));
}

apiRouter.get('/itineraries', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const publicRows = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.isPublic, true))
      .orderBy(desc(itineraries.createdAt));

    const userRows = req.profile
      ? await db
          .select()
          .from(itineraries)
          .where(eq(itineraries.userId, req.profile.id))
          .orderBy(desc(itineraries.updatedAt))
      : [];

    res.json({
      recommended: await hydrateItineraries(publicRows),
      mine: await hydrateItineraries(userRows),
    });
  } catch (err) {
    console.error('Error fetching itineraries:', err);
    res.status(500).json({ error: 'Failed to load itineraries' });
  }
});

apiRouter.get('/itineraries/:shareCode', async (req, res) => {
  try {
    await ensureSeeded();
    const [row] = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.shareCode, String(req.params.shareCode)))
      .limit(1);

    if (!row) return res.status(404).json({ error: 'Itinerary not found' });

    const [hydrated] = await hydrateItineraries([row]);
    res.json({ itinerary: hydrated });
  } catch (err) {
    console.error('Error fetching itinerary by shareCode:', err);
    res.status(500).json({ error: 'Failed to load itinerary' });
  }
});

const itineraryPayloadSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(800).optional().nullable(),
  startDate: z.string().min(4).max(40),
  endDate: z.string().min(4).max(40),
  travelMode: z.enum(['driving', 'walking', 'cycling']).default('driving'),
  totalDistanceKm: z.number().min(0).default(0),
  estimatedDurationMin: z.number().int().min(0).default(0),
  isPublic: z.boolean().default(false),
  days: z
    .array(
      z.object({
        dayNumber: z.number().int().min(1).max(30),
        dateLabel: z.string().max(120).optional().nullable(),
        notes: z.string().max(600).optional().nullable(),
        stops: z.array(
          z.object({
            destinationId: z.number().int().positive(),
            visitDurationMin: z.number().int().min(15).max(1440).default(180),
            notes: z.string().max(400).optional().nullable(),
          })
        ),
      })
    )
    .min(1),
});

apiRouter.post('/itineraries', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = itineraryPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid itinerary structure', details: parsed.error.flatten() });
    }

    const shareCode = `rw-${crypto.randomBytes(4).toString('hex')}`;
    const [created] = await db
      .insert(itineraries)
      .values({
        userId: req.profile!.id,
        shareCode,
        title: parsed.data.title,
        description: parsed.data.description || null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        travelMode: parsed.data.travelMode,
        totalDistanceKm: parsed.data.totalDistanceKm,
        estimatedDurationMin: parsed.data.estimatedDurationMin,
        isPublic: parsed.data.isPublic,
      })
      .returning();

    for (const day of parsed.data.days) {
      const [createdDay] = await db
        .insert(itineraryDays)
        .values({
          itineraryId: created.id,
          dayNumber: day.dayNumber,
          dateLabel: day.dateLabel || `Day ${day.dayNumber}`,
          notes: day.notes || null,
        })
        .returning();

      if (day.stops.length > 0) {
        await db.insert(itineraryDestinations).values(
          day.stops.map((stop, idx) => ({
            itineraryDayId: createdDay.id,
            destinationId: stop.destinationId,
            sortOrder: idx + 1,
            visitDurationMin: stop.visitDurationMin,
            notes: stop.notes || null,
          }))
        );
      }
    }

    const [hydrated] = await hydrateItineraries([created]);
    res.status(201).json({ itinerary: hydrated });
  } catch (err) {
    console.error('Error saving itinerary:', err);
    res.status(500).json({ error: 'Failed to save itinerary' });
  }
});

apiRouter.put('/itineraries/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = itineraryPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid itinerary payload' });

    const [existing] = await db
      .select()
      .from(itineraries)
      .where(and(eq(itineraries.id, id), eq(itineraries.userId, req.profile!.id)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Itinerary not found or unauthorized' });

    const [updated] = await db
      .update(itineraries)
      .set({
        title: parsed.data.title,
        description: parsed.data.description || null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        travelMode: parsed.data.travelMode,
        totalDistanceKm: parsed.data.totalDistanceKm,
        estimatedDurationMin: parsed.data.estimatedDurationMin,
        isPublic: parsed.data.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(itineraries.id, id))
      .returning();

    await db.delete(itineraryDays).where(eq(itineraryDays.itineraryId, id));

    for (const day of parsed.data.days) {
      const [createdDay] = await db
        .insert(itineraryDays)
        .values({
          itineraryId: updated.id,
          dayNumber: day.dayNumber,
          dateLabel: day.dateLabel || `Day ${day.dayNumber}`,
          notes: day.notes || null,
        })
        .returning();

      if (day.stops.length > 0) {
        await db.insert(itineraryDestinations).values(
          day.stops.map((stop, idx) => ({
            itineraryDayId: createdDay.id,
            destinationId: stop.destinationId,
            sortOrder: idx + 1,
            visitDurationMin: stop.visitDurationMin,
            notes: stop.notes || null,
          }))
        );
      }
    }

    const [hydrated] = await hydrateItineraries([updated]);
    res.json({ itinerary: hydrated });
  } catch (err) {
    console.error('Error updating itinerary:', err);
    res.status(500).json({ error: 'Failed to update itinerary' });
  }
});

apiRouter.delete('/itineraries/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = await db
      .delete(itineraries)
      .where(and(eq(itineraries.id, id), eq(itineraries.userId, req.profile!.id)))
      .returning();
    if (deleted.length === 0) return res.status(404).json({ error: 'Itinerary not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting itinerary:', err);
    res.status(500).json({ error: 'Failed to delete itinerary' });
  }
});

// ========================
// FAVORITES, REVIEWS, REPORTS & NOTIFICATIONS
// ========================
apiRouter.get('/favorites', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: favorites.id,
        collectionType: favorites.collectionType,
        createdAt: favorites.createdAt,
        destination: destinations,
      })
      .from(favorites)
      .innerJoin(destinations, eq(favorites.destinationId, destinations.id))
      .where(eq(favorites.userId, req.profile!.id))
      .orderBy(desc(favorites.createdAt));

    const destIds = [...new Set(rows.map((r) => r.destination.id))];
    const imgs =
      destIds.length > 0
        ? await db
            .select()
            .from(destinationImages)
            .where(and(inArray(destinationImages.destinationId, destIds), eq(destinationImages.isPrimary, true)))
        : [];
    const imgMap = new Map(imgs.map((i) => [i.destinationId, i.imageUrl]));

    res.json({
      favorites: rows.map((r) => ({
        ...r,
        destination: {
          ...r.destination,
          primaryImage: imgMap.get(r.destination.id) || null,
        },
      })),
    });
  } catch (err) {
    console.error('Error fetching favorites:', err);
    res.status(500).json({ error: 'Failed to load favorites' });
  }
});

const toggleFavSchema = z.object({
  destinationId: z.number().int().positive(),
  collectionType: z.enum(['favorite', 'saved']).default('favorite'),
});

apiRouter.post('/favorites/toggle', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = toggleFavSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid favorite request' });

    const existing = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, req.profile!.id),
          eq(favorites.destinationId, parsed.data.destinationId),
          eq(favorites.collectionType, parsed.data.collectionType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db.delete(favorites).where(eq(favorites.id, existing[0].id));
      return res.json({ active: false });
    }

    await db.insert(favorites).values({
      userId: req.profile!.id,
      destinationId: parsed.data.destinationId,
      collectionType: parsed.data.collectionType,
    });
    res.json({ active: true });
  } catch (err) {
    console.error('Error toggling favorite:', err);
    res.status(500).json({ error: 'Failed to update saved places' });
  }
});

const reviewSchema = z.object({
  destinationId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(120),
  comment: z.string().min(10).max(1500),
  visitDate: z.string().max(40).optional(),
  photoUrls: z.array(z.string().url()).max(4).optional(),
});

apiRouter.post('/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid review details', details: parsed.error.flatten() });
    }

    // Prevent duplicate reviews per user per destination; allow updating own existing review
    const [existing] = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, req.profile!.id),
          eq(reviews.destinationId, parsed.data.destinationId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(reviews)
        .set({
          rating: parsed.data.rating,
          title: parsed.data.title,
          comment: parsed.data.comment,
          visitDate: parsed.data.visitDate || null,
          photoUrls: parsed.data.photoUrls || [],
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, existing.id))
        .returning();
      return res.json({ review: updated, updatedExisting: true });
    }

    const [created] = await db
      .insert(reviews)
      .values({
        userId: req.profile!.id,
        destinationId: parsed.data.destinationId,
        rating: parsed.data.rating,
        title: parsed.data.title,
        comment: parsed.data.comment,
        visitDate: parsed.data.visitDate || null,
        photoUrls: parsed.data.photoUrls || [],
        moderationStatus: 'approved',
      })
      .returning();

    res.status(201).json({ review: created, updatedExisting: false });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

apiRouter.get('/reviews/mine', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        moderationStatus: reviews.moderationStatus,
        createdAt: reviews.createdAt,
        destinationName: destinations.name,
        destinationSlug: destinations.slug,
      })
      .from(reviews)
      .innerJoin(destinations, eq(reviews.destinationId, destinations.id))
      .where(eq(reviews.userId, req.profile!.id))
      .orderBy(desc(reviews.createdAt));

    res.json({ reviews: rows });
  } catch (err) {
    console.error('Error fetching user reviews:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

const reportSchema = z.object({
  targetType: z.enum(['review', 'provider', 'destination']),
  targetId: z.number().int().positive(),
  reason: z.string().min(3).max(160),
  details: z.string().max(600).optional(),
});

apiRouter.post('/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid report submission' });

    const [created] = await db
      .insert(reports)
      .values({
        reporterId: req.profile!.id,
        ...parsed.data,
      })
      .returning();

    res.status(201).json({ report: created });
  } catch (err) {
    console.error('Error filing report:', err);
    res.status(500).json({ error: 'Failed to file report' });
  }
});

apiRouter.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.profile!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(20);
    res.json({ notifications: rows });
  } catch (err) {
    console.error('Error loading notifications:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

apiRouter.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, req.profile!.id)));
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// ========================
// EXTERNAL API PROXIES
// ========================
apiRouter.get('/external/weather', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'Valid lat and lon query parameters are required.' });
    }
    const data = await fetchOpenMeteoWeather(lat, lon);
    res.json(data);
  } catch (err) {
    console.error('Open-Meteo proxy error:', err);
    res.status(502).json({ error: 'Weather service temporarily unavailable' });
  }
});

apiRouter.get('/external/route', async (req, res) => {
  try {
    const profile = (req.query.profile as 'driving' | 'walking' | 'cycling') || 'driving';
    const rawWaypoints = String(req.query.waypoints || '');
    const waypoints = rawWaypoints
      .split(';')
      .map((pair) => {
        const [lonStr, latStr] = pair.split(',');
        return { lat: Number(latStr), lon: Number(lonStr) };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

    if (waypoints.length < 2) {
      return res.status(400).json({ error: 'At least two valid waypoints (lon,lat;lon,lat) are required.' });
    }

    const route = await fetchOsrmRoute(waypoints, profile);
    res.json(route);
  } catch (err) {
    console.error('OSRM route error:', err);
    res.status(502).json({ error: 'Routing calculation failed' });
  }
});

apiRouter.get('/external/geocode', async (req, res) => {
  try {
    const q = String(req.query.q || '');
    if (!q.trim()) return res.json({ results: [] });
    const results = await fetchNominatimGeocode(q);
    res.json({ results });
  } catch (err) {
    console.error('Nominatim geocode error:', err);
    res.status(502).json({ error: 'Geocoding search temporarily unavailable' });
  }
});

apiRouter.get('/external/country', async (_req, res) => {
  try {
    const info = await fetchRwandaCountryInfo();
    res.json(info);
  } catch (err) {
    console.error('REST Countries error:', err);
    res.status(502).json({ error: 'Country profile unavailable' });
  }
});

apiRouter.get('/external/wikimedia', async (req, res) => {
  try {
    const query = String(req.query.query || '');
    if (!query.trim()) return res.json({ photos: [] });
    const photos = await fetchWikimediaCommonsPhotos(query);
    res.json({ photos });
  } catch (err) {
    console.error('Wikimedia Commons error:', err);
    res.json({ photos: [] });
  }
});

// ========================
// ADMIN DASHBOARD ROUTES (RBAC PROTECTED)
// ========================
apiRouter.get('/admin/overview', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    await ensureSeeded();
    const [
      [userCount],
      [destCount],
      [providerCount],
      [pendingProviderCount],
      [reviewCount],
      [inquiryCount],
      [openReportCount],
      [itineraryCount],
    ] = await Promise.all([
      db.select({ value: count() }).from(profiles),
      db.select({ value: count() }).from(destinations),
      db.select({ value: count() }).from(tourismProviders),
      db
        .select({ value: count() })
        .from(tourismProviders)
        .where(eq(tourismProviders.verificationStatus, 'pending')),
      db.select({ value: count() }).from(reviews),
      db.select({ value: count() }).from(inquiries),
      db.select({ value: count() }).from(reports).where(eq(reports.status, 'open')),
      db.select({ value: count() }).from(itineraries),
    ]);

    const popularDestinations = await db
      .select({
        id: destinations.id,
        name: destinations.name,
        slug: destinations.slug,
        province: destinations.province,
        district: destinations.district,
        popularityScore: destinations.popularityScore,
      })
      .from(destinations)
      .orderBy(desc(destinations.popularityScore))
      .limit(6);

    const byProvince = await db
      .select({
        province: destinations.province,
        total: count(),
      })
      .from(destinations)
      .groupBy(destinations.province);

    const recentActivity = await db
      .select({
        id: reviews.id,
        title: reviews.title,
        rating: reviews.rating,
        createdAt: reviews.createdAt,
        authorName: profiles.fullName,
        destinationName: destinations.name,
      })
      .from(reviews)
      .innerJoin(profiles, eq(reviews.userId, profiles.id))
      .innerJoin(destinations, eq(reviews.destinationId, destinations.id))
      .orderBy(desc(reviews.createdAt))
      .limit(6);

    res.json({
      stats: {
        totalUsers: Number(userCount.value),
        totalDestinations: Number(destCount.value),
        totalProviders: Number(providerCount.value),
        pendingProviders: Number(pendingProviderCount.value),
        totalReviews: Number(reviewCount.value),
        totalInquiries: Number(inquiryCount.value),
        openReports: Number(openReportCount.value),
        totalItineraries: Number(itineraryCount.value),
      },
      popularDestinations,
      byProvince: byProvince.map((p) => ({ province: p.province, total: Number(p.total) })),
      recentActivity,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to load admin analytics' });
  }
});

const adminDestSchema = z.object({
  name: z.string().min(3).max(140),
  categoryId: z.number().int().positive(),
  shortSummary: z.string().min(10).max(300),
  description: z.string().min(20).max(3000),
  district: z.string().min(2).max(80),
  province: z.string().min(2).max(80),
  latitude: z.number().min(-3.5).max(-0.5),
  longitude: z.number().min(28.5).max(31.5),
  entranceInfo: z.string().min(4).max(400),
  activities: z.array(z.string()).default([]),
  contactInfo: z.string().max(200).optional(),
  visitorGuidelines: z.string().min(4).max(600),
  elevationMeters: z.number().int().optional(),
  featured: z.boolean().default(false),
  imageUrl: z.string().min(5).optional(),
});

apiRouter.post('/admin/destinations', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const parsed = adminDestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid destination data', details: parsed.error.flatten() });
    }
    const slug = `${parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${crypto.randomBytes(2).toString('hex')}`;

    const { imageUrl, ...destFields } = parsed.data;
    const [created] = await db
      .insert(destinations)
      .values({ ...destFields, slug, status: 'published' })
      .returning();

    await db.insert(destinationImages).values({
      destinationId: created.id,
      imageUrl: imageUrl || '/src/assets/images/hero_volcanoes_rwanda_1794986076294.jpg',
      caption: created.name,
      isPrimary: true,
    });

    res.status(201).json({ destination: created });
  } catch (err) {
    console.error('Admin create destination error:', err);
    res.status(500).json({ error: 'Failed to create destination' });
  }
});

apiRouter.patch('/admin/destinations/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const partial = adminDestSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: 'Invalid destination update' });

    const { imageUrl, ...fields } = partial.data;
    const [updated] = await db
      .update(destinations)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(destinations.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Destination not found' });

    if (imageUrl) {
      await db
        .update(destinationImages)
        .set({ imageUrl, updatedAt: new Date() })
        .where(and(eq(destinationImages.destinationId, id), eq(destinationImages.isPrimary, true)));
    }

    res.json({ destination: updated });
  } catch (err) {
    console.error('Admin update destination error:', err);
    res.status(500).json({ error: 'Failed to update destination' });
  }
});

apiRouter.delete('/admin/destinations/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(destinations).where(eq(destinations.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete destination error:', err);
    res.status(500).json({ error: 'Failed to delete destination' });
  }
});

apiRouter.post('/admin/categories', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(80),
      description: z.string().min(5).max(300),
      iconName: z.string().default('Compass'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid category payload' });

    const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const [created] = await db
      .insert(destinationCategories)
      .values({ ...parsed.data, slug })
      .returning();
    res.status(201).json({ category: created });
  } catch (err) {
    console.error('Admin create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

apiRouter.get('/admin/providers', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(tourismProviders)
      .orderBy(desc(tourismProviders.createdAt));
    res.json({ providers: rows });
  } catch (err) {
    console.error('Admin providers error:', err);
    res.status(500).json({ error: 'Failed to load providers' });
  }
});

apiRouter.patch('/admin/providers/:id/verify', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ status: z.enum(['verified', 'rejected', 'pending']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid verification status' });

    const [updated] = await db
      .update(tourismProviders)
      .set({
        verificationStatus: parsed.data.status,
        verifiedAt: parsed.data.status === 'verified' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(tourismProviders.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Provider not found' });

    if (updated.userId) {
      await db.insert(notifications).values({
        userId: updated.userId,
        title: `Provider Status Updated: ${parsed.data.status.toUpperCase()}`,
        message: `Your organization "${updated.businessName}" verification status is now ${parsed.data.status}.`,
        category: 'moderation',
        linkUrl: '/providers',
      });
    }

    res.json({ provider: updated });
  } catch (err) {
    console.error('Admin verify provider error:', err);
    res.status(500).json({ error: 'Failed to update provider verification' });
  }
});

apiRouter.post('/admin/accommodations', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(3).max(140),
      accommodationType: z.enum(['hotel', 'resort', 'guesthouse', 'lodge', 'campsite', 'apartment']),
      description: z.string().min(10).max(1000),
      district: z.string().min(2).max(80),
      province: z.string().min(2).max(80),
      address: z.string().min(3).max(160),
      latitude: z.number().min(-3.5).max(-0.5),
      longitude: z.number().min(28.5).max(31.5),
      verifiedPriceRange: z.string().max(80).optional(),
      externalBookingUrl: z.string().url().optional(),
      facilities: z.array(z.string()).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid accommodation payload' });

    const slug = `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(2).toString('hex')}`;
    const [created] = await db
      .insert(accommodations)
      .values({ ...parsed.data, slug })
      .returning();

    await db.insert(accommodationImages).values({
      accommodationId: created.id,
      imageUrl: '/src/assets/images/accom_eco_lodge_1794986078482.jpg',
      caption: created.name,
      isPrimary: true,
    });

    res.status(201).json({ accommodation: created });
  } catch (err) {
    console.error('Admin create accommodation error:', err);
    res.status(500).json({ error: 'Failed to create accommodation' });
  }
});

apiRouter.delete('/admin/accommodations/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await db.delete(accommodations).where(eq(accommodations.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete accommodation error:', err);
    res.status(500).json({ error: 'Failed to delete accommodation' });
  }
});

apiRouter.get('/admin/users', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const userRows = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    const roleRows = await db.select().from(userRoles);
    res.json({
      users: userRows.map((u) => ({
        ...u,
        roles: roleRows.filter((r) => r.userId === u.id).map((r) => r.role),
      })),
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

apiRouter.post('/admin/users/:id/roles', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    const schema = z.object({
      role: z.enum(['tourist', 'provider', 'admin']),
      action: z.enum(['add', 'remove']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid role update' });

    if (parsed.data.action === 'add') {
      await db
        .insert(userRoles)
        .values({
          userId: targetId,
          role: parsed.data.role,
          assignedBy: req.profile!.email,
        })
        .onConflictDoNothing();
    } else {
      await db
        .delete(userRoles)
        .where(and(eq(userRoles.userId, targetId), eq(userRoles.role, parsed.data.role)));
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Admin role update error:', err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

apiRouter.get('/admin/reviews', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        moderationStatus: reviews.moderationStatus,
        createdAt: reviews.createdAt,
        authorName: profiles.fullName,
        authorEmail: profiles.email,
        destinationName: destinations.name,
      })
      .from(reviews)
      .innerJoin(profiles, eq(reviews.userId, profiles.id))
      .innerJoin(destinations, eq(reviews.destinationId, destinations.id))
      .orderBy(desc(reviews.createdAt));

    res.json({ reviews: rows });
  } catch (err) {
    console.error('Admin reviews error:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

apiRouter.patch('/admin/reviews/:id/moderate', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const schema = z.object({ status: z.enum(['approved', 'flagged', 'removed']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid moderation status' });

    const [updated] = await db
      .update(reviews)
      .set({ moderationStatus: parsed.data.status, updatedAt: new Date() })
      .where(eq(reviews.id, Number(req.params.id)))
      .returning();

    res.json({ review: updated });
  } catch (err) {
    console.error('Admin moderate review error:', err);
    res.status(500).json({ error: 'Failed to moderate review' });
  }
});

apiRouter.get('/admin/reports', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await db.select().from(reports).orderBy(desc(reports.createdAt));
    res.json({ reports: rows });
  } catch (err) {
    console.error('Admin reports error:', err);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

apiRouter.patch('/admin/reports/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ status: z.enum(['resolved', 'dismissed', 'open']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid report status' });

    const [updated] = await db
      .update(reports)
      .set({
        status: parsed.data.status,
        resolvedBy: req.profile!.email,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, Number(req.params.id)))
      .returning();

    res.json({ report: updated });
  } catch (err) {
    console.error('Admin report update error:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

apiRouter.get('/admin/settings', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await db.select().from(platformSettings).orderBy(asc(platformSettings.key));
    res.json({ settings: rows });
  } catch (err) {
    console.error('Admin settings error:', err);
    res.status(500).json({ error: 'Failed to load platform settings' });
  }
});

apiRouter.put('/admin/settings', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const schema = z.object({
      key: z.string().min(2).max(80),
      value: z.string().min(1).max(400),
      description: z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid setting payload' });

    const [updated] = await db
      .insert(platformSettings)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: parsed.data.value,
          description: parsed.data.description,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ setting: updated });
  } catch (err) {
    console.error('Admin setting save error:', err);
    res.status(500).json({ error: 'Failed to save platform setting' });
  }
});
