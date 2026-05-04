import React from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import { getFishingLocations } from '@/lib/api';
import './Home.css';

export default async function Home() {
  // Fetch real locations from Overpass API (Centered around Vietnam)
  const locations = await getFishingLocations(10.8231, 106.6297, 100000); // 100km radius around HCMC

  // Segmentation
  const featuredMain = locations[0] || {
    id: 'placeholder',
    name: 'Discover New Spots',
    lat: 0,
    lon: 0,
    tags: { description: 'Begin your journey to conquer giant fish around the world.' }
  };
  
  const expeditions = locations.slice(1, 7);

  return (
    <div className="home-container">
      {/* 1. Cinematic Hero Section */}
      <section className="homepage-hero">
        <div className="hero-visual">
          <ImageWithFallback 
            src="https://images.unsplash.com/photo-1544552866-d3ed42536cfd?auto=format&fit=crop&q=80&w=1200" 
            alt="Fishing Hero" 
            className="hero-img-main" 
          />
          <div className="hero-scrim"></div>
        </div>
        <div className="hero-text-content">
          <span className="editorial-eyebrow">EXPLORE REAL FISHING SPOTS</span>
          <h1 className="hero-display-title">{featuredMain.name}</h1>
          <p className="hero-lead">
            {featuredMain.tags.description || "Open data system helps you find the best fishing locations in your area."}
          </p>
          <Link href={`/location/${featuredMain.id}`} className="btn-editorial-primary">
            VIEW LOCATION DETAILS
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* 2. Main Editorial Grid */}
      <div className="home-editorial-layout">
        <div className="primary-column">
          
          <div className="editorial-section-header">
            <h2 className="section-h2">Fishing Spots Near You</h2>
            <Link href="/reports" className="text-link">View Map</Link>
          </div>

          <div className="expeditions-grid">
            {expeditions.length > 0 ? expeditions.map((loc) => (
              <Link href={`/location/${loc.id}`} key={loc.id} className="expedition-item">
                <div className="expedition-img-box">
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1508921340878-ba53e1f016ec?auto=format&fit=crop&q=80&w=800" 
                    alt={loc.name} 
                  />
                </div>
                <div className="expedition-info">
                  <span className="loc-tag">{loc.tags.amenity || 'Fishing Spot'}</span>
                  <h3 className="expedition-title">{loc.name}</h3>
                  <p style={{fontSize: '12px', opacity: 0.7}}>Coordinates: {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}</p>
                </div>
              </Link>
            )) : (
              <p>Loading data from OpenStreetMap...</p>
            )}
          </div>

          <div className="editorial-pullquote-block">
            <span className="quote-icon">“</span>
            <p className="pullquote-text">
              Data is updated directly from OpenStreetMap and the global angling community.
            </p>
          </div>
        </div>

        <aside className="editorial-sidebar">
          <Sidebar />
          
          <div className="newsletter-card-premium">
            <h3>Subscribe</h3>
            <p>Get notified about new spots and the most effective fishing tips.</p>
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
