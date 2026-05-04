import React from 'react';
import LocationCard from '@/components/common/LocationCard';
import Sidebar from '@/components/layout/Sidebar';
import { getFishingLocations } from '@/lib/api';
import './stories.css';

export default async function StoriesPage() {
  // Fetch more diverse locations
  const locations = await getFishingLocations(16.0471, 108.2062, 100000); // Danang area

  const stories = locations.map(loc => ({
    slug: loc.id.toString(),
    title: loc.name,
    heroImage: "https://images.unsplash.com/photo-1508921340878-ba53e1f016ec?auto=format&fit=crop&q=80&w=800",
    country: loc.tags['addr:province'] || 'Vietnam',
    speciesName: loc.tags.leisure || 'Fishing Spot',
    waterType: 'adventure'
  }));

  return (
    <div className="home-container">
      <div className="editorial-header">
        <h1 className="editorial-title">Adventure Journeys</h1>
        <p className="editorial-subtitle">
          Discover remote and challenging fishing locations in Vietnam.
        </p>
      </div>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="stories-grid">
            {stories.length > 0 ? stories.map((story: any) => (
              <LocationCard key={story.slug} location={story} />
            )) : (
              <p>Searching for expedition locations...</p>
            )}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
