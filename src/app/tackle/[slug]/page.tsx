import fs from 'fs';
import path from 'path';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import '../../location/[slug]/LocationDetail.css'; // Reuse the premium article styles

export async function generateStaticParams() {
  const detailsDir = path.join(process.cwd(), 'src/data/tackle/details');
  if (!fs.existsSync(detailsDir)) return [];
  const files = fs.readdirSync(detailsDir);
  return files.map((file) => ({
    slug: file.replace('.json', ''),
  }));
}

export default async function TackleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dataPath = path.join(process.cwd(), `src/data/tackle/details/${slug}.json`);
  
  if (!fs.existsSync(dataPath)) {
    return <div>Review not found</div>;
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  return (
    <div className="home-container">
      <div className="home-main-grid location-detail-grid">
        <article className="content-canvas main-article">
          <header className="article-header">
            <div className="article-meta-tags">
              <span className="badge-category">{data.category}</span>
              <span className="badge-exclusive">GEAR REVIEW</span>
            </div>
            <h1 className="article-title-editorial">{data.title}</h1>
            <div className="author-bar">
               <div className="author-info">
                  <span className="author-name">Rating: {data.rating}/5 Stars</span>
                  <span className="publish-date">Brand: {data.brand}</span>
               </div>
            </div>
          </header>

          <figure className="article-hero-editorial">
            <ImageWithFallback src={data.heroImage} alt={data.title} />
          </figure>

          <div className="editorial-stats-bar">
            {data.specs.map((spec: any, i: number) => (
              <div className="stat-pill-large" key={i}>
                <div className="stat-text">
                  <p className="stat-label">{spec.label}</p>
                  <p className="stat-val">{spec.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="article-body-editorial">
            <p className="drop-cap-editorial">{data.content.intro}</p>
            <h2 className="editorial-section-h2">Performance Analysis</h2>
            <p>{data.content.performance}</p>
            <h2 className="editorial-section-h2">The Verdict</h2>
            <p>{data.content.verdict}</p>
          </div>
        </article>
        
        <Sidebar />
      </div>
    </div>
  );
}
