# 🕷️ Scraping Guide

## Tổng Quan

Tool scraping chạy **offline**, output là JSON files đặt vào `src/data/`. Agent thực hiện Phase 1 sẽ dùng tài liệu này.

---

## Setup Environment

```bash
# Tạo virtual environment
cd scraper/
python -m venv venv
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install scrapy beautifulsoup4 requests lxml
pip install json5  # for flexible JSON parsing
```

### Cấu trúc thư mục scraper

```
scraper/
├── venv/
├── spiders/
│   ├── igfa_spider.py
│   ├── worldrecords_spider.py
│   ├── wikipedia_spider.py
│   └── fishbase_spider.py
├── raw/                    # Raw scraped data
│   ├── igfa_raw.json
│   ├── worldrecords_raw.json
│   └── wikipedia_raw.json
├── scripts/
│   ├── transform.py        # Raw → Final schema transformer
│   ├── validate.py          # Validate output JSON
│   ├── merge.py             # Merge multiple sources
│   └── generate_index.py    # Generate index.json from details/
├── requirements.txt
└── scrapy.cfg
```

---

## Source 1: IGFA (igfa.org)

### Target Data

- World records by species
- Location of record catches
- Species info (weight, length)

### Approach

```python
# spiders/igfa_spider.py
"""
URL: https://igfa.org/world-records/
Strategy: Scrape world records search results
Data to extract:
  - Species common name
  - Scientific name
  - Record weight
  - Location (where caught)
  - Angler name
  - Date
  - Line class

Notes:
  - Check robots.txt first
  - Use DOWNLOAD_DELAY = 3 (be respectful)
  - May need to handle pagination
  - Some data may require JavaScript rendering → use Scrapy-Splash or requests_html
"""
```

### Expected Output

```json
{
  "species": "Giant Trevally",
  "scientificName": "Caranx ignobilis",
  "recordWeight": "72.8 kg",
  "location": "Tokara Islands, Japan",
  "angler": "...",
  "date": "2006-05-22",
  "lineClass": "All-Tackle",
  "sourceUrl": "https://igfa.org/..."
}
```

---

## Source 2: fishing-worldrecords.com

### Target Data

- Large freshwater fish records
- Locations and species

### Approach

```python
# spiders/worldrecords_spider.py
"""
URL: https://fishing-worldrecords.com/
Strategy: Scrape species listing pages
Data to extract:
  - Fish species
  - Record size/weight
  - Location/country
  - Images (URLs for hotlinking)

Notes:
  - Simpler site structure, likely static HTML
  - BeautifulSoup may be sufficient
  - DOWNLOAD_DELAY = 2
"""
```

---

## Source 3: Wikipedia

### Target Pages

- https://en.wikipedia.org/wiki/List_of_largest_fish
- https://en.wikipedia.org/wiki/List_of_freshwater_fish_by_size
- Individual species pages

### Approach

```python
# spiders/wikipedia_spider.py
"""
Strategy: Use Wikipedia API (preferred) or scrape tables
API endpoint: https://en.wikipedia.org/w/api.php

Data to extract:
  - Species name, scientific name
  - Maximum size/weight
  - Habitat/distribution
  - Conservation status
  - Images (Wikimedia Commons - CC licensed!)

Notes:
  - Wikipedia images are CC licensed → safe to use with attribution
  - Use MediaWiki API for structured data
  - Tables on list pages are well-structured HTML tables
"""
```

### Wikipedia Image Strategy

```python
# Wikimedia Commons images are FREE and legal to use
# Format: https://upload.wikimedia.org/wikipedia/commons/...
# Always include: "Image: Wikimedia Commons, CC BY-SA"
```

---

## Source 4: FishBase (fishbase.org)

### Target Data

- Scientific species data
- Distribution maps
- Maximum sizes

### Approach

```python
# spiders/fishbase_spider.py
"""
URL: https://fishbase.org/
Alternative: Use rfishbase API (R package) or fishbaseapi
API: https://fishbase.ropensci.org/

Data to extract:
  - Species taxonomy
  - Max weight, max length
  - Habitat type
  - Distribution/native range
  - Threat status
"""
```

---

## Transform Pipeline

### Step 1: Raw → Normalized

```python
# scripts/transform.py
"""
Input: raw/*.json (multiple sources)
Output: src/data/locations/details/*.json (final schema)

Process:
1. Load all raw files
2. Match species across sources (by scientific name)
3. Merge data from multiple sources for same species/location
4. Generate slugs from title
5. Geocode location names → lat/lng (use free Nominatim API)
6. Format according to DATA_SCHEMA.md
7. Write individual JSON files
"""
```

### Step 2: Geocoding

