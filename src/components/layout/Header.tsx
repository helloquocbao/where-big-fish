'use client';

import { useState } from 'react';
import Link from 'next/link';
import SearchModal from './SearchModal';
import './Header.css';

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="header-styled">
        <div className="header-inner-styled">
          <button className="mobile-menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <span className="material-symbols-outlined">{isMenuOpen ? 'close' : 'menu'}</span>
          </button>

          <Link href="/" className="logo-styled">
            WHERE BIG FISH
          </Link>

          <nav className={`nav-styled ${isMenuOpen ? 'mobile-active' : ''}`}>
            <Link href="/stories" className="nav-link-styled" onClick={() => setIsMenuOpen(false)}>
              Stories
            </Link>
            <Link href="/reports" className="nav-link-styled" onClick={() => setIsMenuOpen(false)}>
              Reports
            </Link>
            <Link href="/tackle" className="nav-link-styled" onClick={() => setIsMenuOpen(false)}>
              Tackle
            </Link>
            <Link href="/community" className="nav-link-styled" onClick={() => setIsMenuOpen(false)}>
              Community
            </Link>
          </nav>

          <div className="header-actions">
            <button className="icon-btn-styled" onClick={() => setIsSearchOpen(true)}>
              <span className="material-symbols-outlined">search</span>
            </button>
          </div>
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
