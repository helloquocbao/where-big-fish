import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import '../stories/stories.css';

export default function TacklePage() {
  return (
    <div className="home-container">
      <div className="editorial-header">
        <h1 className="editorial-title">Tackle & Gear</h1>
        <p className="editorial-subtitle">Professional equipment recommendations integrated with your Logbook.</p>
      </div>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="community-cta-box" style={{
            backgroundColor: 'var(--surface-container)',
            padding: '64px',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            <span className="material-symbols-outlined" style={{fontSize: '80px', marginBottom: '24px'}}>phishing</span>
            <h2 style={{fontSize: '32px', marginBottom: '16px'}}>Tackle Insights Coming Soon</h2>
            <p style={{maxWidth: '600px', margin: '0 auto 32px', opacity: 0.8}}>
              We are rebuilding our gear database to link directly with your catch reports. 
              Soon you will be able to see which lures and rods are most effective for specific species at your favorite locations.
            </p>
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
