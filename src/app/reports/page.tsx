import React from 'react';
import LocationCard from '@/components/common/LocationCard';
import Sidebar from '@/components/layout/Sidebar';
import { getFishingLocations } from '@/lib/api';
import '../stories/stories.css';

export default async function ReportsPage() {
  // Fetch real locations from Overpass API (Centered around Vietnam)
  const locations = await getFishingLocations(10.8231, 106.6297, 50000); 

  // Map Overpass data to LocationCard format
  const reports = locations.map(loc => ({
    slug: loc.id.toString(),
    title: loc.name,
    heroImage: "https://images.unsplash.com/photo-1544552866-d3ed42536cfd?auto=format&fit=crop&q=80&w=800",
    country: loc.tags['addr:city'] || 'Vietnam',
    speciesName: loc.tags.amenity || 'Fishing Spot',
    waterType: 'fishing_spot'
  }));

  return (
    <div className="home-container">
      <div className="editorial-header">
        <h1 className="editorial-title">Community Reports</h1>
        <p className="editorial-subtitle">Tactical dispatches and real-world fishing spots from OpenStreetMap.</p>
      </div>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="stories-grid">
            {reports.length > 0 ? reports.map((report: any) => (
              <LocationCard key={report.slug} location={report} />
            )) : (
              <p>Loading fishing spot data...</p>
            )}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
