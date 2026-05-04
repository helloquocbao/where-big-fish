import React from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import { getFishingLocations, REGIONS } from '@/lib/api';
import './Home.css';

export default async function Home() {
  // Fetch a larger set of locations for a better scroll experience
  const [usaSpots, europeSpots] = await Promise.all([
    getFishingLocations(REGIONS.FLORIDA.lat, REGIONS.FLORIDA.lon, 200000),
    getFishingLocations(REGIONS.NORWAY.lat, REGIONS.NORWAY.lon, 200000)
  ]);

  const feedItems = [...usaSpots.slice(0, 5), ...europeSpots.slice(0, 5)];

  return (
    <div className="home-container">
      <header className="feed-header">
        <h1 className="feed-title">The Field Dispatch</h1>
        <p className="feed-subtitle">Live geospatial intelligence from global fishing hotspots.</p>
      </header>

      <div className="home-feed-layout">
        <main className="primary-feed">
          {feedItems.length > 0 ? feedItems.map((post, idx) => (
            <article key={post.id} className="post-item">
              <Link href={`/location/${post.id}`}>
                <div className="post-meta-top">
                  <span className="post-category">
                    {post.tags.leisure || post.tags.sport || 'FISHING SPOT'}
                  </span>
                  <span className="post-date">SYNCED • {idx + 1} HR AGO</span>
                </div>
                
                <div className="post-visual">
                  <ImageWithFallback 
                    src={`https://images.unsplash.com/photo-1544552866-d3ed42536cfd?auto=format&fit=crop&q=80&w=1200&sig=${post.id}`} 
                    alt={post.name} 
                  />
                  <div className="post-coord-tag">
                    {post.lat.toFixed(4)} N, {post.lon.toFixed(4)} W
                  </div>
                </div>

                <h2 className="post-title">{post.name}</h2>
                <p className="post-excerpt">
                  {post.tags.description || `Exploring the tactical advantages of ${post.name}. A premier geospatial record for serious anglers targeting Western ${idx % 2 === 0 ? 'coastal' : 'inland'} monster fish.`}
                </p>

                <div className="post-footer">
                  <div className="read-more-styled">
                    EXPLORE DATA
                    <span className="material-symbols-outlined">arrow_right_alt</span>
                  </div>
                  <div className="post-origin" style={{fontSize: '11px', color: 'var(--outline)', fontWeight: 700}}>
                    SOURCE: OPENSTREETMAP
                  </div>
                </div>
              </Link>
            </article>
          )) : (
            <div className="loading-state">
              <p>Establishing connection to global geospatial nodes...</p>
            </div>
          )}
        </main>

        <aside className="secondary-sidebar">
          <div className="sidebar-widget">
            <h3 className="sidebar-widget-h3">Trending Spots</h3>
            <Sidebar />
          </div>

          <div className="sidebar-widget" style={{position: 'sticky', top: '100px'}}>
            <div className="newsletter-card-premium" style={{padding: '30px', background: 'var(--primary)', color: 'white'}}>
              <h4 style={{fontFamily: 'var(--font-heading)', fontSize: '20px', marginBottom: '12px'}}>Join the Fleet</h4>
              <p style={{fontSize: '14px', opacity: 0.8, marginBottom: '20px'}}>Get real-time field dispatches in your inbox.</p>
              <input 
                type="email" 
                placeholder="Email Address" 
                style={{width: '100%', padding: '12px', marginBottom: '12px', border: 'none'}}
              />
              <button style={{width: '100%', padding: '12px', background: 'var(--accent)', border: 'none', color: 'white', fontWeight: 900}}>
                SUBSCRIBE
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
