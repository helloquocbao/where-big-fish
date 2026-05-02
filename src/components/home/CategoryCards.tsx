import Link from 'next/link';
import './CategoryCards.css';

const categories = [
  {
    id: 'freshwater',
    title: 'FRESHWATER',
    icon: '💧',
    description: 'Inland rivers, lakes, and hidden basins where monsters dwell.',
    link: '/freshwater',
  },
  {
    id: 'saltwater',
    title: 'SALTWATER',
    icon: '⚓',
    description: 'The vast open ocean and deep sea trenches of the giants.',
    link: '/saltwater',
  },
  {
    id: 'brackish',
    title: 'BRACKISH',
    icon: '🌿',
    description: 'Estuaries and coastal deltas where two worlds collide.',
    link: '/brackish',
  },
];

export default function CategoryCards() {
  return (
    <section className="categories-section">
      <div className="container">
        <div className="categories-grid">
          {categories.map((cat) => (
            <Link href={cat.link} key={cat.id} className="category-card">
              <span className="category-tag">ENVIRONMENT</span>
              <div className="category-icon">{cat.icon}</div>
              <h3 className="category-title">{cat.title}</h3>
              <p className="category-desc">{cat.description}</p>
              <span className="category-explore">VIEW LISTING →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
