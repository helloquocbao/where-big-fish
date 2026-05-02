# 🔧 Tech Stack & Architecture

## Frontend Framework: Next.js 14+ (App Router)

### Tại sao Next.js?

- **SSG (Static Site Generation)**: Pre-render HTML tại build time → SEO tuyệt vời
- **App Router**: File-based routing, layouts, loading states
- **`next export`**: Export thành static HTML, deploy anywhere
- **Image Optimization**: `next/image` hỗ trợ lazy loading, fallback
- **Free Hosting**: Vercel cho Next.js miễn phí

### Config cần thiết

```js
// next.config.js
const nextConfig = {
  output: 'export', // Static export
  trailingSlash: true, // SEO friendly URLs
  images: {
    unoptimized: true, // Vì dùng hotlink images
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // Cho phép mọi domain
    ],
  },
};
```

---

## Styling: Vanilla CSS

### Design System (CSS Variables)

```css
/* styles/globals.css */
:root {
  /* Colors - Ocean Theme */
  --bg-primary: #0a1628;
  --bg-secondary: #0f2035;
  --bg-card: #152a45;
  --bg-card-hover: #1a3555;
  --text-primary: #e8f4f8;
  --text-secondary: #8ba4b8;
  --accent-teal: #00bfa6;
  --accent-coral: #ff6b6b;
  --accent-gold: #ffd700;
  --accent-blue: #4a9eff;
  --border-color: rgba(255, 255, 255, 0.08);

  /* Typography */
  --font-heading: 'Outfit', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;

  /* Border Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;

  /* Shadows */
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.3);
  --shadow-hover: 0 8px 32px rgba(0, 191, 166, 0.15);

  /* Container */
  --max-width: 1200px;
  --content-width: 800px;
}

/* Light mode override */
[data-theme='light'] {
  --bg-primary: #f0f6fa;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --bg-card-hover: #f8fafb;
  --text-primary: #1a2a3a;
  --text-secondary: #5a6a7a;
  --border-color: rgba(0, 0, 0, 0.08);
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.06);
}
```

### Google Fonts

```html
<link
  href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

---

## Data Layer: JSON Files

### Cấu trúc thư mục data

```
src/data/
├── locations/
│   ├── index.json          # Danh sách tất cả locations (summary)
│   ├── freshwater.json     # Filtered by water type
│   ├── brackish.json
│   ├── saltwater.json
│   └── details/
│       ├── mekong-giant-catfish-tonle-sap.json
│       ├── great-white-shark-guadalupe.json
│       └── ... (mỗi location 1 file)
├── species/
│   ├── index.json          # Danh sách tất cả species
│   └── details/
│       ├── mekong-giant-catfish.json
│       └── ...
├── regions/
│   ├── continents.json
│   └── countries.json
└── meta/
    ├── tags.json
    └── categories.json
```

### Data loading pattern

```typescript
// lib/data.ts
import fs from 'fs';
import path from 'path';

export function getLocations() {
  const filePath = path.join(process.cwd(), 'src/data/locations/index.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getLocationBySlug(slug: string) {
  const filePath = path.join(process.cwd(), `src/data/locations/details/${slug}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getAllLocationSlugs() {
  const dir = path.join(process.cwd(), 'src/data/locations/details');
  return fs.readdirSync(dir).map((f) => f.replace('.json', ''));
}
```

---

## Maps: Google Maps Embed (iframe)

### Cách sử dụng - KHÔNG cần API key

```html
<!-- Embed bằng coordinates -->
<iframe
  src="https://maps.google.com/maps?q=12.8333,104.0833&z=10&output=embed"
  width="100%"
  height="400"
  style="border:0; border-radius: 12px;"
  allowfullscreen
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
>
</iframe>
```

### React Component

```tsx
// components/MapEmbed.tsx
export default function MapEmbed({ lat, lng, zoom = 10, title }) {
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
  return (
    <div className="map-container">
      <iframe
        src={src}
        width="100%"
        height="400"
        style={{ border: 0, borderRadius: '12px' }}
        allowFullScreen
        loading="lazy"
        title={`Map of ${title}`}
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
```

---

## Search: Fuse.js (Client-side)

```bash
npm install fuse.js
```

```typescript
// lib/search.ts
import Fuse from 'fuse.js';

const options = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'species.commonName', weight: 0.3 },
    { name: 'location.country', weight: 0.2 },
    { name: 'tags', weight: 0.1 },
  ],
  threshold: 0.3,
  includeScore: true,
};

export function createSearchIndex(locations) {
  return new Fuse(locations, options);
}
```

---

## Hosting: Vercel (Free Tier)

### Limits miễn phí

- 100 GB bandwidth/month
- Unlimited static pages
- Auto SSL
- Global CDN
- GitHub auto-deploy

### Deploy flow

```
GitHub Push → Vercel Auto Build → `next build && next export` → Deploy to CDN
```

---

## Ads: Google AdSense

### Placement strategy

```
[Header Ad - Leaderboard 728x90]
[Hero Section]
[Content]
[In-Article Ad - Rectangle 300x250]  ← Sau 2 paragraphs
[More Content]
[In-Article Ad - Rectangle 300x250]  ← Trước Related Posts
[Related Posts]
[Footer Ad - Leaderboard 728x90]
[Sidebar Ad - Skyscraper 160x600]    ← Trên Desktop
```

### Component

```tsx
// components/AdUnit.tsx
export default function AdUnit({ slot, format = 'auto' }) {
  return (
    <div className="ad-container">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}
```
