
async function testMedia() {
  const taxonKey = 2392431; // Nematistius pectoralis
  const GBIF_BASE_URL = 'https://api.gbif.org/v1';
  
  try {
    const response = await fetch(`${GBIF_BASE_URL}/occurrence/search?taxonKey=${taxonKey}&mediaType=StillImage&limit=1`);
    const data = await response.json();
    console.log('Media Results:');
    if (data.results && data.results[0] && data.results[0].media && data.results[0].media[0]) {
      console.log(`Image URL: ${data.results[0].media[0].identifier}`);
    } else {
      console.log('No media found');
    }
  } catch (e) {
    console.error(e);
  }
}

testMedia();
