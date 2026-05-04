/**
 * API Service for "Where Big Fish"
 * Connects to GBIF (Global Biodiversity Information Facility) and OpenStreetMap (Overpass API)
 */

export interface SpeciesData {
  key: number;
  scientificName: string;
  vernacularName?: string;
  canonicalName: string;
  image?: string;
  description?: string;
  family?: string;
  order?: string;
}

export interface LocationData {
  id: string | number;
  name: string;
  lat: number;
  lon: number;
  type: string;
  tags: Record<string, string>;
  environment?: {
    waterType?: string;
    terrain?: string;
    access?: string;
    depth?: string;
  };
  googleData?: {
    description?: string;
    photos?: string[];
    rating?: number;
    userRatingsTotal?: number;
    website?: string;
  };
}

const GBIF_BASE_URL = 'https://api.gbif.org/v1';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place';
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Global Fishing Hotspots (Europe & America focus)
export const REGIONS = {
  FLORIDA: { lat: 27.6648, lon: -81.5158, name: 'Florida, USA' },
  NORWAY: { lat: 68.2232, lon: 14.5682, name: 'Lofoten, Norway' },
  GREAT_LAKES: { lat: 45.0, lon: -85.0, name: 'Great Lakes, NA' },
  ALASKA: { lat: 64.2, lon: -149.5, name: 'Alaska, USA' },
  UK_COAST: { lat: 50.7, lon: -1.3, name: 'English Channel, UK' }
};

const HEADERS = {
  'User-Agent': 'WhereBigFish/1.0 (https://wherebigfish.com; contact@wherebigfish.com)',
  'Content-Type': 'application/x-www-form-urlencoded'
};

/**
 * GBIF: Search for fish species with better metadata
 */
export async function searchSpecies(query: string = 'fish', limit: number = 20): Promise<SpeciesData[]> {
  try {
    const response = await fetch(`${GBIF_BASE_URL}/species/search?q=${encodeURIComponent(query)}&limit=${limit}&rank=SPECIES&status=ACCEPTED&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c`); // World Register of Marine Species
    if (!response.ok) throw new Error(`GBIF error: ${response.status}`);
    const data = await response.json();
    
    return data.results.map((item: any) => ({
      key: item.key,
      scientificName: item.scientificName,
      vernacularName: item.vernacularNames?.[0]?.vernacularName || item.canonicalName,
      canonicalName: item.canonicalName,
      family: item.family,
      order: item.order,
      // Heuristic for fish images - Unsplash has good fish photos if searched by scientific name
      image: `https://source.unsplash.com/featured/?fish,${encodeURIComponent(item.canonicalName)}`
    }));
  } catch (error) {
    console.error('Error fetching species from GBIF:', error);
    return [];
  }
}

/**
 * GBIF: Fetch fish species seen near a specific location
 */
export async function getSpeciesByLocation(lat: number, lon: number, radius: number = 1): Promise<SpeciesData[]> {
  try {
    const minLat = lat - radius;
    const maxLat = lat + radius;
    const minLon = lon - radius;
    const maxLon = lon + radius;
    
    // Search for occurrences in the bounding box, specifically for class 'Actinopterygii' (ray-finned fishes)
    const response = await fetch(`${GBIF_BASE_URL}/occurrence/search?decimalLatitude=${minLat},${maxLat}&decimalLongitude=${minLon},${maxLon}&classKey=204&limit=10&hasCoordinate=true`);
    if (!response.ok) throw new Error(`GBIF error: ${response.status}`);
    const data = await response.json();
    
    // Extract unique species
    const speciesMap = new Map();
    data.results.forEach((occ: any) => {
      if (occ.speciesKey && !speciesMap.has(occ.speciesKey)) {
        speciesMap.set(occ.speciesKey, {
          key: occ.speciesKey,
          scientificName: occ.scientificName,
          vernacularName: occ.vernacularName || occ.species,
          canonicalName: occ.species,
          family: occ.family,
          image: `https://source.unsplash.com/featured/?fish,${encodeURIComponent(occ.species || 'fish')}`
        });
      }
    });
    
    return Array.from(speciesMap.values());
  } catch (error) {
    console.error('Error fetching species by location:', error);
    return [];
  }
}

