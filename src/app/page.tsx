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
  
  const tacklePath = path.join(process.cwd(), 'src/data/tackle/index.json');
  const allTackle = JSON.parse(fs.readFileSync(tacklePath, 'utf-8'));

  // Data Segmentation
  const featuredMain = allLocations.find((l: any) => l.featured) || allLocations[0];
  const worldExpeditions = allLocations.slice(10, 16);
  const trendingReports = allLocations.filter((l: any) => l.contentType === 'report').slice(0, 4);
  const gearHighlights = allTackle.slice(0, 3);
  
  // Unique species for explorer
  const speciesList = Array.from(new Set(allLocations.map((l: any) => l.speciesName))).slice(0, 8);

  return (
    <div className="home-container">
      {/* 1. Cinematic Hero Section */}
      <section className="homepage-hero">
        <div className="hero-visual">
          <ImageWithFallback src={featuredMain.heroImage} alt={featuredMain.title} className="hero-img-main" />
          <div className="hero-scrim"></div>
        </div>
        <div className="hero-text-content">
          <span className="editorial-eyebrow">EXCLUSIVE COVER STORY</span>
          <h1 className="hero-display-title">{featuredMain.title}</h1>
          <p className="hero-lead">
            {featuredMain.description || "An odyssey into the world's most remote waters in search of the legendary " + featuredMain.speciesName + "."}
          </p>
          <Link href={`/location/${featuredMain.slug}`} className="btn-editorial-primary">
            READ THE FULL EXPEDITION
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* 2. Species Explorer - Interactive Strip */}
      <section className="species-explorer-strip">
        <div className="section-meta">
          <h2 className="mini-title">CHASE THE GIANTS</h2>
          <div className="title-line"></div>
        </div>
        <div className="species-scroll">
          {speciesList.map((species: any) => (
            <div key={species} className="species-pill">
              <span className="pill-text">{species}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Main Editorial Grid */}
      <div className="home-editorial-layout">
        <div className="primary-column">
          
          {/* World Expeditions - Visual Grid */}
          <div className="editorial-section-header">
            <h2 className="section-h2">World Expeditions</h2>
            <Link href="/stories" className="text-link">Explore Map</Link>
          </div>
          <div className="expeditions-grid">
            {worldExpeditions.map((loc: any) => (
              <Link href={`/location/${loc.slug}`} key={loc.slug} className="expedition-item">
                <div className="expedition-img-box">
                  <ImageWithFallback src={loc.heroImage} alt={loc.title} />
                </div>
                <div className="expedition-info">
                  <span className="loc-tag">{loc.country}</span>
                  <h3 className="expedition-title">{loc.title}</h3>
                </div>
              </Link>
            ))}
          </div>

          {/* Featured Quote / Insight Break */}
          <div className="editorial-pullquote-block">
            <span className="quote-icon">“</span>
            <p className="pullquote-text">
              The water doesn't care about your resume. It only cares about your patience and the quality of your knots.
            </p>
            <span className="quote-author">— Captain Thomas Reed, Kona</span>
          </div>

          {/* Tactical Reports - Bento Style */}
          <div className="editorial-section-header">
            <h2 className="section-h2">Field Dispatches</h2>
            <Link href="/reports" className="text-link">All Reports</Link>
          </div>
          <div className="dispatches-bento">
            {trendingReports.map((report: any) => (
              <LocationCard key={report.slug} location={report} />
            ))}
          </div>
        </div>

        {/* 4. Rich Sidebar */}
        <aside className="editorial-sidebar">
          <Sidebar />
          
          {/* Gear Spotlight in Sidebar */}
          <div className="gear-spotlight-box">
            <h3 className="sidebar-h3">Pro-Grade Gear</h3>
            <div className="gear-list-sidebar">
              {gearHighlights.map((item: any) => (
                <Link href={`/tackle/${item.slug}`} key={item.slug} className="gear-mini-row">
                  <div className="gear-row-img">
                    <ImageWithFallback src={item.heroImage} alt={item.title} />
                  </div>
                  <div className="gear-row-info">
                    <span className="brand-label">{item.brand}</span>
                    <h4 className="gear-row-name">{item.title}</h4>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/tackle" className="sidebar-cta-link">View Tackle Guide</Link>
          </div>

          {/* Newsletter Box */}
          <div className="newsletter-card-premium">
            <h3>The Morning Hatch</h3>
            <p>The week's most tactical fishing news, delivered at sunrise every Sunday.</p>
            <div className="newsletter-form-minimal">
              <input type="email" placeholder="Email Address" />
              <button>JOIN</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
