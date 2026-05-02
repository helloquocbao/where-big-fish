'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './MobileBottomNav.css';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', icon: 'home', href: '/' },
    { label: 'Stories', icon: 'auto_stories', href: '/stories' },
    { label: 'Reports', icon: 'analytics', href: '/reports' },
    { label: 'Gear', icon: 'fishing', href: '/tackle' },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => (
        <Link 
          key={item.href} 
          href={item.href} 
          className={`mobile-nav-item ${pathname === item.href ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className="mobile-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
