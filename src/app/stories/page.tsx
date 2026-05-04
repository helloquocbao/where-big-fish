import React from 'react';
import LocationCard from '@/components/common/LocationCard';
import Sidebar from '@/components/layout/Sidebar';
import { getFishingLocations, REGIONS } from '@/lib/api';
import './stories.css';

export default async function StoriesPage() {
  // Fetch diverse locations from Norway (Lofoten)
  const locations = await getFishingLocations(REGIONS.NORWAY.lat, REGIONS.NORWAY.lon, 150000);

  const stories = locations.map(loc => ({
    slug: loc.id.toString(),
    title: loc.name,
    heroImage: "https://images.unsplash.com/photo-1544552866-d3ed42536cfd?auto=format&fit=crop&q=80&w=800",
    country: loc.tags['addr:country'] || 'Norway',
    speciesName: loc.tags.leisure || loc.tags.sport || 'Fishing Spot',
    waterType: 'Adventure'
  }));

  return (
    <div className="home-container">
      <div className="editorial-header">
        <h1 className="editorial-title">Arctic Expeditions</h1>
        <p className="editorial-subtitle">
          Discover remote and challenging fishing locations across the Northern Hemisphere.
        </p>
      </div>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="stories-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '32px'}}>
            {stories.length > 0 ? stories.map((story: any) => (
              <LocationCard key={story.slug} location={story} />
            )) : (
              <p>Searching for expedition locations in the Arctic nodes...</p>
            )}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
