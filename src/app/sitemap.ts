import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://wherebigfish.com';

  // Base routes only for now, as location data is now dynamic via API
  const routes = ['', '/stories', '/reports', '/tackle', '/species'].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1 : 0.8,
    }),
  );

  return [...routes];
}
