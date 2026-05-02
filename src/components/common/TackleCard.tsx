import Link from 'next/link';
import './TackleCard.css';

export default function TackleCard({ item }: { item: any }) {
  return (
    <div className="tackle-card group">
      <div className="tackle-img-box">
        <img src={item.heroImage} alt={item.title} />
        <span className="tackle-rating">★ {item.rating}</span>
      </div>
      <div className="tackle-body">
        <span className="tackle-cat">{item.category} • {item.brand}</span>
        <h3 className="tackle-h3">{item.title}</h3>
        <p className="tackle-p">{item.excerpt}</p>
        <Link href={`/tackle/${item.slug}`} className="tackle-link">
          FULL REVIEW <span className="material-symbols-outlined">arrow_right_alt</span>
        </Link>
      </div>
    </div>
  );
}
