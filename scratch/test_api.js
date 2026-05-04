
async function testAPI() {
  const query = 'game fish';
  const limit = 5;
  const GBIF_BASE_URL = 'https://api.gbif.org/v1';
  
  try {
    const response = await fetch(`${GBIF_BASE_URL}/species/search?q=${encodeURIComponent(query)}&limit=${limit}&rank=SPECIES&status=ACCEPTED`);
    const data = await response.json();
    console.log('GBIF Results:');
    data.results.forEach((item, index) => {
      console.log(`${index + 1}: ${item.scientificName} (${item.canonicalName})`);
      console.log(`   Vernacular: ${item.vernacularNames?.[0]?.vernacularName}`);
      console.log(`   Kingdom: ${item.kingdom}, Class: ${item.class}`);
    });
  } catch (e) {
    console.error(e);
  }
}

testAPI();
