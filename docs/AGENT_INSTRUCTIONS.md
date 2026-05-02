# 🤖 Agent Instructions

> Tài liệu này hướng dẫn AI agents cách thực hiện các task trong dự án Where Big Fish.
> CON NGƯỜI CHỈ LÀ USER TEST — KHÔNG THAM GIA CODING.

---

## Quy Tắc Chung

### 1. Đọc tài liệu trước khi làm

Trước khi thực hiện bất kỳ task nào, đọc các file sau theo thứ tự:

1. `docs/PROJECT_OVERVIEW.md` — Hiểu tổng quan dự án
2. `docs/TECH_STACK.md` — Hiểu tech stack
3. `docs/DATA_SCHEMA.md` — Hiểu cấu trúc data
4. File .md liên quan đến task cụ thể

### 2. Nguyên tắc code

- **TypeScript** cho Next.js code (strict mode)
- **Vanilla CSS** — KHÔNG dùng Tailwind CSS
- **CSS Variables** — Sử dụng design tokens từ `UI_DESIGN.md`
- **Responsive** — Mobile-first approach
- **Semantic HTML** — Dùng đúng thẻ HTML5
- **Comments** — Comment code bằng tiếng Anh

### 3. Nguyên tắc data

- KHÔNG sửa trực tiếp JSON data files bằng tay
- Dùng scripts trong `scraper/scripts/` để transform data
- Validate data sau khi transform bằng `scripts/validate.py`
- Mỗi location phải có tối thiểu 1 source

### 4. Nguyên tắc commit

```
feat: add location detail page layout
fix: handle broken image hotlinks
data: add 10 freshwater locations
style: improve card hover animation
docs: update scraping guide
```

---

## Task Instructions by Phase

### Phase 1: Data Collection

**Agent Role**: Data Engineer / Scraper

**Steps:**

1. Đọc `docs/SCRAPING_GUIDE.md` đầy đủ
2. Setup Python environment trong `scraper/`
3. Tạo spiders cho từng source (IGFA, Wikipedia, etc.)
4. Scrape data → lưu vào `scraper/raw/`
5. Tạo transform script → output theo `DATA_SCHEMA.md`
6. Generate `index.json` cho mỗi category
7. Validate tất cả output files
8. Ưu tiên 50 locations đầu tiên theo list trong SCRAPING_GUIDE.md

**Deliverables:**

```
scraper/
├── spiders/*.py
├── raw/*.json
├── scripts/transform.py
├── scripts/validate.py
└── scripts/generate_index.py

src/data/
├── locations/index.json
├── locations/freshwater.json
├── locations/saltwater.json
├── locations/brackish.json
├── locations/details/*.json (50+ files)
├── species/index.json
└── species/details/*.json
```

---

### Phase 2: Website Core

**Agent Role**: Frontend Developer

**Steps:**

1. Đọc `docs/TECH_STACK.md` và `docs/UI_DESIGN.md`
2. Init Next.js project: `npx -y create-next-app@latest ./ --typescript --app --no-tailwind --no-src-dir --no-eslint`
   - Hoặc nếu muốn src dir: thêm `--src-dir`
3. Setup design system (CSS variables, fonts)
4. Build components theo thứ tự:
   a. Layout (Header + Footer)
   b. LocationCard
   c. FishImage (with hotlink fallback)
   d. MapEmbed
   e. FishingStatusBadge
   f. SearchModal
   g. FilterSidebar
   h. SourceAttribution
   i. Breadcrumb
   j. AdUnit (placeholder)
5. Build pages:
   a. Homepage
   b. Explore/Listing page
   c. Location detail page
   d. Species listing & detail
   e. Category pages
6. Connect data (JSON) → pages via SSG
7. Test build: `npm run build`

**Deliverables:**

```
app/
├── layout.tsx
├── page.tsx (homepage)
├── globals.css
├── explore/page.tsx
├── location/[slug]/page.tsx
├── species/page.tsx
├── species/[slug]/page.tsx
├── freshwater/page.tsx
├── saltwater/page.tsx
├── brackish/page.tsx
├── about/page.tsx
├── privacy-policy/page.tsx
└── disclaimer/page.tsx

components/
├── Header.tsx + Header.css
├── Footer.tsx + Footer.css
├── LocationCard.tsx + LocationCard.css
├── FishImage.tsx + FishImage.css
├── MapEmbed.tsx + MapEmbed.css
├── FishingStatusBadge.tsx + FishingStatusBadge.css
├── SearchModal.tsx + SearchModal.css
├── FilterSidebar.tsx + FilterSidebar.css
├── SourceAttribution.tsx + SourceAttribution.css
├── Breadcrumb.tsx + Breadcrumb.css
├── AdUnit.tsx + AdUnit.css
├── HeroSection.tsx + HeroSection.css
├── CategoryCards.tsx + CategoryCards.css
└── RelatedLocations.tsx + RelatedLocations.css

lib/
├── data.ts (data loading functions)
├── search.ts (Fuse.js search)
└── utils.ts (helpers)
```

---

### Phase 3: SEO & Polish

**Agent Role**: SEO Specialist / Frontend Developer

**Steps:**

1. Đọc `docs/SEO_STRATEGY.md`
2. Add metadata to all pages (title, description, OG, Twitter)
3. Add JSON-LD structured data (Article, Place, FAQ)
4. Generate sitemap.xml
5. Create robots.txt
6. Add breadcrumb navigation
7. Add canonical URLs
8. Optimize images (lazy load, fallback, alt text)
9. Add internal linking
10. Performance audit (Lighthouse)
11. Create Privacy Policy, Disclaimer pages

---

### Phase 4: Monetization

**Agent Role**: Integration Specialist

**Steps:**

1. Đọc `docs/MONETIZATION.md`
2. Add Google AdSense script to layout
3. Place AdUnit components at strategic positions
4. Add Google Analytics 4 tracking
5. Setup affiliate link components
6. Add social sharing buttons
7. Add newsletter signup (Mailchimp embed)
8. Deploy to Vercel
9. Submit to Google Search Console

---

## Testing Checklist (for User)

Sau khi agent hoàn thành, user test các mục sau:

### Functional

- [ ] Trang chủ load đúng, hero section hiển thị
- [ ] 3 category cards hiển thị đúng số lượng
- [ ] Click vào location card → mở detail page
- [ ] Google Maps iframe hiển thị đúng vị trí
- [ ] Fishing status badge hiển thị đúng (allowed/prohibited)
- [ ] Search hoạt động, tìm được kết quả
- [ ] Filter hoạt động trên Explore page
- [ ] Source attribution hiển thị cuối mỗi bài
- [ ] Dark/Light mode toggle hoạt động
- [ ] Related locations hiển thị cuối bài

### Responsive

- [ ] Mobile: menu hamburger hoạt động
- [ ] Mobile: cards stack thành 1 cột
- [ ] Tablet: layout 2 cột
- [ ] Desktop: layout đầy đủ

### SEO

- [ ] Mỗi page có title tag unique
- [ ] Mỗi page có meta description
- [ ] View source: thấy JSON-LD structured data
- [ ] sitemap.xml accessible
- [ ] robots.txt accessible

### Performance

- [ ] Lighthouse score ≥ 90
- [ ] Images lazy load
- [ ] Fonts load with swap
- [ ] No layout shift (CLS < 0.1)
