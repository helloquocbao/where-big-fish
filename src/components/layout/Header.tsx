'use client';

import { useState } from 'react';
import Link from 'next/link';
import SearchModal from './SearchModal';
import './Header.css';

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <header className="header-styled">
        <div className="header-inner-styled container">
          <Link href="/" className="logo-styled">
            WHERE BIG FISH
          </Link>

          <nav className="nav-styled">
            <Link href="/stories" className="nav-link-styled">
              Stories
            </Link>
            <Link href="/reports" className="nav-link-styled">
              Reports
            </Link>
            <Link href="/tackle" className="nav-link-styled">
              Tackle
            </Link>
            <Link href="/community" className="nav-link-styled">
              Community
            </Link>
          </nav>

          <div className="header-actions">
            <button className="icon-btn-styled" onClick={() => setIsSearchOpen(true)}>
              <span className="material-symbols-outlined">search</span>
            </button>
            <button className="icon-btn-styled">
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
