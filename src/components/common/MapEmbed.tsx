interface MapEmbedProps {
  lat: number;
  lng: number;
  zoom?: number;
  title: string;
}

export default function MapEmbed({ lat, lng, zoom = 10, title }: MapEmbedProps) {
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;

  return (
    <div
      className="map-wrapper"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-lg)',
        height: '400px',
      }}
    >
      <iframe
        src={src}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        title={`Map of ${title}`}
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
