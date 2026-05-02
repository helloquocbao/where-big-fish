# 🐟 Where Big Fish

> Discover Giant Fish Locations Worldwide — Freshwater, Brackish & Saltwater

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com)

## About

Where Big Fish is a comprehensive directory of the world's best locations for encountering giant fish species. From the Mekong Giant Catfish in Cambodia to Great White Sharks off Guadalupe Island, we catalog the biggest fish on Earth — and tell you if you can fish for them.

## Features

- 🗺️ **100+ Locations** — Giant fish spots across all continents
- 💧 **3 Water Types** — Freshwater, Brackish, Saltwater
- 🎣 **Fishing Regulations** — Know before you go
- 🔍 **Smart Search** — Find by species, country, or water type
- 📍 **Interactive Maps** — Google Maps for every location
- 📱 **Responsive** — Beautiful on every device
- 🌙 **Dark/Light Mode** — Easy on the eyes

## Tech Stack

- **Framework**: Next.js 14+ (Static Site Generation)
- **Styling**: Vanilla CSS
- **Data**: JSON files (no database)
- **Maps**: Google Maps Embed (free)
- **Search**: Fuse.js (client-side)
- **Hosting**: Vercel (free tier)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Documentation

| Document                                         | Description                 |
| ------------------------------------------------ | --------------------------- |
| [Project Overview](docs/PROJECT_OVERVIEW.md)     | Vision, goals, architecture |
| [Tech Stack](docs/TECH_STACK.md)                 | Detailed technology choices |
| [Data Schema](docs/DATA_SCHEMA.md)               | JSON data structure         |
| [Scraping Guide](docs/SCRAPING_GUIDE.md)         | Data collection process     |
| [UI Design](docs/UI_DESIGN.md)                   | Component specifications    |
| [SEO Strategy](docs/SEO_STRATEGY.md)             | Search optimization         |
| [Monetization](docs/MONETIZATION.md)             | Revenue strategy            |
| [Deployment](docs/DEPLOYMENT.md)                 | Hosting & CI/CD             |
| [Agent Instructions](docs/AGENT_INSTRUCTIONS.md) | AI agent task guide         |

## Project Structure

```
where-big-fish/
├── docs/              # Specification documents
├── scraper/           # Python data scraping tools
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── styles/        # CSS files
│   ├── lib/           # Utilities
│   └── data/          # JSON data files
├── public/            # Static assets
└── README.md
```

## License

Content sourced from third-party websites is attributed with links to original sources. All original code is MIT licensed.
