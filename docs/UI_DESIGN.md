# 🎨 UI Design Specification

## Design Philosophy

- **Ocean-inspired dark theme** với glassmorphism effects
- **Rich micro-animations** cho hover states và transitions
- **Mobile-first responsive** design
- **Premium feel** — phải WOW user ngay cái nhìn đầu tiên

---

## Component Specifications

### 1. Header / Navigation

```
┌──────────────────────────────────────────────────────────┐
│ 🐟 WhereBigFish    [Freshwater] [Saltwater] [Brackish]  │
│                     [Explore] [Species]   🔍  🌙/☀️      │
└──────────────────────────────────────────────────────────┘
```

**Specs:**

- Sticky header with `backdrop-filter: blur(12px)` glassmorphism
- Background: `rgba(10, 22, 40, 0.85)`
- Logo: Custom fish icon + "WhereBigFish" text
- Navigation: horizontal links, highlight active page
- Search icon → expand search bar on click (animation)
- Dark/Light mode toggle (sun/moon icon)
- Mobile: hamburger menu → slide-in sidebar

**CSS:**

```css
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(10, 22, 40, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.3s ease;
}
```

---

### 2. Hero Section (Homepage)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│          🐟 WHERE BIG FISH                               │
│          Discover Giant Fish Locations Worldwide          │
│                                                          │
│     [🔍 Search fish or location...                    ]  │
│                                                          │
│     [Explore Freshwater]  [Explore Saltwater]            │
│                                                          │
│     ── background: animated gradient ocean ──            │
└──────────────────────────────────────────────────────────┘
```

**Specs:**

- Full viewport height on desktop, 70vh on mobile
- Animated gradient background (deep ocean colors shifting)
- Floating fish particle animation (subtle CSS)
- Large heading: Outfit font, 800 weight, gradient text
- Subheading: Inter font, 400 weight, lighter color
- Search bar: centered, large, rounded, with glass effect
- CTA buttons: gradient background, hover scale effect

**CSS Animation:**

```css
.hero {
  background: linear-gradient(-45deg, #0a1628, #0f2035, #1a3a5c, #0d2847);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.hero-title {
  font-family: var(--font-heading);
  font-weight: 800;
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  background: linear-gradient(135deg, #00bfa6, #4a9eff, #00bfa6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

### 3. Category Cards (3 cards)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   🏞️ Image   │  │   🌊 Image   │  │   🌿 Image   │
│              │  │              │  │              │
│  FRESHWATER  │  │  SALTWATER   │  │  BRACKISH    │
│  XX spots    │  │  XX spots    │  │  XX spots    │
│  [Explore →] │  │  [Explore →] │  │  [Explore →] │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Specs:**

- 3 column grid on desktop, 1 column on mobile
- Card: rounded corners (16px), subtle border
- Background image with dark overlay gradient
- Hover: scale(1.03), shadow increase, overlay lighten
- Counter: animated number counting up
- Transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1)

---

### 4. Location Card (Grid Item)

```
┌──────────────────────┐
│  ┌──────────────────┐ │
│  │   Hero Image     │ │
│  │                  │ │
│  │  [🟢 Allowed]    │ │
│  └──────────────────┘ │
│  🐟 Mekong Giant      │
│     Catfish            │
│  📍 Cambodia           │
│  ⚖️ Max: 300 kg       │
│  💧 Freshwater         │
│  ⭐ Extreme            │
│  ────────────────────  │
│  [Read More →]         │
└──────────────────────┘
```

**Specs:**

- Grid: `repeat(auto-fill, minmax(320px, 1fr))`
- Card background: `var(--bg-card)` with border
- Image: `aspect-ratio: 16/9`, `object-fit: cover`
- Fishing status badge: Green (allowed) / Red (prohibited) / Yellow (permit needed)
- Hover: translateY(-8px), shadow glow with teal accent
- Tags: small pills at bottom

---

### 5. Location Detail Page Layout

```
┌──────────────────────────────────────────────────────────┐
│  [Hero Image - Full Width]                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Breadcrumb: Home > Freshwater > Cambodia > ...     │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────┬───────────────────────────┤
│                              │  ┌─ Species Info Box ──┐  │
│  # Title                     │  │ 🐟 Mekong Giant     │  │
│                              │  │ Scientific: P.gigas │  │
│  ## Description              │  │ Max: 300 kg / 3m    │  │
│  Lorem ipsum content...      │  │ Status: Endangered  │  │
│                              │  │ Difficulty: Extreme  │  │
│  [Ad Unit - In Article]      │  └────────────────────┘  │
│                              │                           │
│  ## Highlights               │  ┌─ Fishing Rules ────┐  │
│  • Bullet point 1            │  │ ❌ NOT Allowed      │  │
│  • Bullet point 2            │  │ Protected species   │  │
│                              │  │ CITES Appendix I    │  │
│  ## Map                      │  └────────────────────┘  │
│  ┌──────────────────────┐    │                           │
│  │  Google Maps iFrame  │    │  [Ad Unit - Sidebar]     │
│  │                      │    │                           │
│  └──────────────────────┘    │                           │
│                              │                           │
│  ## Gallery                  │                           │
│  [img1] [img2] [img3]        │                           │
│                              │                           │
│  ## Sources                  │                           │
│  📰 IGFA - link              │                           │
│  📰 Wikipedia - link         │                           │
├──────────────────────────────┴───────────────────────────┤
│  [Related Locations - 3 cards horizontally]              │
│  [Ad Unit - Footer]                                      │
└──────────────────────────────────────────────────────────┘
```

**Layout:** 2 column on desktop (content: 65%, sidebar: 35%), single column on mobile (sidebar stacks below hero).

---

### 6. Fishing Status Badge Component

```tsx
// Three states with colors
✅ Fishing Allowed     → background: rgba(0, 191, 166, 0.15), color: #00bfa6
❌ Fishing Prohibited  → background: rgba(255, 107, 107, 0.15), color: #ff6b6b
⚠️ Permit Required     → background: rgba(255, 215, 0, 0.15), color: #ffd700
❓ Status Unknown      → background: rgba(139, 164, 184, 0.15), color: #8ba4b8
```

---

### 7. Search Modal

```
┌──────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔍 Search fish species or location...              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Recent Searches: [Catfish] [Amazon] [Shark]             │
│                                                          │
│  ┌─ Result ──────────────────────────────────────────┐  │
│  │ 🐟 Mekong Giant Catfish • Cambodia • Freshwater   │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ 🐟 Blue Catfish • Missouri River • Freshwater     │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ 🐟 Wels Catfish • Ebro River, Spain • Freshwater  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Specs:**

- Full screen overlay with blur background
- Keyboard shortcut: Cmd+K / Ctrl+K
- Real-time fuzzy search (Fuse.js)
- Results appear as you type (debounced 300ms)
- Navigate results with arrow keys

---

### 8. Filter Sidebar (Explore Page)

```
┌─ Filters ─────────────┐
│                        │
│ Water Type             │
│ ☑ Freshwater           │
│ ☑ Saltwater            │
│ ☑ Brackish             │
│                        │
│ Continent              │
│ ☐ Asia                 │
│ ☐ Africa               │
│ ☐ Europe               │
│ ☐ N. America           │
│ ☐ S. America           │
│ ☐ Oceania              │
│                        │
│ Fishing Status         │
│ ○ All                  │
│ ○ Allowed              │
│ ○ Prohibited           │
│ ○ Permit Required      │
│                        │
│ Difficulty             │
│ ○ All                  │
│ ○ Easy                 │
│ ○ Medium               │
│ ○ Hard                 │
│ ○ Extreme              │
│                        │
│ Sort By                │
│ [Max Weight ▼]         │
│                        │
│ [Clear Filters]        │
└────────────────────────┘
```

---

## Responsive Breakpoints

```css
/* Mobile first */
@media (min-width: 640px) {
  /* sm - Tablet portrait */
}
@media (min-width: 768px) {
  /* md - Tablet landscape */
}
@media (min-width: 1024px) {
  /* lg - Desktop */
}
@media (min-width: 1280px) {
  /* xl - Large desktop */
}
```

---

## Animation Guidelines

| Element             | Animation          | Duration | Easing                    |
| ------------------- | ------------------ | -------- | ------------------------- |
| Page load           | Fade in + slide up | 0.6s     | ease-out                  |
| Card hover          | Scale + shadow     | 0.3s     | cubic-bezier(0.4,0,0.2,1) |
| Card enter viewport | Fade in + slide up | 0.5s     | ease-out                  |
| Search open         | Scale from center  | 0.2s     | ease-out                  |
| Filter toggle       | Slide down         | 0.3s     | ease                      |
| Image load          | Fade in            | 0.4s     | ease                      |
| Button hover        | Background shift   | 0.2s     | ease                      |
| Number counter      | Count up           | 1.5s     | ease-out                  |
| Badge pulse         | Subtle pulse       | 2s       | infinite                  |

---

## Image Handling

### Hotlink Strategy

```tsx
// components/FishImage.tsx
export default function FishImage({ src, alt, credit }) {
  const [error, setError] = useState(false);

  return (
    <figure className="fish-image">
      <img
        src={error ? '/images/placeholder-fish.svg' : src}
        alt={alt}
        loading="lazy"
        onError={() => setError(true)}
        referrerPolicy="no-referrer" // Bypass some hotlink protection
      />
      {credit && <figcaption className="image-credit">📷 {credit}</figcaption>}
    </figure>
  );
}
```

### Placeholder SVG

- Tạo 1 SVG placeholder đẹp với fish silhouette
- Dùng khi hotlink bị chặn hoặc ảnh lỗi
- Style: dark background + teal fish outline
