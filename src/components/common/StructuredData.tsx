export default function StructuredData({ data }: { data: any }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.content.title,
    description: data.content.metaDescription,
    image: data.media.heroImage,
    author: {
      '@type': 'Organization',
      name: 'Where Big Fish',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Where Big Fish',
      logo: {
        '@type': 'ImageObject',
        url: 'https://wherebigfish.com/logo.png', // Placeholder
      },
    },
    datePublished: data.publishedAt,
    dateModified: data.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://wherebigfish.com/location/${data.id}`,
    },
  };

  // Add specific Fish species data if possible
  const fishLd = {
    '@context': 'https://schema.org',
    '@type': 'BiologicalEntity',
    name: data.species.commonName,
    scientificName: data.species.scientificName,
    description: `Information about ${data.species.commonName} found in ${data.location.name}, ${data.location.country}.`,
    image: data.media.heroImage,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, fishLd]) }}
    />
  );
}
