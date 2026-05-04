import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import { searchSpecies } from '@/lib/api';
import './Species.css';

export default async function SpeciesPage() {
  // Fetch real species from GBIF API
  const speciesList = await searchSpecies('fish', 24);

  return (
    <div className="home-container">
      <header className="editorial-header">
        <h1 className="editorial-title">Fish Species Directory (GBIF)</h1>
        <p className="editorial-subtitle">
          Scientific data provided by the Global Biodiversity Information Facility.
        </p>
      </header>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="species-grid">
            {speciesList.length > 0 ? speciesList.map((species) => (
              <div key={species.key} className="species-card-premium">
                <div className="species-image-box">
                  <ImageWithFallback 
                    src={`https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&q=80&w=800`} 
                    alt={species.vernacularName || species.scientificName} 
                  />
                </div>
                <div className="species-info">
                  <h2 className="species-name-title">{species.vernacularName || species.scientificName}</h2>
                  <p className="species-meta" style={{fontStyle: 'italic'}}>{species.scientificName}</p>
                  
                  <div className="species-locations-mini">
                    <p style={{fontSize: '13px', lineHeight: '1.6'}}>
                      Full scientific data is available in the Logbook when you check-in this species.
                    </p>
                    <button className="edit-btn" style={{marginTop: '16px', width: '100%', justifyContent: 'center'}}>
                      VIEW TAXON DETAILS
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <p>Loading species data from GBIF...</p>
            )}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
