# 🐟 Where Big Fish — Project Overview

## Vision

"Where Big Fish" là website tổng hợp địa điểm có cá lớn trên toàn thế giới. Mục tiêu là trở thành **nguồn tham khảo #1** cho người yêu câu cá muốn tìm địa điểm có cá khủng, đồng thời cung cấp thông tin về quy định câu cá tại từng địa điểm.

## Business Model

```
Traffic (SEO) → Content (Fish Locations) → Engagement → Ads Revenue
```

- **Primary Revenue**: Google AdSense display ads
- **Secondary Revenue**: Affiliate links (fishing equipment, travel booking)
- **Target Audience**: Anglers, fishing enthusiasts, travel fishers worldwide

## Core Features

1. **Location Directory**: Danh sách 100+ địa điểm có cá lớn, phân loại theo loại nước
2. **Species Database**: Thông tin chi tiết về từng loài cá lớn
3. **Fishing Regulations**: Thông tin câu cá có được phép hay không tại mỗi nơi
4. **Interactive Maps**: Google Maps embed cho mỗi địa điểm
5. **Search & Filter**: Tìm kiếm theo species, country, water type
6. **Source Attribution**: Ghi nguồn rõ ràng cuối mỗi bài viết

## Architecture Principles

- **ZERO Backend**: Static site, no server, no database
- **JSON as Database**: Tất cả dữ liệu lưu trong JSON files
- **SSG (Static Site Generation)**: Pre-render tất cả pages tại build time
- **Hotlink Images**: Dùng ảnh từ nguồn gốc, không self-host
- **Free Hosting**: Deploy trên Vercel free tier
- **Offline Scraping**: Tool scraping chạy riêng, output là JSON files

## Content Strategy

- Mỗi bài viết (location) bao gồm:
  - Mô tả địa điểm
  - Thông tin loài cá (kích thước, cân nặng max)
  - Vị trí trên bản đồ (Google Maps iframe)
  - Quy định câu cá (được phép / cấm / cần giấy phép)
  - Mùa câu tốt nhất
  - Tips & highlights
  - Ảnh (hotlinked từ nguồn)
  - **Nguồn bài viết** (links đến trang gốc)

## Target Metrics (6 months)

- 100+ indexed pages
- 10,000+ monthly organic visitors
- Lighthouse score: 90+ across all categories
- Google AdSense approval

## Project Structure

```
where-big-fish/
├── docs/                    # Tài liệu specification
├── scraper/                 # Python scraping tool (Phase 1)
│   ├── spiders/
│   ├── raw/                 # Raw scraped data
│   └── scripts/             # Transform scripts
├── src/                     # Next.js source (Phase 2-4)
│   ├── app/                 # App Router pages
│   ├── components/          # React components
│   ├── styles/              # CSS files
│   ├── lib/                 # Utility functions
│   └── data/                # JSON data files
├── public/                  # Static assets
├── next.config.js
├── package.json
└── README.md
```
