import { Metadata } from 'next';
import MapEmbed from '@/components/common/MapEmbed';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import LogbookEntry from '@/components/location/LogbookEntry';
import { getLocationById, getSpeciesByLocation, getGooglePlaceData } from '@/lib/api';
import './LocationDetail.css';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getLocationById(slug);

  return {
    title: `${data?.name || 'Fishing Spot'} | Where Big Fish`,
    description: `Explore fishing spot ${data?.name} at coordinates ${data?.lat}, ${data?.lon}.`,
  };
}

export default async function LocationPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getLocationById(slug);

  if (!data) {
    return <div className="home-container">Location not found or API error.</div>;
  }

  // Fetch enriched data in parallel
  const [nearbySpecies, googleData] = await Promise.all([
    getSpeciesByLocation(data.lat, data.lon),
    getGooglePlaceData(data.lat, data.lon, data.name)
  ]);

  // Attach google data to location object for the UI
  const enrichedData = { ...data, googleData };

  return (
    <div className="home-container">
      <div className="home-main-grid location-detail-grid">
        <article className="content-canvas main-article">
          <header className="article-header">
            <div className="article-meta-tags">
              <span className="badge-category">{enrichedData.tags.leisure || 'Fishing Spot'}</span>
              <span className="badge-exclusive">GOOGLE PLACES SYNC: {googleData ? 'ACTIVE' : 'IDLE'}</span>
            </div>
            <h1 className="article-title-editorial">{enrichedData.name}</h1>

            <div className="author-bar">
              <div className="author-info">
                <span className="material-symbols-outlined" style={{fontSize: '40px'}}>location_on</span>
                <div>
                  <span className="author-name">Coordinates: {enrichedData.lat.toFixed(4)}, {enrichedData.lon.toFixed(4)}</span>
                  <p className="publish-date">{enrichedData.tags['addr:city'] || enrichedData.tags['addr:country'] || 'International Waters'}</p>
                </div>
              </div>
              {googleData?.rating && (
                <div className="google-rating-pill">
                  <span className="material-symbols-outlined">star</span>
                  {googleData.rating} ({googleData.userRatingsTotal} reviews)
                </div>
              )}
            </div>
          </header>

          <figure className="article-hero-editorial">
            <img 
              src={googleData?.photos?.[0] || `https://images.unsplash.com/photo-1544552866-d3ed42536cfd?auto=format&fit=crop&q=80&w=1200`} 
              alt={enrichedData.name} 
            />
            <figcaption className="hero-caption">© {googleData ? 'Google Maps' : 'OpenStreetMap'} | High-fidelity satellite imagery</figcaption>
          </figure>

          <div className="editorial-stats-bar">
            <div className="stat-pill-large">
              <span className="material-symbols-outlined">water</span>
              <div className="stat-text">
                <p className="stat-label">WATER TYPE</p>
                <p className="stat-val" style={{textTransform: 'capitalize'}}>{enrichedData.environment?.waterType || 'Mixed'}</p>
              </div>
            </div>
            <div className="stat-pill-large">
              <span className="material-symbols-outlined">landscape</span>
              <div className="stat-text">
                <p className="stat-label">TERRAIN</p>
                <p className="stat-val" style={{textTransform: 'capitalize'}}>{enrichedData.environment?.terrain || 'Natural'}</p>
              </div>
            </div>
            <div className="stat-pill-large">
              <span className="material-symbols-outlined">lock_open</span>
              <div className="stat-text">
                <p className="stat-label">ACCESS</p>
                <p className="stat-val" style={{textTransform: 'capitalize'}}>{enrichedData.environment?.access || 'Public'}</p>
              </div>
            </div>
          </div>

          <div className="article-body-editorial">
            <p className="drop-cap-editorial">
              {googleData?.description || `This fishing location is recorded in ${enrichedData.tags['addr:city'] || 'the local area'}. It is part of the global OpenStreetMap data network, providing verified coordinates for professional angling navigation.`}
            </p>

            {googleData?.photos && googleData.photos.length > 1 && (
              <div className="google-photo-gallery" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', margin: '48px 0'}}>
                {googleData.photos.slice(1).map((photo, i) => (
                  <img key={i} src={photo} alt={`${enrichedData.name} view ${i + 1}`} style={{width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px'}} />
                ))}
              </div>
            )}
            
            <h2 className="editorial-section-h2">Biological Survey: Species Nearby</h2>
            <p style={{marginBottom: '24px', opacity: 0.8}}>
              Taxonomic records from GBIF indicate the following species have been documented within this geospatial sector:
            </p>
            
            <div className="nearby-species-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '48px'}}>
              {nearbySpecies.length > 0 ? nearbySpecies.map(species => (
                <div key={species.key} className="mini-species-card" style={{display: 'flex', gap: '16px', alignItems: 'center', border: '1px solid var(--outline-variant)', padding: '12px'}}>
                  <img src={species.image} alt={species.scientificName} style={{width: '60px', height: '60px', objectFit: 'cover'}} />
                  <div>
                    <h4 style={{margin: 0, fontSize: '15px'}}>{species.vernacularName || species.scientificName}</h4>
                    <span style={{fontSize: '11px', opacity: 0.6, fontStyle: 'italic'}}>{species.scientificName}</span>
                  </div>
                </div>
              )) : (
                <p style={{gridColumn: '1 / -1', textAlign: 'center', padding: '24px', background: 'var(--surface-variant)'}}>
                  No recent taxonomic surveys available for this specific coordinate.
                </p>
              )}
            </div>

            <h2 className="editorial-section-h2">Geospatial Metadata</h2>
            <div className="tags-grid-premium">
              {Object.entries(enrichedData.tags).map(([key, val]) => (
                <div key={key} className="tag-item-editorial">
                  <span className="tag-key">{key}</span>
                  <span className="tag-val">{val}</span>
                </div>
              ))}
              {googleData?.website && (
                <div className="tag-item-editorial">
                  <span className="tag-key">OFFICIAL WEBSITE</span>
                  <span className="tag-val"><a href={googleData.website} target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary-container)'}}>Visit Site</a></span>
                </div>
              )}
            </div>

            <h2 className="editorial-section-h2" id="map" style={{marginTop: '48px'}}>Precision Navigation Map</h2>
            <MapEmbed
              lat={enrichedData.lat}
              lng={enrichedData.lon}
              title={enrichedData.name}
            />
          </div>

          <LogbookEntry locationId={slug} locationName={enrichedData.name} />
        </article>

        <Sidebar />
      </div>
    </div>
  );
}
