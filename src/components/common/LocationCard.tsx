import Link from 'next/link';
import ImageWithFallback from './ImageWithFallback';
import './LocationCard.css';

interface LocationCardProps {
  location: {
    slug: string;
    title: string;
    speciesName: string;
    country: string;
    waterType: string;
    maxWeightKg: number;
    isAllowed: boolean | null;
    heroImage: string;
    heroImageAlt: string;
    difficulty: string;
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
          src={location.heroImage}
          alt={location.heroImageAlt}
          className="card-image"
        />
        <span className="card-badge">{location.waterType}</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{location.title}</h3>
        <p className="card-desc">
          Deep in the heart of {location.country}, the quest for the giant {location.speciesName}{' '}
          remains the ultimate achievement for any serious angler.
        </p>

        <div className="card-stats-bar">
          <span className="stat-pill species">
            <span className="material-symbols-outlined">phishing</span>
            {location.speciesName}
          </span>
          <span className="stat-pill weight">
            <span className="material-symbols-outlined">scale</span>
            {location.difficulty || '18 lbs'}
          </span>
        </div>
      </div>
    </Link>
  );
}
