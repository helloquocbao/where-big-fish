# 💰 Monetization Strategy

## 1. Google AdSense

### Requirements để được duyệt

- Tối thiểu **30 bài viết chất lượng** (mỗi bài > 500 từ)
- Website hoạt động ít nhất **1 tháng**
- Có trang Privacy Policy, About, Contact, Disclaimer
- Navigation rõ ràng, UX tốt
- Content không vi phạm bản quyền (ghi nguồn đầy đủ)
- Không quá nhiều outbound links

### Ad Placements (tối đa hiệu quả, không phá UX)

| Vị trí                          | Format               | Loại trang    |
| ------------------------------- | -------------------- | ------------- |
| Sau Hero section                | Leaderboard 728x90   | Homepage      |
| Giữa bài viết (sau paragraph 3) | In-Article Rectangle | Detail page   |
| Trước Related Posts             | Rectangle 300x250    | Detail page   |
| Sidebar (desktop only)          | Skyscraper 160x600   | Detail page   |
| Cuối bài viết                   | Leaderboard 728x90   | All pages     |
| Giữa listing grid               | In-feed Ad           | Listing pages |

### Implementation

```tsx
// components/AdUnit.tsx
'use client';
import { useEffect, useRef } from 'react';

export default function AdUnit({ slot, format = 'auto', style = {} }) {
  const adRef = useRef(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    } catch (e) {
      console.error('Ad error:', e);
    }
  }, []);

  return (
    <div className="ad-container" ref={adRef}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', ...style }}
        data-ad-client="ca-pub-XXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
```

---

## 2. Affiliate Marketing

### Fishing Equipment Affiliates

| Program           | Commission | Cookie  | Loại sản phẩm          |
| ----------------- | ---------- | ------- | ---------------------- |
| Amazon Associates | 1-10%      | 24h     | Cần câu, máy câu, lure |
| Tackle Warehouse  | 5-8%       | 30 days | Fishing tackle         |
| Bass Pro Shops    | 5%         | 14 days | Gear, boats            |
| FishUSA           | 5-10%      | 30 days | Premium tackle         |

### Cách tích hợp Affiliate

1. **"Recommended Gear" section** ở cuối mỗi bài viết location
2. **Sidebar widget** "Essential Gear for [Species]"
3. **Comparison tables** cho từng loại cá (best rod, reel, line)
4. **"Shop the Look" cards** với ảnh sản phẩm + link affiliate

### Component

```tsx
// components/AffiliateProduct.tsx
export default function AffiliateProduct({ name, image, price, link, store }) {
  return (
    <a href={link} target="_blank" rel="noopener sponsored" className="affiliate-card">
      <img src={image} alt={name} loading="lazy" />
      <div className="affiliate-info">
        <h4>{name}</h4>
        <span className="price">{price}</span>
        <span className="store">via {store}</span>
      </div>
      <span className="cta">Check Price →</span>
    </a>
  );
}
```

> [!IMPORTANT]
> Luôn ghi rõ `rel="sponsored"` trên affiliate links (yêu cầu Google) và thêm disclosure ở footer: "This site contains affiliate links. We may earn a commission at no extra cost to you."

---

## 3. Revenue Projections (Estimate)

| Metric            | Month 3  | Month 6     | Month 12      |
| ----------------- | -------- | ----------- | ------------- |
| Monthly visitors  | 1,000    | 10,000      | 50,000        |
| AdSense RPM       | $3-5     | $5-8        | $8-15         |
| AdSense Revenue   | $3-5     | $50-80      | $400-750      |
| Affiliate Revenue | $0       | $20-50      | $100-300      |
| **Total**         | **$3-5** | **$70-130** | **$500-1050** |

---

## 4. Legal Requirements

### Pages cần có

1. **Privacy Policy** — Required cho AdSense, GA4
2. **Disclaimer** — Ghi rõ content từ nguồn nào, affiliate disclosure
3. **About** — Giới thiệu website
4. **Contact** — Form liên hệ hoặc email

### Affiliate Disclosure Text

```
Affiliate Disclosure: Where Big Fish is a participant in the Amazon Services LLC
Associates Program and other affiliate programs. Links marked with * are affiliate
links. If you purchase through these links, we may earn a small commission at no
additional cost to you. This helps support our website and keeps our content free.
```

### Source Attribution

```
Sources & Credits:
This article was compiled using information from the following sources:
• [Source Name] - [URL]
• [Source Name] - [URL]
Images are credited to their respective owners as noted in captions.
```
