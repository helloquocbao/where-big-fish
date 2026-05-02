# 🚀 Deployment Guide

## Hosting: Vercel (Free Tier)

### Setup Steps

1. Push code to GitHub repository
2. Connect GitHub repo to Vercel (vercel.com)
3. Vercel auto-detects Next.js → configures build
4. Every push to `main` → auto deploy

### Build Command

```bash
next build
```

### Environment Variables (Vercel Dashboard)

```
NEXT_PUBLIC_SITE_URL=https://wherebigfish.com
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXX
```

### Custom Domain Setup

1. Buy domain (Namecheap/Cloudflare recommended)
2. In Vercel Dashboard → Settings → Domains → Add domain
3. Update DNS:
   - A Record: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`
4. SSL auto-provisioned by Vercel

---

## CI/CD Pipeline

### GitHub Actions (optional)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run validate # Validate JSON data
```

---

## Post-Deploy Checklist

- [ ] Verify all pages load correctly
- [ ] Check Google Maps iframes render
- [ ] Test on mobile devices
- [ ] Submit sitemap to Google Search Console
- [ ] Verify robots.txt accessible
- [ ] Test search functionality
- [ ] Check image fallbacks work
- [ ] Lighthouse score ≥ 90
- [ ] Apply for Google AdSense (after 30+ articles, 1 month)
- [ ] Setup Google Analytics 4
- [ ] Test dark/light mode toggle

---

## Monitoring

| Tool                  | Purpose                  | Cost      |
| --------------------- | ------------------------ | --------- |
| Google Search Console | SEO monitoring, indexing | Free      |
| Google Analytics 4    | Traffic analysis         | Free      |
| Vercel Analytics      | Performance, Web Vitals  | Free tier |
| UptimeRobot           | Uptime monitoring        | Free      |