```python
# Use free Nominatim (OpenStreetMap) for geocoding
import requests
import time

def geocode(location_name):
    """Convert location name to lat/lng using Nominatim."""
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location_name,
        "format": "json",
        "limit": 1
    }
    headers = {"User-Agent": "WhereBigFish/1.0"}
    response = requests.get(url, params=params, headers=headers)
    time.sleep(1)  # Respect rate limit

    if response.json():
        result = response.json()[0]
        return float(result["lat"]), float(result["lon"])
    return None, None
```

### Step 3: Generate Index

```python
# scripts/generate_index.py
"""
Input: src/data/locations/details/*.json
Output:
  - src/data/locations/index.json (all locations summary)
  - src/data/locations/freshwater.json
  - src/data/locations/brackish.json
  - src/data/locations/saltwater.json

Process:
1. Read all detail files
2. Extract summary fields only (LocationSummary schema)
3. Sort by maxWeightKg descending
4. Write filtered files by waterType
"""
```

### Step 4: Validate

```python
# scripts/validate.py
"""
Validate ALL JSON files against DATA_SCHEMA.md rules:
- Required fields present
- Format rules met
- No duplicates
- Valid coordinates
- URLs are valid
- Cross-references exist (speciesSlug → species file)
"""
```

---

## Ethical Scraping Rules

> [!CAUTION]
> MUST follow these rules to avoid legal issues:

1. **Always check `robots.txt`** before scraping any site
2. **`DOWNLOAD_DELAY = 2-5`** seconds between requests
3. **Set proper `USER_AGENT`**: `"WhereBigFish-Bot/1.0 (contact@wherebigfish.com)"`
4. **Do NOT copy articles verbatim** — rewrite/summarize in own words
5. **Extracting facts is OK** (species weights, locations) — facts aren't copyrightable
6. **Always credit sources** with links back to original pages
7. **Prefer APIs** over scraping when available (Wikipedia API, FishBase API)
8. **Use CC-licensed images** when possible (Wikimedia Commons)
9. **Hotlink images** with proper `imageCredits` attribution
10. **Do not scrape faster than 1 request per 2 seconds**

---

## Priority Data to Collect First (50 locations)

### Freshwater (20 locations)

1. Mekong Giant Catfish - Mekong River, Thailand/Cambodia
2. Arapaima - Amazon Basin, Brazil
3. Nile Perch - Lake Victoria, East Africa
4. Giant Freshwater Stingray - Mekong River, Cambodia
5. Wels Catfish - Po River, Italy / Ebro River, Spain
6. Alligator Gar - Texas, USA
7. White Sturgeon - Fraser River, Canada
8. Paddlefish - Missouri River, USA
9. Taimen - Mongolia rivers
10. Giant Barb - Mekong River
11. Piraíba Catfish - Amazon River
12. Murray Cod - Murray River, Australia
13. Goliath Tigerfish - Congo River
14. Papuan Black Bass - Papua New Guinea
15. Mahseer - Indian rivers
16. Beluga Sturgeon - Caspian Sea/Volga River
17. Lake Trout - Great Lakes, USA/Canada
18. Chinook Salmon - Columbia River, USA
19. Giant Snakehead - Southeast Asia
20. Piranha (Giant) - Amazon River

### Saltwater (20 locations)

1. Great White Shark - Guadalupe Island, Mexico
2. Blue Marlin - Kona, Hawaii
3. Bluefin Tuna - Prince Edward Island, Canada
4. Swordfish - Florida Keys, USA
5. Giant Trevally - Tokara Islands, Japan
6. Yellowfin Tuna - Baja California, Mexico
7. Sailfish - Guatemala/Costa Rica
8. Mako Shark - New Zealand
9. Tarpon - Boca Grande, Florida
10. Roosterfish - Baja California
11. Dogtooth Tuna - Maldives
12. Giant Grouper - Great Barrier Reef, Australia
13. Wahoo - Bermuda
14. King Mackerel - Gulf of Mexico
15. Halibut - Alaska, USA
16. Striped Bass - Montauk, New York
17. Barramundi - Northern Territory, Australia
18. Cobia - Chesapeake Bay, USA
19. Mahi-Mahi - Costa Rica
20. Bull Shark - Zambezi River mouth, Mozambique

### Brackish (10 locations)

1. Bull Shark - Brisbane River, Australia
2. Barramundi - Daly River, Australia
3. Snook - Everglades, Florida
4. Tarpon - Rio San Juan, Nicaragua
5. Giant Trevally - Estuary rivers, Seychelles
6. Mangrove Jack - Queensland, Australia
7. Striped Bass - Hudson River, New York
8. Flathead - Sydney Harbour, Australia
9. Jewfish/Mulloway - Hawkesbury River, Australia
10. Nile Perch - Lake Turkana (alkaline), Kenya
