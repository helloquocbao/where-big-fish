# 🔎 SEO Strategy

## 1. On-Page SEO

### Title Tag Format

```
{Species Name} at {Location}, {Country} — Where Big Fish
```

- Trang chủ: `Where Big Fish — Discover Giant Fish Locations Worldwide`
- Category: `Best Freshwater Big Fish Locations | Where Big Fish`
- Species: `{Species Name} — Size, Habitat & Fishing Spots | Where Big Fish`

### Meta Description Format (max 155 chars)

```
Discover {Species Name} at {Location}, {Country}. Max weight: {weight}.
Fishing {allowed/prohibited}. Complete guide with map, regulations & photos.
```

### Heading Structure

```html
<h1>Mekong Giant Catfish at Tonle Sap, Cambodia</h1>
<h2>About This Location</h2>
<h2>Species Information</h2>
<h2>Fishing Regulations</h2>
<h2>Best Time to Visit</h2>
<h2>How to Get There</h2>
<h2>Photo Gallery</h2>
<h2>Related Locations</h2>
<h2>Sources</h2>
```

---

## 2. Structured Data (JSON-LD)

### Article Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Mekong Giant Catfish at Tonle Sap, Cambodia",
  "description": "...",
  "image": "https://...",
  "author": { "@type": "Organization", "name": "Where Big Fish" },
  "publisher": {
    "@type": "Organization",
    "name": "Where Big Fish",
    "logo": { "@type": "ImageObject", "url": "https://wherebigfish.com/logo.png" }
  },
  "datePublished": "2026-05-01",
  "dateModified": "2026-05-01"
}
```

### Place Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "Tonle Sap Lake",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 12.8333,
    "longitude": 104.0833
  },
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "KH"
  }
}
```

### FAQPage Schema (for common questions)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can you fish for Mekong Giant Catfish?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, fishing for Mekong Giant Catfish is prohibited..."
      }
    }
  ]
}
```

---

## 3. Technical SEO

### Sitemap Generation

```typescript
// scripts/generate-sitemap.ts
// Auto-generate from all location & species slugs
// Output: public/sitemap.xml
// Include: lastmod, changefreq, priority
```

### robots.txt

```
User-agent: *
Allow: /
Sitemap: https://wherebigfish.com/sitemap.xml

# Block scraper/internal paths
Disallow: /api/
Disallow: /_next/
```

### Canonical URLs

```html
<link
  rel="canonical"
  href="https://wherebigfish.com/location/mekong-giant-catfish-tonle-sap-cambodia/"
/>
```

### Open Graph Tags

```html
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="..." />
<meta property="og:type" content="article" />
<meta property="og:url" content="..." />
<meta property="og:site_name" content="Where Big Fish" />
```

### Twitter Cards

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="..." />
```

---

## 4. Content SEO Strategy

### Target Keywords Per Page Type

| Page Type  | Primary Keywords                             | Long-tail Keywords                      |
| ---------- | -------------------------------------------- | --------------------------------------- |
| Homepage   | big fish locations, giant fish spots         | where to find big fish worldwide        |
| Freshwater | freshwater big fish, largest freshwater fish | biggest freshwater fish locations       |
| Location   | {species} {location} fishing                 | can you fish for {species} in {country} |
| Species    | {species name} size weight                   | how big does {species} get              |

### Internal Linking Strategy

- Each location page links to:
  - Species detail page
  - Country page
  - Continent page
  - 3 related locations (same water type or region)
- Each species page links to all locations where it's found
- Category pages link to all locations in that category

### URL Structure (SEO-friendly)

```
/location/mekong-giant-catfish-tonle-sap-cambodia/
/species/mekong-giant-catfish/
/freshwater/
/continent/asia/
/country/cambodia/
```

---

## 5. Performance Optimization

- **Images**: `loading="lazy"`, `decoding="async"`
- **Fonts**: `display=swap`, preconnect to Google Fonts
- **CSS**: Critical CSS inline, rest async loaded
- **Target**: Lighthouse 90+ on all metrics
