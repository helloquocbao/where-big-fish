import React from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { getFishingLocations, REGIONS } from '@/lib/api';
import './Reports.css';

export default async function ReportsPage() {
  // Fetch multiple global regions
  const [florida, norway, lakes] = await Promise.all([
    getFishingLocations(REGIONS.FLORIDA.lat, REGIONS.FLORIDA.lon, 100000),
    getFishingLocations(REGIONS.NORWAY.lat, REGIONS.NORWAY.lon, 100000),
    getFishingLocations(REGIONS.GREAT_LAKES.lat, REGIONS.GREAT_LAKES.lon, 100000)
  ]);

  const allReports = [...florida, ...norway, ...lakes];

  return (
    <div className="home-container">
      <header className="editorial-header">
        <h1 className="editorial-title">Global Field Reports</h1>
        <p className="editorial-subtitle">
          Real-time geospatial dispatches from primary fishing zones across North America and Europe.
        </p>
      </header>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="reports-list">
            {allReports.length > 0 ? allReports.map((report) => (
              <Link href={`/location/${report.id}`} key={report.id} className="report-item-premium">
                <div className="report-meta">
                  <span className="report-tag">FIELD DISPATCH</span>
                  <span className="report-date">OSM SYNC: ACTIVE</span>
                </div>
                <div className="report-content-box">
                  <h2 className="report-title-link">{report.name}</h2>
                  <div className="report-geo">
                    <span className="material-symbols-outlined">location_on</span>
                    {report.lat.toFixed(4)}, {report.lon.toFixed(4)} • {report.tags['addr:state'] || report.tags['addr:country'] || 'International Waters'}
                  </div>
                  <p className="report-excerpt">
                    {report.tags.description || `Automated report for fishing infrastructure at ${report.name}. Verified coordinates for professional angling navigation.`}
                  </p>
                </div>
                <div className="report-action">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </div>
              </Link>
            )) : (
              <p>Aggregating global satellite and community data...</p>
            )}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
