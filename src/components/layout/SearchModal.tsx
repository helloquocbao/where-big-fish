'use client';

import { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import Link from 'next/link';
import './SearchModal.css';

interface SearchResult {
  slug: string;
  title: string;
  speciesName: string;
  country: string;
  waterType: string;
}

export default function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allData, setAllData] = useState<SearchResult[]>([]);
  const fuseRef = useRef<Fuse<SearchResult> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load search data
    fetch('/data/locations/index.json')
      .then((res) => res.json())
      .then((data) => {
        setAllData(data);
        fuseRef.current = new Fuse(data, {
          keys: ['title', 'speciesName', 'country', 'tags'],
          threshold: 0.3,
        });
      });
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (fuseRef.current && val.length > 1) {
      const searchResults = fuseRef.current.search(val);
      setResults(searchResults.map((r) => r.item));
    } else {
      setResults([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search fish species or location..."
            value={query}
            onChange={handleSearch}
            className="search-input"
          />
          <button className="close-btn" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="search-results">
          {results.length > 0 ? (
            results.map((res) => (
              <Link
                key={res.slug}
                href={`/location/${res.slug}`}
                className="search-result-item"
                onClick={onClose}
              >
                <div className="res-info">
                  <span className="res-title">{res.title}</span>
                  <span className="res-meta">
                    {res.speciesName} • {res.country}
                  </span>
                </div>
                <span className="res-type">{res.waterType}</span>
              </Link>
            ))
          ) : query.length > 1 ? (
            <p className="no-results">No matches found for "{query}"</p>
          ) : (
            <div className="search-suggestions">
              <p>Try searching for:</p>
              <div className="suggestion-chips">
                <span onClick={() => setQuery('Catfish')}>Catfish</span>
                <span onClick={() => setQuery('Shark')}>Shark</span>
                <span onClick={() => setQuery('Amazon')}>Amazon</span>
                <span onClick={() => setQuery('Mekong')}>Mekong</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