/**
 * Overpass: Fetch fishing locations in a specific region
 */
export async function getFishingLocations(lat: number, lon: number, radius: number = 50000): Promise<LocationData[]> {
  const query = `
    [out:json][timeout:30];
    (
      node["leisure"="fishing"](around:${radius},${lat},${lon});
      way["leisure"="fishing"](around:${radius},${lat},${lon});
      node["sport"="fishing"](around:${radius},${lat},${lon});
      node["amenity"="fishing_pond"](around:${radius},${lat},${lon});
      node["fishing"="yes"](around:${radius},${lat},${lon});
    );
    out center;
  `;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: HEADERS,
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error(`Overpass error: ${response.status}`);

    const data = await response.json();
    
    return (data.elements || []).map((el: any) => ({
      id: el.id,
      name: el.tags?.name || `Fishing Spot #${el.id}`,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      type: el.tags?.leisure || el.tags?.sport || 'fishing_spot',
      tags: el.tags || {},
      environment: categorizeTags(el.tags || {})
    }));
  } catch (error) {
    console.error('Error fetching locations from Overpass:', error);
    return [{
      id: 'fallback-florida',
      name: 'Key West, Florida (Sample)',
      lat: 24.5551,
      lon: -81.7800,
      type: 'fishing_spot',
      tags: { description: 'API temporarily busy, showing sample US hotspot.' },
      environment: { waterType: 'Ocean', terrain: 'Coastal', access: 'Public' }
    }];
  }
}

/**
 * Overpass: Fetch details for a specific OSM element
 */
export async function getLocationById(id: string | number): Promise<LocationData | null> {
  const query = `
    [out:json][timeout:25];
    (
      node(${id});
      way(${id});
      relation(${id});
    );
    out center;
  `;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: HEADERS,
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error(`Overpass error: ${response.status}`);

    const data = await response.json();
    const el = data.elements?.[0];
    
    if (!el) return null;

    return {
      id: el.id,
      name: el.tags?.name || `Fishing Spot #${el.id}`,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      type: el.tags?.leisure || 'fishing_spot',
      tags: el.tags || {},
      environment: categorizeTags(el.tags || {})
    };
  } catch (error) {
    console.error('Error fetching location details:', error);
    return null;
  }
}

function categorizeTags(tags: Record<string, string>) {
  return {
    waterType: tags.water || tags.natural || (tags.coastline === 'yes' ? 'Coastline' : 'Freshwater'),
    terrain: tags.surface || tags.bottom || tags.natural || 'Mixed Terrain',
    access: tags.access || tags.fee || 'Public Access',
    depth: tags.depth || tags.maxdepth || 'Variable'
  };
}

/**
 * Google Places: Fetch rich data for a location
 */
export async function getGooglePlaceData(lat: number, lon: number, name: string) {
  if (!GOOGLE_API_KEY) return null;

  try {
    // 1. Find Place ID using location and name
    const searchRes = await fetch(
      `${GOOGLE_PLACES_URL}/findplacefromtext/json?input=${encodeURIComponent(name)}&inputtype=textquery&locationbias=circle:5000@${lat},${lon}&fields=place_id&key=${GOOGLE_API_KEY}`
    );
    const searchData = await searchRes.json();
    const placeId = searchData.candidates?.[0]?.place_id;

    if (!placeId) return null;

    // 2. Get Place Details
    const detailsRes = await fetch(
      `${GOOGLE_PLACES_URL}/details/json?place_id=${placeId}&fields=editorial_summary,photos,rating,user_ratings_total,website&key=${GOOGLE_API_KEY}`
    );
    const detailsData = await detailsRes.json();
    const result = detailsData.result;

    if (!result) return null;

    // 3. Map photos to URLs
    const photos = (result.photos || []).slice(0, 5).map((p: any) => 
      `${GOOGLE_PLACES_URL}/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${GOOGLE_API_KEY}`
    );

    return {
      description: result.editorial_summary?.overview,
      photos,
      rating: result.rating,
      userRatingsTotal: result.user_ratings_total,
      website: result.website
    };
  } catch (error) {
    console.error('Error fetching Google Place data:', error);
    return null;
  }
}
