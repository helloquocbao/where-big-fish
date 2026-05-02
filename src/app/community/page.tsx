import Sidebar from '@/components/layout/Sidebar';
import '../stories/stories.css';

export default function CommunityPage() {
  return (
    <div className="home-container">
      <div className="editorial-header">
        <h1 className="editorial-title">Angler Community</h1>
        <p className="editorial-subtitle">
          The heartbeat of the sport. Connect with legendary captains and local experts.
        </p>
      </div>

      <div className="home-main-grid">
        <div className="content-canvas">
          <div
            className="community-cta-box"
            style={{
              backgroundColor: 'var(--primary-container)',
              padding: '64px',
              borderRadius: '4px',
              textAlign: 'center',
              color: 'white',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '80px', marginBottom: '24px' }}
            >
              groups
            </span>
            <h2
              style={{ fontSize: '48px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}
            >
              Coming Soon: The Fleet Forum
            </h2>
            <p style={{ fontSize: '20px', opacity: 0.8, maxWidth: '700px', margin: '0 auto 40px' }}>
              We are currently building a high-end platform for our readers to share reports, gear
              advice, and coordinate expeditions. Join the newsletter to be the first to know.
            </p>
            <button className="hero-epic-btn" style={{ margin: '0 auto' }}>
              JOIN THE WAITLIST
            </button>
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
