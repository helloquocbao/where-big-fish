const fs = require('fs');
const path = require('path');

const dataPath = path.join(process.cwd(), 'src/data/locations/index.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const updatedData = data.map((item, index) => {
  // Distribute content types
  let contentType = 'report';
  if (item.featured || item.difficulty === 'Hard') {
    contentType = 'story';
  }
  
  // Every 5th item make it tackle related if it has specific tags? 
  // No, let's just stick to story/report for locations.
  
  return {
    ...item,
    contentType
  };
});

fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
console.log('Updated index.json with content types.');
