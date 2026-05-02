import LocationCard from '@/components/common/LocationCard';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import './Home.css';

export default function Home() {
  const dataPath = path.join(process.cwd(), 'src/data/locations/index.json');
  const allLocations = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  // Editorial Selection
  const featuredLarge = allLocations.find((l: any) => l.featured && l.contentType === 'story') || allLocations[0];
  const reports = allLocations.filter((l: any) => l.contentType === 'report').slice(0, 4);
  const featuredHorizontal = allLocations.find((l: any) => l.slug === 'blue-marlin-kona-hawaii') || allLocations[1];

  return (
    <div className="home-container">
      {/* Epic Hero Section */}
      <section className="hero-epic">
        <ImageWithFallback src="/images/hero.png" alt="Cinematic Hero" className="hero-epic-img" />
        <div className="hero-epic-overlay"></div>
        <div className="hero-epic-content">
          <div className="hero-epic-tags">
            <span className="badge-exclusive">EXCLUSIVE</span>
            <span className="badge-category">DEEP SEA</span>
          </div>
          <h1 className="hero-epic-title">The Leviathan of the Gulf: A 40-Hour Battle</h1>
          <p className="hero-epic-desc">
            When the lines screamed on the Lady Luck ninety miles offshore, no one expected to hook
            a creature that would test the absolute limits of man, machine, and marine engineering.
          </p>
          <Link href={`/location/${featuredLarge.slug}`} className="hero-epic-btn">
            READ THE EPIC
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* Grid Layout */}
      <div className="home-main-grid">
        {/* Left Main Column: Dispatches */}
        <div className="content-canvas">
          <div className="section-header-styled">
            <h2 className="section-title-large">Dispatch from the Water</h2>
            <Link href="/reports" className="view-all-link">
              ALL REPORTS <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <div className="reports-bento">
            {/* Featured Horizontal Card */}
            <article className="card-featured-horizontal">
              <div className="card-feat-img">
                <ImageWithFallback src={featuredHorizontal.heroImage} alt={featuredHorizontal.title} />
                <span className="card-feat-badge">TACKLE MASTERCLASS</span>
              </div>
              <div className="card-feat-body">
                <div className="card-feat-meta">
                  <span>
                    <span className="material-symbols-outlined">schedule</span> 4 min read
                  </span>
                  <span>
                    <span className="material-symbols-outlined">location_on</span>{' '}
                    {featuredHorizontal.country}
                  </span>
                </div>
                <h3 className="card-feat-title">{featuredHorizontal.title}</h3>
                <p className="card-feat-desc">
                  Deep in the heart of {featuredHorizontal.country}, the quest for the giant{' '}
                  {featuredHorizontal.speciesName} remains the ultimate achievement for any serious
                  angler.
                </p>
                <Link href={`/location/${featuredHorizontal.slug}`} className="card-feat-author">
                  READ MORE <span className="material-symbols-outlined">arrow_right_alt</span>
                </Link>
              </div>
            </article>

            {/* In-Feed Ad Break */}
            <div className="in-feed-ad-styled">
              <span className="ad-label-styled">SPONSORED</span>
              <div className="ad-box-premium">
                <span>Premium Gear Ad</span>
              </div>
            </div>

            {/* Smaller Cards Grid */}
            <div className="reports-grid-small">
              {reports.map((loc: any) => (
                <LocationCard key={loc.slug} location={loc} />
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <Sidebar />
      </div>
    </div>
  );
}
