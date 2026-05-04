'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { searchSpecies, SpeciesData } from '@/lib/api';
import './SearchModal.css';

export default function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpeciesData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setIsSearching(true);
        const searchResults = await searchSpecies(query, 10);
        setResults(searchResults);
        setIsSearching(false);
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search species (e.g. Salmon, Shark, Carp...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button className="close-btn" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="search-results">
          {isSearching && <p className="loading-text">Searching GBIF database...</p>}
          
          {results.length > 0 ? (
            results.map((res) => (
              <div
                key={res.key}
                className="search-result-item"
              >
                <div className="res-info">
                  <span className="res-title">{res.vernacularName || res.scientificName}</span>
                  <span className="res-meta">
                    {res.scientificName}
                  </span>
                </div>
                <span className="res-type">GBIF TAXON</span>
              </div>
            ))
          ) : query.length > 2 && !isSearching ? (
            <p className="no-results">No fish found matching "{query}"</p>
          ) : (
            <div className="search-suggestions">
              <p>Try searching for:</p>
              <div className="suggestion-chips">
                <span onClick={() => setQuery('Catfish')}>Catfish</span>
                <span onClick={() => setQuery('Marlin')}>Marlin</span>
                <span onClick={() => setQuery('Tuna')}>Tuna</span>
                <span onClick={() => setQuery('Bass')}>Bass</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
