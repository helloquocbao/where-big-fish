import Link from 'next/link';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer-styled">
      <div className="footer-inner-styled">
        <div className="footer-logo-styled">WHERE BIG FISH</div>
        <nav className="footer-nav-styled">
          <Link href="/stories" className="footer-link-styled">
            Stories
          </Link>
          <Link href="/reports" className="footer-link-styled">
            Reports
          </Link>
          <Link href="/tackle" className="footer-link-styled">
            Tackle
          </Link>
          <Link href="/community" className="footer-link-styled">
            Community
          </Link>
        </nav>
        <p className="footer-copyright-styled">
          © {new Date().getFullYear()} Where Big Fish. All Rights Reserved. Editorial Magazine Style.
        </p>
      </div>
    </footer>
  );
}
