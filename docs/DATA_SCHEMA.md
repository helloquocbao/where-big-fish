# 📊 Data Schema Specification

## 1. Location Schema (Main Entity)

Mỗi location là 1 file JSON riêng trong `src/data/locations/details/`.

```typescript
interface Location {
  // === Identification ===
  id: string; // unique ID: "mekong-giant-catfish-tonle-sap"
  slug: string; // URL slug: "mekong-giant-catfish-tonle-sap-cambodia"

  // === Species Info ===
  species: {
    commonName: string; // "Mekong Giant Catfish"
    scientificName: string; // "Pangasianodon gigas"
    maxWeight: string; // "300 kg" - formatted string
    maxWeightKg: number; // 300 - numeric for sorting
    maxLength: string; // "3 m"
    maxLengthCm: number; // 300
    category: WaterType; // "freshwater" | "brackish" | "saltwater"
    conservationStatus?: string; // "Critically Endangered", "Least Concern", etc.
    speciesSlug: string; // Link to species detail: "mekong-giant-catfish"
  };

  // === Location Info ===
  location: {
    name: string; // "Tonle Sap Lake"
    country: string; // "Cambodia"
    countryCode: string; // "KH" (ISO 3166-1 alpha-2)
    region: string; // "Southeast Asia"
    continent: Continent; // "Asia"
    lat: number; // 12.8333
    lng: number; // 104.0833
    waterType: WaterType;
    waterBody: string; // "Lake" | "River" | "Ocean" | "Sea" | "Estuary"
  };

  // === Fishing Regulations ===
  fishing: {
    isAllowed: boolean | null; // true = allowed, false = prohibited, null = unknown
    permitRequired: boolean; // true = need fishing license/permit
    permitInfo?: string; // "Buy at local fishing office - $20/day"
    catchAndRelease: boolean; // true = must release
    season?: string; // "May - October" or null if year-round
    closedSeason?: string; // "November - April" spawn season
    regulations: string; // Full text about regulations
    regulationSource?: string; // URL to official regulation page
  };

  // === Content ===
  content: {
    title: string; // SEO title: "Giant Catfish Fishing at Tonle Sap, Cambodia"
    metaDescription: string; // 155 chars max for SEO
    description: string; // Main article body (markdown supported)
    highlights: string[]; // Key facts as bullet points
    bestTime: string; // "May - October (wet season)"
    difficulty: Difficulty; // "Easy" | "Medium" | "Hard" | "Extreme"
    averageCatchSize?: string; // "50-100 kg typically"
    recordCatch?: {
      weight: string;
      angler?: string;
      date?: string;
      source?: string;
    };
  };

  // === Media ===
  media: {
    heroImage: string; // Primary image URL (hotlinked)
    heroImageAlt: string; // Alt text for SEO
    gallery: Array<{
      url: string;
      alt: string;
      credit: string;
    }>;
    imageCredits: string; // "Photo: IGFA / National Geographic"
  };

  // === Sources & Attribution ===
  sources: Array<{
    name: string; // "International Game Fish Association"
    url: string; // "https://igfa.org/..."
    accessedDate: string; // "2026-05-01"
  }>;

  // === Metadata ===
  tags: string[]; // ["giant", "endangered", "freshwater", "asia"]
  publishedAt: string; // ISO date
  updatedAt: string; // ISO date
  featured: boolean; // Show on homepage
  priority: number; // 1-10, for sorting featured items
}

type WaterType = 'freshwater' | 'brackish' | 'saltwater';
type Continent =
  | 'Asia'
  | 'Africa'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania'
  | 'Antarctica';
type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Extreme';
```

---

## 2. Species Schema

File: `src/data/species/details/[slug].json`

```typescript
interface Species {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string;
  family: string; // "Pangasiidae"
  order: string; // "Siluriformes"

  maxWeight: string;
  maxWeightKg: number;
  maxLength: string;
  maxLengthCm: number;

  waterType: WaterType;
  habitat: string; // "Large rivers and lakes"
  distribution: string; // "Mekong River basin"

  conservationStatus: string; // IUCN status
  conservationNotes: string;

  description: string; // Markdown content
  funFacts: string[];

  image: string; // Hotlinked URL
  imageAlt: string;
  imageCredit: string;

  // Locations where this species can be found
  locationSlugs: string[]; // Links to location details

  sources: Array<{ name: string; url: string }>;
  tags: string[];
}
```

---

## 3. Location Index Schema (Summary)

File: `src/data/locations/index.json` — dùng cho listing pages, search, filtering.

```typescript
interface LocationSummary {
  slug: string;
  title: string;
  speciesName: string;
  country: string;
  continent: string;
  waterType: WaterType;
  maxWeightKg: number;
  isAllowed: boolean | null;
  heroImage: string;
  heroImageAlt: string;
  difficulty: Difficulty;
  featured: boolean;
  tags: string[];
}
```

---

## 4. Validation Rules

### Required Fields (MUST NOT be empty)

- `id`, `slug`, `species.commonName`, `location.name`, `location.country`
- `location.lat`, `location.lng` (valid coordinates)
- `content.title`, `content.description` (min 200 chars)
- `sources` (at least 1 source)
- `media.heroImage` (valid URL)

### Format Rules

- `slug`: lowercase, hyphens only, no special chars: `/^[a-z0-9-]+$/`
- `lat`: -90 to 90
- `lng`: -180 to 180
- `countryCode`: exactly 2 uppercase letters
- `publishedAt`, `updatedAt`: ISO 8601 format `YYYY-MM-DD`
- URLs: must start with `https://`
- `metaDescription`: max 155 characters

### Data Quality Rules

- No duplicate `id` or `slug`
- `speciesSlug` must reference an existing species file
- `maxWeightKg` must be > 0
- At least 2 items in `highlights` array
- At least 1 image in gallery
- Description must be > 200 characters (for SEO)
