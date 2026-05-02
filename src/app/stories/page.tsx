import fs from 'fs';
import path from 'path';
import LocationCard from '@/components/common/LocationCard';
import './stories.css';

import Sidebar from '@/components/layout/Sidebar';
import './stories.css';

export default function StoriesPage() {
  const dataPath = path.join(process.cwd(), 'src/data/locations/index.json');
  const allData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const stories = allData.filter((item: any) => item.contentType === 'story');

  return (
    <div className="home-container">
      <div className="editorial-header">
        <h1 className="editorial-title">Editorial Stories</h1>
        <p className="editorial-subtitle">
          Deep dives into the world's most legendary fishing expeditions.
        </p>
      </div>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="stories-grid">
            {stories.map((story: any) => (
              <LocationCard key={story.slug} location={story} />
            ))}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
