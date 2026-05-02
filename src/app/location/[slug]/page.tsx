import { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import MapEmbed from '@/components/common/MapEmbed';
import StructuredData from '@/components/common/StructuredData';
import SocialShare from '@/components/common/SocialShare';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import Link from 'next/link';
import './LocationDetail.css';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const detailsDir = path.join(process.cwd(), 'src/data/locations/details');
  const files = fs.readdirSync(detailsDir);
  return files.map((file) => ({
    slug: file.replace('.json', ''),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const dataPath = path.join(process.cwd(), `src/data/locations/details/${slug}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  return {
    title: `${data.content.title} | Where Big Fish`,
    description: data.content.metaDescription,
  };
}

export default async function LocationPage({ params }: PageProps) {
  const { slug } = await params;
  const dataPath = path.join(process.cwd(), `src/data/locations/details/${slug}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  return (
    <>
      <StructuredData data={data} />
      <div className="home-container">
        <div className="home-main-grid location-detail-grid">
          {/* Main Article Content */}
          <article className="content-canvas main-article">
            <header className="article-header">
              <div className="article-meta-tags">
                <span className="badge-category">{data.location.waterType}</span>
                <span className="badge-exclusive">EXPEDITION</span>
              </div>
              <h1 className="article-title-editorial">{data.content.title}</h1>

              <div className="author-bar">
                <div className="author-info">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdMvPx3IWrX5CEiEZ7iggQLoZ5EFoQvLwpMFHSzFwrJQbp7bNO8gBPF3USyhPMfb83_deHeUUmXfKJWKIjr-IXueGlMp1ixv5s_dyjB4cs6W-fdm-m1sputVI4SAMh02u7ci89nAn08W9OJT2vLzARE-SpHQYyCW_jkO097ZSG_wi0CcFqI2_qM3XTpgoeAAPsZShCZxlbvKDoIFN1dxSg_5rFYJmVpwqw3XqcXeeBsEWzu-JCgCnbuGxh2ipsxMb_bGFlkRmIWfo"
                    alt="Author"
                    className="author-img"
                  />
                  <div>
                    <span className="author-name">By Captain Elias Vance</span>
                    <p className="publish-date">
                      Published {data.sources[0]?.accessedDate || 'October 12, 2024'}
                    </p>
                  </div>
                </div>
                <SocialShare url="" title={data.content.title} />
              </div>
            </header>

            <figure className="article-hero-editorial">
              <img src={data.media.heroImage} alt={data.media.heroImageAlt} />
              <figcaption className="hero-caption">© {data.media.imageCredits}</figcaption>
            </figure>

            <div className="editorial-stats-bar">
              <div className="stat-pill-large">
                <span className="material-symbols-outlined">scale</span>
                <div className="stat-text">
                  <p className="stat-label">MAX WEIGHT</p>
                  <p className="stat-val">{data.species.maxWeight}</p>
                </div>
              </div>
              <div className="stat-pill-large">
                <span className="material-symbols-outlined">phishing</span>
                <div className="stat-text">
                  <p className="stat-label">SPECIES</p>
                  <p className="stat-val">{data.species.commonName}</p>
                </div>
              </div>
              <div className="stat-pill-large">
                <span className="material-symbols-outlined">location_on</span>
                <div className="stat-text">
                  <p className="stat-label">LOCATION</p>
                  <p className="stat-val">{data.location.name}</p>
                </div>
              </div>
            </div>

            <div className="article-body-editorial">
              {/* Rich Editorial Content */}
              {data.editorial ? (
                <>
                  <p className="drop-cap-editorial">{data.editorial.introduction}</p>
                  
                  {data.editorial.quote && (
                    <blockquote className="editorial-quote">
                      "{data.editorial.quote.text}"
                      <cite>— {data.editorial.quote.author}</cite>
                    </blockquote>
                  )}

                  {data.editorial.sections.map((section: any, idx: number) => (
                    <section key={idx} className="editorial-section">
                      <h2 className="editorial-section-h2">{section.heading}</h2>
                      <div dangerouslySetInnerHTML={{ __html: section.body }} />
                      {section.image && (
                        <figure className="inline-article-image">
                          <ImageWithFallback src={section.image} alt={section.heading} />
                          {section.caption && <figcaption>{section.caption}</figcaption>}
                        </figure>
                      )}
                    </section>
                  ))}
                  
                  <h2 className="editorial-section-h2" id="regulations">Regulations & Access</h2>
                  <p>{data.fishing.regulations}</p>

                  <h2 className="editorial-section-h2" id="map">Location Map</h2>
                  <MapEmbed
                    lat={data.location.lat}
                    lng={data.location.lng}
                    title={data.location.name}
                  />
                </>
              ) : (
                <>
                  <p className="drop-cap-editorial">{data.content.description}</p>
                  <h2 className="editorial-section-h2">Fishing Regulations</h2>
                  <p>{data.fishing.regulations}</p>
                  <h2 className="editorial-section-h2">Best Time to Visit</h2>
                  <p>{data.content.bestTime}</p>

                  <h2 className="editorial-section-h2" id="map">Location Map</h2>
                  <MapEmbed
                    lat={data.location.lat}
                    lng={data.location.lng}
                    title={data.location.name}
                  />
                </>
              )}
            </div>

          <section className="sources-section-styled">
            <h3>CITATIONS & SOURCES</h3>
            <div className="sources-links">
              {data.sources.map((source: any, i: number) => (
                <a key={i} href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.name} — {source.url}
                </a>
              ))}
            </div>
          </section>
          </article>

          {/* Sidebar */}
          <Sidebar />
        </div>
      </div>
    </>
  );
}
