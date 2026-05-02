'use client';

import React from 'react';

interface SocialShareProps {
  url: string;
  title: string;
}

export default function SocialShare({ url, title }: SocialShareProps) {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : url;

  const shares = [
    {
      name: 'Facebook',
      icon: '📘',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: '#1877f2',
    },
    {
      name: 'Twitter',
      icon: '🐦',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`,
      color: '#1da1f2',
    },
    {
      name: 'WhatsApp',
      icon: '💬',
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' ' + shareUrl)}`,
      color: '#25d366',
    },
  ];

  return (
    <div className="social-share-container">
      <span className="social-share-label">SHARE</span>
      <div className="social-share-buttons">
        {shares.map((social) => (
          <a
            key={social.name}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className="social-share-btn"
            style={{ backgroundColor: social.color }}
          >
            <span className="social-icon">{social.icon}</span>
            <span className="social-name">{social.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
