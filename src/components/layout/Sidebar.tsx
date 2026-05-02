'use client';

import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Sidebar Ad Widget */}
      <div className="sidebar-ad-box">
        <span className="ad-label-styled">SPONSORED</span>
        <div className="ad-box-rectangle">
          <span>Sidebar Ad 300x250</span>
        </div>
      </div>

      {/* Trending Now */}
      <div className="trending-box">
        <h3 className="trending-header">
          <span className="material-symbols-outlined">trending_up</span>
          Trending Now
        </h3>
        <ul className="trending-ul">
          <li className="trending-li group">
            <span className="trending-num num-1">1</span>
            <div className="trending-li-content">
              <h4>State Record Halibut Landed in Alaska</h4>
              <span className="trending-li-meta">NEWS • 2 HRS AGO</span>
            </div>
          </li>
          <li className="trending-li group">
            <span className="trending-num num-2">2</span>
            <div className="trending-li-content">
              <h4>Top 10 Saltwater Lures for 2024</h4>
              <span className="trending-li-meta">GEAR REVIEW • 5 HRS AGO</span>
            </div>
          </li>
          <li className="trending-li group">
            <span className="trending-num num-3">3</span>
            <div className="trending-li-content">
              <h4>The Ethics of Catch and Release</h4>
              <span className="trending-li-meta">EDITORIAL • 1 DAY AGO</span>
            </div>
          </li>
          <li className="trending-li group">
            <span className="trending-num num-4">4</span>
            <div className="trending-li-content">
              <h4>Weather Patterns: Reading the Barometer</h4>
              <span className="trending-li-meta">MASTERY • 2 DAYS AGO</span>
            </div>
          </li>
        </ul>
      </div>

      {/* Newsletter Widget */}
      <div className="newsletter-box-dark">
        <span className="material-symbols-outlined newsletter-icon">mail</span>
        <h4 className="newsletter-h4">Join the Fleet</h4>
        <p className="newsletter-p">Pro-grade narratives delivered to your inbox weekly.</p>
        <form className="newsletter-form-styled">
          <input
            type="email"
            placeholder="Enter your email address"
            className="newsletter-input-styled"
          />
          <button type="button" className="newsletter-submit">
            SUBSCRIBE
          </button>
        </form>
      </div>
    </aside>
  );
}
