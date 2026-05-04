import Link from 'next/link';
import ImageWithFallback from './ImageWithFallback';
import './LocationCard.css';

interface LocationCardProps {
  location: {
    slug: string;
    title: string;
    speciesName?: string;
    country?: string;
    waterType?: string;
    maxWeightKg?: number;
    isAllowed?: boolean | null;
    heroImage?: string;
    heroImageAlt?: string;
    difficulty?: string;
  };
}

export default function LocationCard({ location }: LocationCardProps) {
  const getFishingStatus = () => {
    if (location.isAllowed === true) return { text: '✅ Allowed', class: 'status-allowed' };
    if (location.isAllowed === false) return { text: '❌ Prohibited', class: 'status-prohibited' };
    return { text: '❓ Unknown', class: 'status-unknown' };
  };

  const status = getFishingStatus();

  return (
    <Link href={`/location/${location.slug}`} className="location-card group">
      <div className="card-image-wrapper">
        <ImageWithFallback
          src={location.heroImage || "https://images.unsplash.com/photo-1508921340878-ba53e1f016ec?auto=format&fit=crop&q=80&w=800"}
          alt={location.heroImageAlt || location.title}
          className="card-image"
        />
        <span className="card-badge">{location.waterType || 'Fishing Spot'}</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{location.title}</h3>
        <p className="card-desc">
          Explore {location.country || 'Vietnam'} - a destination with potential to conquer challenging {location.speciesName || 'local fish'} species.
        </p>

        <div className="card-stats-bar">
          <span className="stat-pill species">
            <span className="material-symbols-outlined">phishing</span>
            {location.speciesName || 'Fishing Spot'}
          </span>
          <span className="stat-pill weight">
            <span className="material-symbols-outlined">explore</span>
            {location.difficulty || 'OSM Data'}
          </span>
        </div>
      </div>
    </Link>
  );
}
