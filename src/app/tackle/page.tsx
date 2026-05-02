import fs from 'fs';
import path from 'path';
import TackleCard from '@/components/common/TackleCard';
import Sidebar from '@/components/layout/Sidebar';
import '../stories/stories.css';

export default function TacklePage() {
  const dataPath = path.join(process.cwd(), 'src/data/tackle/index.json');
  const tackleData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  return (
    <div className="home-container">
      <div className="editorial-header">
        <h1 className="editorial-title">Masterclass Tackle</h1>
        <p className="editorial-subtitle">Pro-grade gear reviews and tactical equipment breakdowns.</p>
      </div>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="stories-grid">
            {tackleData.map((item: any) => (
              <TackleCard key={item.slug} item={item} />
            ))}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
