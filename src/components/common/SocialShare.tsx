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
    <div className="flex gap-4 my-6 items-center">
      <span className="text-sm font-semibold text-gray-400">Share:</span>
      {shares.map((social) => (
        <a
          key={social.name}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm transition-opacity hover:opacity-80"
          style={{ backgroundColor: social.color }}
        >
          <span>{social.icon}</span>
          <span>{social.name}</span>
        </a>
      ))}
    </div>
  );
}
