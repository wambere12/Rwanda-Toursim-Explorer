import { count } from 'drizzle-orm';
import { db } from './index.ts';
import {
  accommodationImages,
  accommodations,
  destinationCategories,
  destinationImages,
  destinations,
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
} from './schema.ts';

let seedPromise: Promise<void> | null = null;
let hasCheckedSeed = false;

export async function ensureSeeded(): Promise<void> {
  if (hasCheckedSeed) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const existing = await db.select({ value: count() }).from(destinations);
      if (Number(existing[0]?.value ?? 0) > 0) {
        hasCheckedSeed = true;
        return;
      }

      console.log('Seeding Rwanda Tourism Explorer PostgreSQL database...');

      // 1. Editorial Curator & Traveler Profiles
      const insertedProfiles = await db
        .insert(profiles)
        .values([
          {
            uid: 'seed-curator-rwanda',
            email: 'curator@rwandatourismexplorer.rw',
            fullName: 'Aline Uwase',
            nationality: 'Rwanda',
            travelStyle: 'Conservation & Cultural Heritage',
            preferredCurrency: 'USD',
            travelHistory: ['Volcanoes National Park', 'Nyungwe National Park', 'Lake Kivu'],
          },
          {
            uid: 'seed-traveler-claire',
            email: 'claire.dubois@example.com',
            fullName: 'Claire Dubois',
            nationality: 'France',
            travelStyle: 'Wildlife & Eco-Lodges',
            preferredCurrency: 'EUR',
            travelHistory: ['Kigali Genocide Memorial', 'Akagera National Park'],
          },
          {
            uid: 'seed-provider-karisimbi',
            email: 'dispatch@virungahorizons.rw',
            fullName: 'Jean-Paul Habimana',
            nationality: 'Rwanda',
            travelStyle: 'Mountain Expeditions',
            preferredCurrency: 'USD',
            travelHistory: ['Mount Karisimbi', 'Mount Bisoke Crater Lake'],
          },
        ])
        .returning();

      const curatorId = insertedProfiles[0].id;
      const travelerId = insertedProfiles[1].id;
      const providerOwnerId = insertedProfiles[2].id;

      await db.insert(userRoles).values([
        { userId: curatorId, role: 'tourist', assignedBy: 'seed' },
        { userId: travelerId, role: 'tourist', assignedBy: 'seed' },
        { userId: providerOwnerId, role: 'provider', assignedBy: 'seed' },
      ]);

      // 2. 11 Destination Categories
      const categoryRows = await db
        .insert(destinationCategories)
        .values([
          {
            slug: 'national-parks',
            name: 'National Parks',
            description: 'Protected biodiversity sanctuaries spanning volcanic bamboo forests, ancient rainforest, and savannah.',
            iconName: 'Trees',
            sortOrder: 1,
          },
          {
            slug: 'mountains-volcanoes',
            name: 'Mountains & Volcanoes',
            description: 'Dramatic Virunga peaks, alpine crater lakes, and panoramic ridge treks.',
            iconName: 'Mountain',
            sortOrder: 2,
          },
          {
            slug: 'lakes-beaches',
            name: 'Lakes & Beaches',
            description: 'Emerald rift-valley shores, peninsulas, and tranquil volcanic twin lakes.',
            iconName: 'Waves',
            sortOrder: 3,
          },
          {
            slug: 'museums',
            name: 'Museums',
            description: 'Curated ethnographic collections, royal palaces, and natural history archives.',
            iconName: 'Landmark',
            sortOrder: 4,
          },
          {
            slug: 'historical-sites',
            name: 'Historical Sites',
            description: 'Memorials and preserved landmarks telling the resilience and history of Rwanda.',
            iconName: 'BookOpen',
            sortOrder: 5,
          },
          {
            slug: 'cultural-villages',
            name: 'Cultural Villages',
            description: 'Community-led storytelling, traditional Intore dance, and artisan craft workshops.',
            iconName: 'Users',
            sortOrder: 6,
          },
          {
            slug: 'waterfalls',
            name: 'Waterfalls',
            description: 'Cascading mountain falls tucked inside rainforest gullies and cliffside valleys.',
            iconName: 'Droplets',
            sortOrder: 7,
          },
          {
            slug: 'forests',
            name: 'Forests',
            description: 'Ancient montane canopies, orchid trails, and chimpanzee habitats.',
            iconName: 'Leaf',
            sortOrder: 8,
          },
          {
            slug: 'wildlife',
            name: 'Wildlife Destinations',
            description: 'Big Five savannah reserves and prime primate tracking corridors.',
            iconName: 'Binoculars',
            sortOrder: 9,
          },
          {
            slug: 'adventure',
            name: 'Adventure Tourism',
            description: 'Multi-day cycling trails, kayaking routes, and high-elevation canopy crossings.',
            iconName: 'Compass',
            sortOrder: 10,
          },
          {
            slug: 'heritage',
            name: 'Religious & Cultural Heritage',
            description: 'Sacred pilgrimage sanctuaries, contemporary art studios, and architectural landmarks.',
            iconName: 'Sparkles',
            sortOrder: 11,
          },
        ])
        .returning();

      const catBySlug = Object.fromEntries(categoryRows.map((c) => [c.slug, c.id]));

      // 3. Destinations across all 11 categories & 5 provinces
      const IMG_VOLCANOES = '/src/assets/images/hero_volcanoes_rwanda_1794986076294.jpg';
      const IMG_NYUNGWE = '/src/assets/images/dest_nyungwe_canopy_1794986076889.jpg';
      const IMG_KIVU = '/src/assets/images/dest_lake_kivu_1794986078473.jpg';
      const IMG_AKAGERA = '/src/assets/images/dest_akagera_savannah_1794986077419.jpg';
      const IMG_KIGALI = '/src/assets/images/dest_kigali_culture_1794986078057.jpg';

      const destSeed = [
        {
          slug: 'volcanoes-national-park',
          categoryId: catBySlug['national-parks'],
          name: 'Volcanoes National Park',
          shortSummary: 'Misty Virunga bamboo slopes famed for mountain gorilla conservation and golden monkey tracking.',
          description:
            'Situated in northwestern Rwanda along the Virunga Massif, Volcanoes National Park protects steep emerald rainforests rising from 2,400m to 4,507m. Visitors trek through ancient hagenia and bamboo zones alongside expert park rangers to observe habituated mountain gorilla families and rare golden monkeys.',
          district: 'Musanze',
          province: 'Northern',
          latitude: -1.4833,
          longitude: 29.5333,
          entranceInfo: 'Rwanda Development Board permit required in advance; briefing at Kinigi Park Headquarters at 07:00.',
          activities: ['Mountain Gorilla Trekking', 'Golden Monkey Tracking', 'Dian Fossey Tomb Hike', 'Nature Photography'],
          contactInfo: 'Kinigi Reception · +250 788 311 000 · visitrwanda.com',
          visitorGuidelines: 'Maintain a 10-meter observation distance, wear sturdy waterproof hiking boots, and bring a face mask for primate health.',
          bestSeason: 'June – September & December – February',
          elevationMeters: 2800,
          wikimediaTitle: 'Volcanoes National Park Rwanda',
          featured: true,
          popularityScore: 99,
          imageUrl: IMG_VOLCANOES,
          caption: 'Morning mist over the Virunga peaks in Musanze District',
        },
        {
          slug: 'nyungwe-canopy-walkway',
          categoryId: catBySlug['forests'],
          name: 'Nyungwe National Park & Canopy Walkway',
          shortSummary: 'One of Africa’s oldest montane rainforests with a 70-meter-high suspension bridge and chimpanzee trails.',
          description:
            'Spanning over 1,000 square kilometers in southwestern Rwanda, Nyungwe harbors 13 primate species, more than 300 bird species, and giant tree ferns. The iconic Igishigishigi Canopy Walkway suspends visitors 70 meters above the forest ravine with sweeping views across tea plantations and misty valleys.',
          district: 'Nyamagabe',
          province: 'Southern',
          latitude: -2.4847,
          longitude: 29.2078,
          entranceInfo: 'Park entry and guided canopy/chimpanzee permits issued at Uwinka, Kitabi, and Gisakura reception centers.',
          activities: ['Canopy Walk', 'Chimpanzee Tracking', 'Colobus Monkey Viewing', 'Birdwatching', 'Waterfall Trails'],
          contactInfo: 'Uwinka Visitor Center · +250 788 300 120',
          visitorGuidelines: 'Canopy walkway minimum age is 6 years; carry rain protection year-round due to rainforest microclimate.',
          bestSeason: 'Year-round (dry trails June – August)',
          elevationMeters: 2450,
          wikimediaTitle: 'Nyungwe Forest National Park',
          featured: true,
          popularityScore: 96,
          imageUrl: IMG_NYUNGWE,
          caption: 'Elevated suspension bridge stretching across Nyungwe canopy',
        },
        {
          slug: 'lake-kivu-karongi-rubavu',
          categoryId: catBySlug['lakes-beaches'],
          name: 'Lake Kivu Shores (Karongi & Rubavu)',
          shortSummary: 'Tranquil emerald rift-valley lake framed by terraced hillsides, coffee islands, and sandy waterfronts.',
          description:
            'Stretching along Rwanda’s western border, Lake Kivu offers calm, bilharzia-free freshwater beaches, scenic boat excursions to Napoleon Island, and coastal cycling along terraced emerald peninsulas. Evenings bring traditional singing fishermen gliding across the water at sunset.',
          district: 'Karongi',
          province: 'Western',
          latitude: -2.0603,
          longitude: 29.3478,
          entranceInfo: 'Public shoreline beaches open freely; private boat charters and island excursions arranged locally.',
          activities: ['Sunset Boat Cruises', 'Kayaking', 'Napoleon Island Hike', 'Coffee Farm Visits', 'Lakeside Relaxation'],
          contactInfo: 'Karongi Tourism Office · +250 788 452 190',
          visitorGuidelines: 'Use certified life jackets on all boat transfers and respect local fishing hours.',
          bestSeason: 'May – October',
          elevationMeters: 1463,
          wikimediaTitle: 'Lake Kivu',
          featured: true,
          popularityScore: 94,
          imageUrl: IMG_KIVU,
          caption: 'Terraced green peninsulas and wooden boats on Lake Kivu',
        },
        {
          slug: 'akagera-national-park',
          categoryId: catBySlug['wildlife'],
          name: 'Akagera National Park',
          shortSummary: 'Central Africa’s largest protected wetland savannah, home to the Big Five and lakeside hippos.',
          description:
            'Located in eastern Rwanda along the Akagera River basin, Akagera combines open acacia savannah, rolling highlands, and papyrus-fringed lakes. Successful conservation reintroductions of lions and black and white rhinos make Akagera a premier Big Five safari destination just 2.5 hours from Kigali.',
          district: 'Kayonza',
          province: 'Eastern',
          latitude: -1.878,
          longitude: 30.713,
          entranceInfo: 'Day entry and vehicle passes registered at Kiyonza South Gate; guided night drives and Lake Ihema boat safaris bookable on-site.',
          activities: ['Big Five Game Drives', 'Lake Ihema Boat Safari', 'Behind-the-Scenes Conservation Tour', 'Night Game Drive'],
          contactInfo: 'Akagera Management · +250 786 182 871 · africanparks.org',
          visitorGuidelines: 'Remain inside safari vehicles except at designated picnic viewpoints; 40 km/h park speed limit.',
          bestSeason: 'June – September',
          elevationMeters: 1300,
          wikimediaTitle: 'Akagera National Park',
          featured: true,
          popularityScore: 95,
          imageUrl: IMG_AKAGERA,
          caption: 'Acacia savannah and lakes in Akagera National Park',
        },
        {
          slug: 'kigali-genocide-memorial',
          categoryId: catBySlug['historical-sites'],
          name: 'Kigali Genocide Memorial',
          shortSummary: 'Dignified national place of remembrance, historical education, and peace-building in Gisozi.',
          description:
            'Inaugurated in 2004 in Kigali’s Gisozi neighborhood, the Kigali Genocide Memorial is the final resting place for more than 250,000 victims of the 1994 Genocide against the Tutsi. Its thoughtfully curated exhibitions and quiet terraced gardens invite reflection, education, and commitment to reconciliation.',
          district: 'Gasabo',
          province: 'Kigali City',
          latitude: -1.9307,
          longitude: 30.0609,
          entranceInfo: 'Free admission daily 08:00 – 17:00; audio guides available in multiple languages for a modest conservation fee.',
          activities: ['Historical Exhibition', 'Memorial Gardens Walk', 'Audio Guided Tour'],
          contactInfo: 'Gisozi, Kigali · +250 252 503 730 · kgm.rw',
          visitorGuidelines: 'Modest attire, quiet demeanor, and photography restrictions apply inside exhibition halls.',
          bestSeason: 'Year-round',
          elevationMeters: 1510,
          wikimediaTitle: 'Kigali Genocide Memorial',
          featured: false,
          popularityScore: 93,
          imageUrl: IMG_KIGALI,
          caption: 'Tree-lined Kigali hillside overlooking cultural districts',
        },
        {
          slug: 'mount-bisoke-crater-lake',
          categoryId: catBySlug['mountains-volcanoes'],
          name: 'Mount Bisoke Crater Lake',
          shortSummary: 'Rewarding full-day volcano climb culminating at a misty 3,711-meter alpine crater lake.',
          description:
            'Straddling the border of Rwanda and DR Congo within the Virunga chain, Mount Bisoke rewards hikers with a dramatic steep ascent through bamboo, hagenia, and Afro-alpine lobelia zones to a circular crater lake shimmering inside the dormant caldera.',
          district: 'Musanze',
          province: 'Northern',
          latitude: -1.4614,
          longitude: 29.4919,
          entranceInfo: 'Day hiking permit obtained via RDB; armed park ranger and porter hire available at Kinigi.',
          activities: ['Volcano Summit Trek', 'Crater Lake Photography', 'Alpine Flora Observation'],
          contactInfo: 'Kinigi Park HQ · +250 788 311 000',
          visitorGuidelines: 'Moderate-to-challenging 6-hour round-trip hike; carry at least 2 liters of water and thermal layers.',
          bestSeason: 'June – September',
          elevationMeters: 3711,
          wikimediaTitle: 'Mount Bisoke',
          featured: false,
          popularityScore: 88,
          imageUrl: IMG_VOLCANOES,
          caption: 'Volcanic peaks of the Virunga range at dawn',
        },
        {
          slug: 'ethnographic-museum-huye',
          categoryId: catBySlug['museums'],
          name: 'Ethnographic Museum (Huye)',
          shortSummary: 'East Africa’s finest cultural history museum showcasing pre-colonial craftsmanship and heritage.',
          description:
            'Located in Huye (formerly Butare), the Ethnographic Museum houses seven architectural galleries detailing Rwanda’s geological roots, traditional basketry, pottery, royal regalia, and living agricultural crafts.',
          district: 'Huye',
          province: 'Southern',
          latitude: -2.5892,
          longitude: 29.7433,
          entranceInfo: 'Open daily 09:00 – 17:00; entry tickets available at Rwanda Cultural Heritage Academy reception.',
          activities: ['Guided Gallery Tour', 'Artisan Craft Showcase', 'Traditional Architecture Walk'],
          contactInfo: 'Huye · +250 788 389 000 · rcha.gov.rw',
          visitorGuidelines: 'Guided tours included with admission; photography permits requested for interior galleries.',
          bestSeason: 'Year-round',
          elevationMeters: 1768,
          wikimediaTitle: 'Ethnographic Museum Rwanda',
          featured: false,
          popularityScore: 84,
          imageUrl: IMG_KIGALI,
          caption: 'Contemporary and heritage architecture in Rwanda',
        },
        {
          slug: 'kings-palace-museum-nyanza',
          categoryId: catBySlug['museums'],
          name: "King's Palace Museum (Nyanza)",
          shortSummary: 'Reconstructed traditional thatched royal residence and home to sacred Inyambo long-horned cattle.',
          description:
            'Set on Rukari Hill in Nyanza, the King’s Palace Museum reconstructs the 19th-century beehive-shaped royal compound of King Mutara III Rudahigwa alongside his 1931 modern palace, complete with pastoralists singing to the iconic royal Inyambo cattle.',
          district: 'Nyanza',
          province: 'Southern',
          latitude: -2.3569,
          longitude: 29.7495,
          entranceInfo: 'Open daily 08:00 – 18:00; guided storytelling included.',
          activities: ['Royal Compound Tour', 'Inyambo Cattle Presentation', 'Colonial Residence Visit'],
          contactInfo: 'Nyanza · rcha.gov.rw',
          visitorGuidelines: 'Keep calm around royal Inyambo cattle; follow guide pathways inside the reed enclosure.',
          bestSeason: 'Year-round',
          elevationMeters: 1790,
          wikimediaTitle: 'Kings Palace Museum Nyanza',
          featured: false,
          popularityScore: 86,
          imageUrl: IMG_KIGALI,
          caption: 'Rwandan royal heritage and cultural preservation',
        },
        {
          slug: 'gorilla-guardians-cultural-village',
          categoryId: catBySlug['cultural-villages'],
          name: "Gorilla Guardians Village (Iby'Iwacu)",
          shortSummary: 'Community-run cultural center near Volcanoes Park celebrating Intore dance, music, and heritage.',
          description:
            'Founded by former poachers turned conservation ambassadors in Kinigi, Gorilla Guardians Village immerses travelers in traditional banana brewing, basket weaving, herbal medicine demonstrations, and energetic Intore warrior drumming.',
          district: 'Musanze',
          province: 'Northern',
          latitude: -1.491,
          longitude: 29.589,
          entranceInfo: 'Community entrance fee supports local school and conservation cooperatives; open 08:30 – 17:00.',
          activities: ['Intore Dance Performance', 'Basket Weaving Workshop', 'Traditional Archery', 'Community Storytelling'],
          contactInfo: 'Kinigi, Musanze · +250 788 504 200',
          visitorGuidelines: 'Tipping artisans and purchasing cooperative crafts directly supports community conservation.',
          bestSeason: 'Year-round',
          elevationMeters: 2250,
          wikimediaTitle: 'Intore dance Rwanda',
          featured: false,
          popularityScore: 87,
          imageUrl: IMG_VOLCANOES,
          caption: 'Highland communities bordering Volcanoes National Park',
        },
        {
          slug: 'kamiranzovu-waterfall',
          categoryId: catBySlug['waterfalls'],
          name: 'Kamiranzovu Waterfall & Marsh Trail',
          shortSummary: 'Lush rainforest cascade plunging through fern-clad cliffs inside Nyungwe National Park.',
          description:
            'Reaching Kamiranzovu Waterfall takes hikers down through ancient mahogany stands, wild orchids, and the high-altitude Kamiranzovu peat swamp before revealing a misty 50-meter curtain of mountain water.',
          district: 'Rusizi',
          province: 'Western',
          latitude: -2.473,
          longitude: 29.152,
          entranceInfo: 'Included in Nyungwe National Park guided day-hike permit.',
          activities: ['Guided Rainforest Hike', 'Waterfall Photography', 'Endemic Orchid Spotting'],
          contactInfo: 'Gisakura Reception · +250 788 300 120',
          visitorGuidelines: 'Trail can be steep and slippery after afternoon rains; trekking poles recommended.',
          bestSeason: 'June – September',
          elevationMeters: 1950,
          wikimediaTitle: 'Kamiranzovu Waterfall',
          featured: false,
          popularityScore: 82,
          imageUrl: IMG_NYUNGWE,
          caption: 'Rainforest canopy and waterfall valleys of Nyungwe',
        },
        {
          slug: 'congo-nile-trail',
          categoryId: catBySlug['adventure'],
          name: 'Congo Nile Trail',
          shortSummary: '227 km scenic cycling and trekking corridor linking Rubavu to Rusizi along Lake Kivu’s ridges.',
          description:
            'Following the watershed divide between the Nile and Congo river basins, the Congo Nile Trail weaves past terraced banana plantations, specialty coffee washing stations, and dramatic Lake Kivu bays.',
          district: 'Rutsiro',
          province: 'Western',
          latitude: -1.9462,
          longitude: 29.3385,
          entranceInfo: 'Open public trail; multi-day support vehicles, mountain bikes, and guesthouses bookable along stages.',
          activities: ['Mountain Biking', 'Multi-Day Trekking', 'Specialty Coffee Tasting', 'Lakeside Camping'],
          contactInfo: 'Rubavu Trailhead · visitrwanda.com',
          visitorGuidelines: 'Gravel/dirt stages require durable suspension bikes and daylight navigation.',
          bestSeason: 'June – September & January – February',
          elevationMeters: 1650,
          wikimediaTitle: 'Congo Nile Trail Rwanda',
          featured: false,
          popularityScore: 89,
          imageUrl: IMG_KIVU,
          caption: 'Terraced hillsides rising above Lake Kivu along the Congo Nile Trail',
        },
        {
          slug: 'kibeho-holy-land',
          categoryId: catBySlug['heritage'],
          name: 'Kibeho Sanctuary & Heritage Ridge',
          shortSummary: 'Serene hilltop pilgrimage destination in Nyaruguru surrounded by southern tea estates.',
          description:
            'Known internationally as a recognized pilgrimage sanctuary, Kibeho welcomes visitors seeking quiet reflection amid cool southern highlands, rolling tea plantations, and historic parish chapels.',
          district: 'Nyaruguru',
          province: 'Southern',
          latitude: -2.6486,
          longitude: 29.5553,
          entranceInfo: 'Open daily to visitors and pilgrims with respectful attire.',
          activities: ['Sanctuary Walk', 'Quiet Contemplation', 'Tea Estate Scenery'],
          contactInfo: 'Kibeho Parish · Nyaruguru District',
          visitorGuidelines: 'Observe quiet zones near prayer chapels and ask before photographing services.',
          bestSeason: 'Year-round',
          elevationMeters: 1920,
          wikimediaTitle: 'Kibeho Rwanda',
          featured: false,
          popularityScore: 80,
          imageUrl: IMG_KIGALI,
          caption: 'Peaceful hillside heritage landscape in southern Rwanda',
        },
      ];

      const insertedDests = await db
        .insert(destinations)
        .values(
          destSeed.map(({ imageUrl: _img, caption: _cap, ...rest }) => ({
            ...rest,
            status: 'published',
          }))
        )
        .returning();

      const destBySlug = Object.fromEntries(insertedDests.map((d) => [d.slug, d]));

      await db.insert(destinationImages).values(
        destSeed.map((d) => ({
          destinationId: destBySlug[d.slug].id,
          imageUrl: d.imageUrl,
          caption: d.caption,
          credit: 'Rwanda Tourism Explorer Editorial Archive',
          isPrimary: true,
          sortOrder: 0,
        }))
      );

      // 4. Accommodations across all 6 requested types
      const IMG_LODGE = '/src/assets/images/accom_eco_lodge_1794986078482.jpg';

      const accomSeed = [
        {
          slug: 'virunga-volcanoes-sanctuary-lodge',
          destinationId: destBySlug['volcanoes-national-park'].id,
          name: 'Virunga Mist Eco-Lodge',
          accommodationType: 'lodge',
          description: 'Volcanic-stone forest suites overlooking Mount Sabyinyo and terraced bamboo ridges, 12 minutes from Kinigi.',
          district: 'Musanze',
          province: 'Northern',
          address: 'Kinigi Sector, Musanze District',
          latitude: -1.469,
          longitude: 29.551,
          contactPhone: '+250 788 310 440',
          contactEmail: 'reservations@virungamist.rw',
          externalBookingUrl: 'https://www.visitrwanda.com/tourism/',
          verifiedPriceRange: '$420 – $780 / night (Full Board)',
          facilities: ['Fireplace Suites', 'Farm-to-Table Dining', 'Boot Cleaning Service', 'Airport Transfer'],
          rating: 4.9,
          imageUrl: IMG_LODGE,
        },
        {
          slug: 'nyungwe-forest-canopy-resort',
          destinationId: destBySlug['nyungwe-canopy-walkway'].id,
          name: 'Gisakura Tea & Canopy Resort',
          accommodationType: 'resort',
          description: 'Hillside tea-plantation resort offering heated forest chalets, spa treatments, and direct trailhead access.',
          district: 'Nyamasheke',
          province: 'Western',
          address: 'Gisakura Tea Estate Border, Nyamasheke',
          latitude: -2.441,
          longitude: 29.112,
          contactPhone: '+250 788 308 210',
          contactEmail: 'stay@gisakuraresort.rw',
          externalBookingUrl: 'https://www.visitrwanda.com/tourism/',
          verifiedPriceRange: '$340 – $620 / night',
          facilities: ['Heated Pool', 'Forest Spa', 'Guided Tea Walks', 'Restaurant & Bar'],
          rating: 4.8,
          imageUrl: IMG_NYUNGWE,
        },
        {
          slug: 'kivu-peninsula-serene-hotel',
          destinationId: destBySlug['lake-kivu-karongi-rubavu'].id,
          name: 'Karongi Peninsula Waterfront Hotel',
          accommodationType: 'hotel',
          description: 'Terraced lakeside boutique hotel with private jetty, kayak launches, and sunset dining over Lake Kivu.',
          district: 'Karongi',
          province: 'Western',
          address: 'Bwishyura Waterfront, Karongi',
          latitude: -2.055,
          longitude: 29.342,
          contactPhone: '+250 788 412 900',
          contactEmail: 'hello@karongiwaterfront.rw',
          externalBookingUrl: 'https://www.visitrwanda.com/tourism/',
          verifiedPriceRange: '$145 – $260 / night',
          facilities: ['Private Jetty', 'Kayak Rental', 'Lakeside Terrace', 'High-Speed Wi-Fi'],
          rating: 4.7,
          imageUrl: IMG_KIVU,
        },
        {
          slug: 'akagera-savannah-tented-camp',
          destinationId: destBySlug['akagera-national-park'].id,
          name: 'Ruzizi & Ihema Safari Camp',
          accommodationType: 'campsite',
          description: 'Solar-powered eco-tented camp raised on timber decks beside Lake Ihema inside Akagera National Park.',
          district: 'Kayonza',
          province: 'Eastern',
          address: 'Lake Ihema Shore, Akagera National Park',
          latitude: -1.894,
          longitude: 30.725,
          contactPhone: '+250 786 182 875',
          contactEmail: 'camp@akagerasafari.rw',
          externalBookingUrl: 'https://www.africanparks.org/',
          verifiedPriceRange: '$190 – $340 / night',
          facilities: ['Elevated Tent Decks', 'Solar Power', 'Campfire Lounge', 'Game Drive Dispatch'],
          rating: 4.8,
          imageUrl: IMG_AKAGERA,
        },
        {
          slug: 'kigali-kiyovu-residences',
          destinationId: destBySlug['kigali-genocide-memorial'].id,
          name: 'Kiyovu Ridge Serviced Apartments',
          accommodationType: 'apartment',
          description: 'Quiet contemporary serviced apartments in tree-lined Kiyovu, 18 minutes from Kigali International Airport.',
          district: 'Nyarugenge',
          province: 'Kigali City',
          address: 'KN 14 Ave, Kiyovu, Kigali',
          latitude: -1.953,
          longitude: 30.061,
          contactPhone: '+250 788 601 330',
          contactEmail: 'stay@kiyovuresidences.rw',
          externalBookingUrl: 'https://www.visitrwanda.com/tourism/',
          verifiedPriceRange: '$110 – $185 / night',
          facilities: ['Full Kitchen', 'Workspace Desk', '24h Security', 'Airport Shuttle'],
          rating: 4.6,
          imageUrl: IMG_KIGALI,
        },
        {
          slug: 'musanze-highland-guesthouse',
          destinationId: destBySlug['gorilla-guardians-cultural-village'].id,
          name: 'Amahoro Musanze Guesthouse',
          accommodationType: 'guesthouse',
          description: 'Warm, locally hosted guesthouse offering freshly brewed Rwandan bourbon coffee and volcano terrace views.',
          district: 'Musanze',
          province: 'Northern',
          address: 'Muhoza Sector, Musanze Town',
          latitude: -1.499,
          longitude: 29.634,
          contactPhone: '+250 788 552 800',
          contactEmail: 'welcome@amahoromusanzeguest.rw',
          externalBookingUrl: 'https://www.visitrwanda.com/tourism/',
          verifiedPriceRange: '$65 – $115 / night',
          facilities: ['Breakfast Included', 'Garden Courtyard', 'Bicycle Storage', 'Local Guide Desk'],
          rating: 4.5,
          imageUrl: IMG_LODGE,
        },
      ];

      const insertedAccoms = await db
        .insert(accommodations)
        .values(accomSeed.map(({ imageUrl: _img, ...rest }) => rest))
        .returning();

      await db.insert(accommodationImages).values(
        insertedAccoms.map((a, idx) => ({
          accommodationId: a.id,
          imageUrl: accomSeed[idx].imageUrl,
          caption: a.name,
          isPrimary: true,
        }))
      );

      // 5. Tourism Providers (3 verified + 1 pending verification)
      const insertedProviders = await db
        .insert(tourismProviders)
        .values([
          {
            userId: providerOwnerId,
            businessName: 'Virunga Horizons Expeditions',
            providerType: 'tour_operator',
            licenseNumber: 'RDB-TO-2024-084',
            description:
              'Licensed Rwandan eco-tour operator specializing in gorilla permit logistics, private 4x4 circuits, and conservation storytelling.',
            destinationCoverage: ['Volcanoes National Park', 'Nyungwe National Park', 'Lake Kivu'],
            contactEmail: 'dispatch@virungahorizons.rw',
            contactPhone: '+250 788 340 112',
            websiteUrl: 'https://www.visitrwanda.com',
            district: 'Gasabo, Kigali',
            verificationStatus: 'verified',
            verifiedAt: new Date(),
          },
          {
            userId: null,
            businessName: 'Nyungwe & Kivu Naturalist Guides',
            providerType: 'tour_guide',
            licenseNumber: 'RDB-TG-2023-419',
            description:
              'Certified ornithologist and primate naturalist guides leading multi-day birding and Congo Nile Trail expeditions.',
            destinationCoverage: ['Nyungwe National Park & Canopy Walkway', 'Kamiranzovu Waterfall & Marsh Trail', 'Congo Nile Trail'],
            contactEmail: 'guides@nyungwenaturalists.rw',
            contactPhone: '+250 788 492 710',
            websiteUrl: 'https://www.visitrwanda.com',
            district: 'Nyamagabe',
            verificationStatus: 'verified',
            verifiedAt: new Date(),
          },
          {
            userId: null,
            businessName: 'East Savannah Safari Transfers',
            providerType: 'transport_partner',
            licenseNumber: 'RDB-TR-2025-118',
            description:
              'Pop-top Land Cruiser safari fleet serving Kigali International Airport, Akagera game circuits, and cross-country lodge transfers.',
            destinationCoverage: ['Akagera National Park', 'Kigali Genocide Memorial', "King's Palace Museum (Nyanza)"],
            contactEmail: 'fleet@eastsavannah.rw',
            contactPhone: '+250 788 710 554',
            websiteUrl: 'https://www.visitrwanda.com',
            district: 'Kayonza',
            verificationStatus: 'verified',
            verifiedAt: new Date(),
          },
          {
            userId: null,
            businessName: 'Kivu Kayak & Ridge Adventures',
            providerType: 'tour_operator',
            licenseNumber: 'RDB-TO-2026-019',
            description:
              'Small-group sea kayaking and gravel cycling outfit operating between Rubavu, Kinunu coffee farms, and Karongi.',
            destinationCoverage: ['Lake Kivu Shores (Karongi & Rubavu)', 'Congo Nile Trail'],
            contactEmail: 'info@kivukayak.rw',
            contactPhone: '+250 788 891 204',
            websiteUrl: 'https://www.visitrwanda.com',
            district: 'Rubavu',
            verificationStatus: 'pending',
          },
        ])
        .returning();

      await db.insert(providerServices).values([
        {
          providerId: insertedProviders[0].id,
          title: 'Private 4x4 Land Cruiser & Driver-Guide',
          category: 'Safari Transport',
          description: 'Full-day air-conditioned safari vehicle with bilingual naturalist driver and chilled drinking water.',
          priceEstimate: '$220 / day',
          durationText: 'Full Day',
        },
        {
          providerId: insertedProviders[1].id,
          title: 'Nyungwe Endemic Birding & Orchid Walk',
          category: 'Specialist Guiding',
          description: 'Dawn departure focusing on Albertine Rift endemic birds and canopy botany.',
          priceEstimate: '$95 / group',
          durationText: '5 Hours',
        },
        {
          providerId: insertedProviders[2].id,
          title: 'Kigali Airport (KGL) Direct Regional Transfer',
          category: 'Airport Transfer',
          description: 'Meet-and-greet at Kigali International Airport with direct transfer to Musanze, Lake Kivu, or Akagera.',
          priceEstimate: '$140 / transfer',
          durationText: '2.5 – 4 Hours',
        },
      ]);

      await db.insert(travelPackages).values([
        {
          providerId: insertedProviders[0].id,
          destinationId: destBySlug['volcanoes-national-park'].id,
          title: '4-Day Virunga Gorillas & Twin Lakes Expedition',
          summary: 'Private circuit from Kigali to Musanze featuring gorilla tracking, golden monkeys, and cultural village immersion.',
          durationDays: 4,
          priceUsd: 2450,
          inclusions: ['4x4 Safari Vehicle', 'English/French Naturalist Guide', '3 Nights Eco-Lodge', 'Kinigi Transfers'],
          maxGroupSize: 6,
          isActive: true,
        },
        {
          providerId: insertedProviders[1].id,
          destinationId: destBySlug['nyungwe-canopy-walkway'].id,
          title: '3-Day Nyungwe Canopy & Lake Kivu Retreat',
          summary: 'Combine chimpanzee tracking and the Nyungwe suspension bridge with a relaxed Karongi boat cruise.',
          durationDays: 3,
          priceUsd: 980,
          inclusions: ['Guided Canopy Walk', 'Chimpanzee Trail Support', 'Boat Transfer on Lake Kivu'],
          maxGroupSize: 8,
          isActive: true,
        },
        {
          providerId: insertedProviders[2].id,
          destinationId: destBySlug['akagera-national-park'].id,
          title: '2-Day Akagera Big Five & Lake Ihema Safari',
          summary: 'Early departure from Kigali for southern savannah game drives, sunset boat safari, and northern plains circuit.',
          durationDays: 2,
          priceUsd: 640,
          inclusions: ['Pop-Top Safari Cruiser', 'Overnight Camp Transfer', 'Park Guide'],
          maxGroupSize: 6,
          isActive: true,
        },
      ]);

      // 6. Recommended Public Itineraries
      const insertedItins = await db
        .insert(itineraries)
        .values([
          {
            userId: curatorId,
            shareCode: 'rw-primates-5d',
            title: '5-Day Rwanda Primates, Canopy & Lake Kivu Circuit',
            description:
              'Rwanda’s signature western conservation loop connecting Kigali heritage, Nyungwe rainforest canopy, Lake Kivu shores, and Volcanoes National Park.',
            startDate: '2026-07-10',
            endDate: '2026-07-14',
            travelMode: 'driving',
            totalDistanceKm: 486,
            estimatedDurationMin: 615,
            isPublic: true,
          },
          {
            userId: curatorId,
            shareCode: 'rw-savannah-3d',
            title: '3-Day Kigali Culture & Akagera Big Five Escape',
            description:
              'Compact eastern itinerary pairing Kigali memorial and museum sites with full-day Big Five game drives in Akagera.',
            startDate: '2026-08-04',
            endDate: '2026-08-06',
            travelMode: 'driving',
            totalDistanceKm: 235,
            estimatedDurationMin: 290,
            isPublic: true,
          },
        ])
        .returning();

      const itin1Days = await db
        .insert(itineraryDays)
        .values([
          { itineraryId: insertedItins[0].id, dayNumber: 1, dateLabel: 'Day 1 · Kigali & Southern Heritage', notes: 'Morning memorial visit followed by scenic drive south.' },
          { itineraryId: insertedItins[0].id, dayNumber: 2, dateLabel: 'Day 2 · Nyungwe Rainforest', notes: 'Early canopy walk and waterfall hike.' },
          { itineraryId: insertedItins[0].id, dayNumber: 3, dateLabel: 'Day 3 · Lake Kivu Shores', notes: 'Drive north along Lake Kivu ridge to Karongi.' },
          { itineraryId: insertedItins[0].id, dayNumber: 4, dateLabel: 'Day 4 · Volcanoes National Park', notes: 'Morning primate tracking at Kinigi.' },
        ])
        .returning();

      await db.insert(itineraryDestinations).values([
        { itineraryDayId: itin1Days[0].id, destinationId: destBySlug['kigali-genocide-memorial'].id, sortOrder: 1, visitDurationMin: 120, notes: 'Opening reflection' },
        { itineraryDayId: itin1Days[0].id, destinationId: destBySlug['kings-palace-museum-nyanza'].id, sortOrder: 2, visitDurationMin: 90, notes: 'Royal heritage stop en route' },
        { itineraryDayId: itin1Days[1].id, destinationId: destBySlug['nyungwe-canopy-walkway'].id, sortOrder: 1, visitDurationMin: 210, notes: '08:00 Canopy departure' },
        { itineraryDayId: itin1Days[2].id, destinationId: destBySlug['lake-kivu-karongi-rubavu'].id, sortOrder: 1, visitDurationMin: 240, notes: 'Sunset kayak & Napoleon Island' },
        { itineraryDayId: itin1Days[3].id, destinationId: destBySlug['volcanoes-national-park'].id, sortOrder: 1, visitDurationMin: 300, notes: '07:00 Kinigi ranger briefing' },
      ]);

      const itin2Days = await db
        .insert(itineraryDays)
        .values([
          { itineraryId: insertedItins[1].id, dayNumber: 1, dateLabel: 'Day 1 · Kigali History', notes: 'Explore Gisozi and Kigali cultural quarters.' },
          { itineraryId: insertedItins[1].id, dayNumber: 2, dateLabel: 'Day 2 · Akagera Savannah', notes: 'Full-day game drive from south gate to Lake Ihema.' },
        ])
        .returning();

      await db.insert(itineraryDestinations).values([
        { itineraryDayId: itin2Days[0].id, destinationId: destBySlug['kigali-genocide-memorial'].id, sortOrder: 1, visitDurationMin: 120 },
        { itineraryDayId: itin2Days[1].id, destinationId: destBySlug['akagera-national-park'].id, sortOrder: 1, visitDurationMin: 360 },
      ]);

      // 7. Authentic Traveler Reviews
      const insertedReviews = await db
        .insert(reviews)
        .values([
          {
            userId: travelerId,
            destinationId: destBySlug['volcanoes-national-park'].id,
            rating: 5,
            title: 'Unforgettable hour with the Sabyinyo family',
            comment:
              'Our Kinigi rangers briefed us thoroughly before a two-hour climb through misty bamboo groves. Spending an hour observing the silverback and juveniles in complete quiet was transformative.',
            visitDate: '2026-09-14',
            moderationStatus: 'approved',
          },
          {
            userId: curatorId,
            destinationId: destBySlug['nyungwe-canopy-walkway'].id,
            rating: 5,
            title: 'Morning mist above ancient tree ferns',
            comment:
              'Crossing the suspension walkway at 08:30 while colobus monkeys moved through the canopy below was extraordinary. Bring a light waterproof shell even in dry season.',
            visitDate: '2026-08-22',
            moderationStatus: 'approved',
          },
          {
            userId: travelerId,
            destinationId: destBySlug['akagera-national-park'].id,
            rating: 5,
            title: 'Remarkable conservation comeback',
            comment:
              'Saw giraffes, elephants, and a pride of lions near the northern plains before taking the peaceful afternoon boat cruise on Lake Ihema.',
            visitDate: '2026-09-18',
            moderationStatus: 'approved',
          },
          {
            userId: travelerId,
            destinationId: destBySlug['lake-kivu-karongi-rubavu'].id,
            rating: 4,
            title: 'Calm waters and terraced coffee hills',
            comment:
              'Karongi is deeply restorative after trekking. Sunset kayaking out toward Peace Island and hearing the fishermen sing at dusk was a highlight of our trip.',
            visitDate: '2026-09-20',
            moderationStatus: 'approved',
          },
        ])
        .returning();

      // 8. Seed 1 moderation report & platform settings
      await db.insert(reports).values({
        reporterId: curatorId,
        targetType: 'review',
        targetId: insertedReviews[3].id,
        reason: 'Verify visit date accuracy',
        details: 'Routine editorial verification check on Lake Kivu seasonal guidance.',
        status: 'open',
      });

      await db.insert(notifications).values({
        userId: curatorId,
        title: 'New Tourism Provider Application',
        message: 'Kivu Kayak & Ridge Adventures submitted RDB license documentation for verification.',
        category: 'moderation',
        isRead: false,
        linkUrl: '/admin',
      });

      await db.insert(platformSettings).values([
        {
          key: 'platform_notice',
          value: 'Permits for Volcanoes & Nyungwe National Parks must be reserved ahead of arrival.',
          description: 'Advisory banner text shown in Travel Planner',
        },
        {
          key: 'default_currency',
          value: 'USD / RWF',
          description: 'Primary display currencies across verified lodges and packages',
        },
        {
          key: 'emergency_tourism_helpline',
          value: '+250 788 311 000',
          description: 'Rwanda Development Board Visitor Assistance Line',
        },
      ]);

      hasCheckedSeed = true;
      console.log('Rwanda Tourism Explorer seed completed.');
    } catch (err) {
      seedPromise = null;
      throw err;
    }
  })();

  return seedPromise;
}
