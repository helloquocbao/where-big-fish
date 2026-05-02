import fs from 'fs';
import path from 'path';
import LocationCard from '@/components/common/LocationCard';
import Sidebar from '@/components/layout/Sidebar';
import '../stories/stories.css';

export default function ReportsPage() {
  const dataPath = path.join(process.cwd(), 'src/data/locations/index.json');
  const allData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const reports = allData.filter((item: any) => item.contentType === 'report');

  return (
    <div className="home-container">
      <div className="editorial-header">
        <h1 className="editorial-title">Field Reports</h1>
        <p className="editorial-subtitle">The latest tactical dispatches directly from the water.</p>
      </div>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div className="stories-grid">
            {reports.map((report: any) => (
              <LocationCard key={report.slug} location={report} />
            ))}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
