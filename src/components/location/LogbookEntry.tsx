'use client';

import React, { useState, useEffect } from 'react';
import { searchSpecies, SpeciesData } from '@/lib/api';
import './LogbookEntry.css';

interface LogbookEntry {
  locationId: string;
  speciesId: number;
  speciesName: string;
  weight: string;
  length: string;
  notes: string;
  date: string;
}

interface LogbookEntryProps {
  locationId: string;
  locationName: string;
}

export default function LogbookEntry({ locationId, locationName }: LogbookEntryProps) {
  const [isCatched, setIsCatched] = useState(false);
  const [entry, setEntry] = useState<LogbookEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form states
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [speciesResults, setSpeciesResults] = useState<SpeciesData[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesData | null>(null);
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [notes, setNotes] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const savedLogs = JSON.parse(localStorage.getItem('wbf_logbook') || '{}');
    const savedCatches = JSON.parse(localStorage.getItem('wbf_catches') || '{}');
    
    if (savedLogs[locationId]) {
      setEntry(savedLogs[locationId]);
      setIsCatched(true);
    } else {
      setIsCatched(!!savedCatches[locationId]);
    }
  }, [locationId]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (speciesQuery.length > 2) {
        setIsSearching(true);
        const results = await searchSpecies(speciesQuery, 5);
        setSpeciesResults(results);
        setIsSearching(false);
      } else {
        setSpeciesResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [speciesQuery]);

  const handleSave = () => {
    if (!selectedSpecies && !entry) return;

    const newEntry: LogbookEntry = {
      locationId,
      speciesId: selectedSpecies?.key || entry?.speciesId || 0,
      speciesName: selectedSpecies?.vernacularName || selectedSpecies?.scientificName || entry?.speciesName || 'Unknown Fish',
      weight,
      length,
      notes,
      date: new Date().toLocaleDateString('en-US'),
    };

    const savedLogs = JSON.parse(localStorage.getItem('wbf_logbook') || '{}');
    savedLogs[locationId] = newEntry;
    localStorage.setItem('wbf_logbook', JSON.stringify(savedLogs));

    const savedCatches = JSON.parse(localStorage.getItem('wbf_catches') || '{}');
    savedCatches[locationId] = true;
    localStorage.setItem('wbf_catches', JSON.stringify(savedCatches));

    setEntry(newEntry);
    setIsCatched(true);
    setIsEditing(false);
  };

  const startEditing = () => {
    if (entry) {
      setWeight(entry.weight);
      setLength(entry.length);
      setNotes(entry.notes);
      setSpeciesQuery(entry.speciesName);
      setIsEditing(true);
    }
  };

  return (
    <section className="logbook-section">
      <div className="logbook-header">
        <h2 className="logbook-title">Fishing Logbook</h2>
        <div className={`catch-status ${isCatched ? 'active' : ''}`}>
          <span className="material-symbols-outlined">
            {isCatched ? 'check_circle' : 'pending'}
          </span>
          {isCatched ? 'CHECKED-IN' : 'NO LOG ENTRY'}
        </div>
      </div>

      {entry && !isEditing ? (
        <div className="logbook-card-display">
          <div className="log-main-info">
            <div className="log-species">
              <span className="label">SPECIES:</span>
              <span className="value">{entry.speciesName}</span>
            </div>
            <div className="log-metrics">
              <div className="metric">
                <span className="label">WEIGHT:</span>
                <span className="value">{entry.weight || '---'} kg</span>
              </div>
              <div className="metric">
                <span className="label">LENGTH:</span>
                <span className="value">{entry.length || '---'} cm</span>
              </div>
            </div>
          </div>
          {entry.notes && (
            <div className="log-notes">
              <span className="label">ACHIEVEMENT NOTES:</span>
              <p>{entry.notes}</p>
            </div>
          )}
          <div className="log-footer">
            <span className="log-date">Caught on: {entry.date}</span>
            <button className="edit-btn-minimal" onClick={startEditing}>
              <span className="material-symbols-outlined">edit</span>
              EDIT ENTRY
            </button>
          </div>
        </div>
      ) : (
        <div className="logbook-form">
          <p className="form-instruction">
            {isEditing ? 'Update your log entry:' : 'Record your catch at this location:'}
          </p>
          
          <div className="form-group">
            <label>FIND SPECIES (GBIF Data):</label>
            <div className="species-search-container">
              <input 
                type="text" 
                value={speciesQuery}
                onChange={(e) => setSpeciesQuery(e.target.value)}
                placeholder="e.g. Catfish, Marlin, Bass..."
              />
              {isSearching && <div className="search-loader">Searching...</div>}
              {speciesResults.length > 0 && (
                <ul className="species-dropdown">
                  {speciesResults.map(s => (
                    <li key={s.key} onClick={() => {
                      setSelectedSpecies(s);
                      setSpeciesQuery(s.vernacularName || s.scientificName);
                      setSpeciesResults([]);
                    }}>
                      <strong>{s.vernacularName || s.scientificName}</strong>
                      <span>{s.scientificName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>WEIGHT (KG):</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.0" />
            </div>
            <div className="form-group">
              <label>LENGTH (CM):</label>
              <input type="number" value={length} onChange={e => setLength(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="form-group">
            <label>ADDITIONAL NOTES:</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="What bait did you use? How was the weather?..."
              rows={3}
            />
          </div>

          <div className="form-actions">
            {isEditing && (
              <button className="btn-secondary" onClick={() => setIsEditing(false)}>CANCEL</button>
            )}
            <button 
              className="btn-primary" 
              onClick={handleSave}
              disabled={!selectedSpecies && !entry}
            >
              {isEditing ? 'UPDATE LOGBOOK' : 'SAVE TO LOGBOOK'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
