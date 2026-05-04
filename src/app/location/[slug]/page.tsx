import { Metadata } from 'next';
import MapEmbed from '@/components/common/MapEmbed';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import LogbookEntry from '@/components/location/LogbookEntry';
import { getLocationById } from '@/lib/api';
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

  return (
    <div className="home-container">
      <div className="home-main-grid location-detail-grid">
        <article className="content-canvas main-article">
          <header className="article-header">
            <div className="article-meta-tags">
              <span className="badge-category">{data.tags.leisure || 'Fishing Spot'}</span>
              <span className="badge-exclusive">OPEN SOURCE DATA</span>
            </div>
            <h1 className="article-title-editorial">{data.name}</h1>

            <div className="author-bar">
              <div className="author-info">
                <span className="material-symbols-outlined" style={{fontSize: '40px'}}>location_on</span>
                <div>
                  <span className="author-name">OpenStreetMap Data</span>
                  <p className="publish-date">Updated real-time</p>
                </div>
              </div>
            </div>
          </header>

          <figure className="article-hero-editorial">
            <img 
              src="https://images.unsplash.com/photo-1516939884452-0342e90de507?auto=format&fit=crop&q=80&w=1200" 
              alt={data.name} 
            />
            <figcaption className="hero-caption">© OpenStreetMap Contributors</figcaption>
          </figure>

          <div className="editorial-stats-bar">
            <div className="stat-pill-large">
              <span className="material-symbols-outlined">explore</span>
              <div className="stat-text">
                <p className="stat-label">LATITUDE</p>
                <p className="stat-val">{data.lat.toFixed(4)}</p>
              </div>
            </div>
            <div className="stat-pill-large">
              <span className="material-symbols-outlined">map</span>
              <div className="stat-text">
                <p className="stat-label">LONGITUDE</p>
                <p className="stat-val">{data.lon.toFixed(4)}</p>
              </div>
            </div>
            <div className="stat-pill-large">
              <span className="material-symbols-outlined">pin_drop</span>
              <div className="stat-text">
                <p className="stat-label">TYPE</p>
                <p className="stat-val">{data.tags.amenity || 'Fishing Spot'}</p>
              </div>
            </div>
          </div>

          <div className="article-body-editorial">
            <p className="drop-cap-editorial">
              This fishing location is recorded in {data.tags['addr:city'] || 'the local area'}. 
              It is part of the global OpenStreetMap data network.
            </p>
            
            <h2 className="editorial-section-h2">Additional Information</h2>
            <ul style={{listStyle: 'none', padding: 0}}>
              {Object.entries(data.tags).map(([key, val]) => (
                <li key={key} style={{marginBottom: '8px', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '8px'}}>
                  <strong style={{textTransform: 'uppercase', fontSize: '12px'}}>{key}:</strong> {val}
                </li>
              ))}
            </ul>

            <h2 className="editorial-section-h2" id="map">Location Map</h2>
            <MapEmbed
              lat={data.lat}
              lng={data.lon}
              title={data.name}
            />
          </div>

          <LogbookEntry locationId={slug} locationName={data.name} />
        </article>

        <Sidebar />
      </div>
    </div>
  );
}
