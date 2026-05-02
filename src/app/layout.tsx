import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import GoogleAnalytics from '@/components/common/GoogleAnalytics';

export const metadata: Metadata = {
// ... existing metadata
  title: 'Where Big Fish — Discover Giant Fish Locations Worldwide',
  description:
    'Find the best locations for big fish across freshwater, brackish, and saltwater environments. Guides, maps, and regulations for fishing enthusiasts.',
  openGraph: {
    title: 'Where Big Fish — Discover Giant Fish Locations Worldwide',
    description:
      'Find the best locations for big fish across freshwater, brackish, and saltwater environments.',
    url: 'https://wherebigfish.com',
    siteName: 'Where Big Fish',
    images: [
      {
        url: 'https://wherebigfish.com/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Where Big Fish — Discover Giant Fish Locations Worldwide',
    description:
      'Find the best locations for big fish across freshwater, brackish, and saltwater environments.',
    images: ['https://wherebigfish.com/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-background text-on-background">
        <GoogleAnalytics gaId="G-XXXXXXXXXX" />

        <Header />

        {/* Top Leaderboard Ad Slot - Now below Header */}
        <div className="top-ad-zone">
          <div className="ad-box-leaderboard">
            <span className="ad-label-top">SPONSORED</span>
            <span className="ad-text">Advertisement Placeholder</span>
          </div>
        </div>

        <main className="flex-grow">{children}</main>
        <Footer />
        <MobileBottomNav />
      </body>
    </html>
  );
}
