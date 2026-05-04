import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import { searchSpecies } from '@/lib/api';
import './Species.css';

export default async function SpeciesPage() {
  // Fetch real species from GBIF API
  const speciesList = await searchSpecies('game fish', 24);

  return (
    <div className="home-container">
      <header className="editorial-header" style={{marginBottom: '64px', borderBottom: '4px solid var(--primary)', paddingBottom: '32px'}}>
        <h1 className="editorial-title" style={{fontSize: '80px', lineHeight: '0.9', marginBottom: '24px'}}>Species Catalog</h1>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <p className="editorial-subtitle" style={{maxWidth: '600px'}}>
            A comprehensive taxonomic directory of the world's most sought-after game fish, 
            synchronized with the Global Biodiversity Information Facility.
          </p>
          <div className="catalog-meta" style={{textAlign: 'right'}}>
            <span style={{fontSize: '11px', fontWeight: 900, letterSpacing: '0.2em'}}>DATABASE: GBIF.ORG</span>
            <br />
            <span style={{fontSize: '11px', opacity: 0.6}}>RECORDS: {speciesList.length} CURRENTLY VIEWABLE</span>
          </div>
        </div>
      </header>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="species-grid">
            {speciesList.length > 0 ? speciesList.map((species) => (
              <div key={species.key} className="species-card-premium">
                <div className="species-image-box">
                  <ImageWithFallback 
                    src={species.image || `https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&q=80&w=800`} 
                    alt={species.vernacularName || species.scientificName} 
                  />
                </div>
                <div className="species-info">
                  <span className="mini-label">TAXONOMIC RECORD</span>
                  <h2 className="species-name-title">{species.vernacularName || species.scientificName}</h2>
                  <p className="species-meta">{species.scientificName}</p>
                  
                  <div className="species-locations-mini">
                    <p style={{fontSize: '13px', lineHeight: '1.6', marginBottom: '20px'}}>
                      Full biological profile and catch statistics available in the community Logbook.
                    </p>
                    <button className="edit-btn" style={{width: '100%'}}>
                      EXPLORE TAXON DATA
                    </button>
                    <div className="data-source-badge">GBIF ID: {species.key}</div>
                  </div>
                </div>
              </div>
            )) : (
              <p>Fetching scientific records from GBIF network...</p>
            )}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
