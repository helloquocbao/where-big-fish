import { MetadataRoute } from 'next';

export const dynamic = 'force-static';
import fs from 'fs';
import path from 'path';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://wherebigfish.com';

  // Base editorial routes
  const routes = ['', '/stories', '/reports', '/tackle', '/community'].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1 : 0.8,
    }),
  );

  // Location routes
  const locationsDir = path.join(process.cwd(), 'src/data/locations/details');
  const locationFiles = fs.readdirSync(locationsDir);
  const locationRoutes = locationFiles.map((file) => ({
    url: `${baseUrl}/location/${file.replace('.json', '')}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Tackle routes
  const tackleDir = path.join(process.cwd(), 'src/data/tackle/details');
  let tackleRoutes: any[] = [];
  if (fs.existsSync(tackleDir)) {
    const tackleFiles = fs.readdirSync(tackleDir);
    tackleRoutes = tackleFiles.map((file) => ({
      url: `${baseUrl}/tackle/${file.replace('.json', '')}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  }

  return [...routes, ...locationRoutes, ...tackleRoutes];
}
