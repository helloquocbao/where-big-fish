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

  // Editorial Selection
  const featuredLarge = allLocations.find((l: any) => l.featured && l.contentType === 'story') || allLocations[0];
  const reports = allLocations.filter((l: any) => l.contentType === 'report').slice(0, 6);
  const stories = allLocations.filter((l: any) => l.contentType === 'story' && !l.featured).slice(0, 3);
  const gearReviews = allTackle.slice(0, 4);
  const featuredHorizontal = allLocations.find((l: any) => l.slug === 'blue-marlin-kona-hawaii') || allLocations[1];

  return (
    <div className="home-container">
      {/* Epic Hero Section */}
      <section className="hero-epic">
        <ImageWithFallback src={featuredLarge.heroImage} alt={featuredLarge.title} className="hero-epic-img" />
        <div className="hero-epic-overlay"></div>
        <div className="hero-epic-content">
          <div className="hero-epic-tags">
            <span className="badge-exclusive">FEATURED STORY</span>
            <span className="badge-category">{featuredLarge.speciesName.toUpperCase()}</span>
          </div>
          <h1 className="hero-epic-title">{featuredLarge.title}</h1>
          <p className="hero-epic-desc">
            An in-depth expedition into the heart of {featuredLarge.country}, chasing the legendary {featuredLarge.speciesName}. 
            A testament to patience, skill, and the raw power of nature.
          </p>
          <Link href={`/location/${featuredLarge.slug}`} className="hero-epic-btn">
            READ THE STORY
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* Grid Layout */}
      <div className="home-main-grid">
        {/* Left Main Column */}
        <div className="content-canvas">
          
          {/* Latest Reports Section */}
          <div className="section-header-styled">
            <h2 className="section-title-large">Field Reports</h2>
            <Link href="/reports" className="view-all-link">
              ALL REPORTS <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <div className="reports-grid-small" style={{ marginBottom: '64px' }}>
            {reports.map((loc: any) => (
              <LocationCard key={loc.slug} location={loc} />
            ))}
          </div>

          {/* Featured Middle Section */}
          <article className="card-featured-horizontal" style={{ marginBottom: '64px' }}>
            <div className="card-feat-img">
              <ImageWithFallback src={featuredHorizontal.heroImage} alt={featuredHorizontal.title} />
              <span className="card-feat-badge">MASTERCLASS</span>
            </div>
            <div className="card-feat-body">
              <div className="card-feat-meta">
                <span><span className="material-symbols-outlined">menu_book</span> 8 min read</span>
                <span><span className="material-symbols-outlined">public</span> {featuredHorizontal.continent}</span>
              </div>
              <h3 className="card-feat-title">{featuredHorizontal.title}</h3>
              <p className="card-feat-desc">
                Experience the world's most elite fishing grounds through the eyes of seasoned professionals.
              </p>
              <Link href={`/location/${featuredHorizontal.slug}`} className="card-feat-author">
                EXPLORE NOW <span className="material-symbols-outlined">arrow_right_alt</span>
              </Link>
            </div>
          </article>

          {/* Latest Stories Section */}
          <div className="section-header-styled">
            <h2 className="section-title-large">Latest Narratives</h2>
            <Link href="/stories" className="view-all-link">
              ALL STORIES <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
          <div className="reports-grid-small" style={{ marginBottom: '64px' }}>
            {stories.map((loc: any) => (
              <LocationCard key={loc.slug} location={loc} />
            ))}
          </div>

          {/* Tackle & Gear Section */}
          <div className="section-header-styled">
            <h2 className="section-title-large">Tackle & Gear Reviews</h2>
            <Link href="/tackle" className="view-all-link">
              ALL REVIEWS <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
          <div className="tackle-horizontal-grid">
            {gearReviews.map((item: any) => (
              <Link href={`/tackle/${item.slug}`} key={item.slug} className="tackle-mini-card">
                <div className="tackle-mini-img">
                  <ImageWithFallback src={item.heroImage} alt={item.title} />
                </div>
                <div className="tackle-mini-content">
                  <span className="tackle-mini-brand">{item.brand}</span>
                  <h4 className="tackle-mini-title">{item.title}</h4>
                </div>
              </Link>
            ))}
          </div>

        </div>

        {/* Right Sidebar */}
        <Sidebar />
      </div>
    </div>
  );
}
