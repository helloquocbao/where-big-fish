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
  return (
    <Link href={`/location/${location.slug}`} className="location-card group">
      <div className="card-image-wrapper">
        <ImageWithFallback
          src={location.heroImage || "https://images.unsplash.com/photo-1508921340878-ba53e1f016ec?auto=format&fit=crop&q=80&w=800"}
          alt={location.heroImageAlt || location.title}
          className="card-image"
        />
        <div className="card-data-overlay">
          <span className="osm-id">OSM: {location.slug}</span>
        </div>
        <span className="card-badge">{location.waterType || 'FISHING SPOT'}</span>
      </div>
      <div className="card-body">
        <div className="card-eyebrow">
          <span className="material-symbols-outlined">explore</span>
          {location.country || 'GLOBAL DIRECTORY'}
        </div>
        <h3 className="card-title">{location.title}</h3>
        <p className="card-desc">
          Geospatial record retrieved from OpenStreetMap. This location represents a verified angling point of interest.
        </p>

        <div className="card-stats-bar">
          <div className="stat-pill">
            <span className="material-symbols-outlined">analytics</span>
            DATA VERIFIED
          </div>
          <div className="stat-pill secondary">
            OPEN SOURCE
          </div>
        </div>
      </div>
    </Link>
  );
}
