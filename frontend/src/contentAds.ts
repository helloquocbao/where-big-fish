/** One content ad per page. Never imported by the gameplay entry. */
const placement = document.querySelector<HTMLElement>('[data-content-ad]');
const client = import.meta.env.VITE_ADSENSE_CLIENT_ID || document.querySelector<HTMLMetaElement>('meta[name="google-adsense-account"]')?.content;
const slot = import.meta.env.VITE_ADSENSE_SLOT_CONTENT;
const preview = import.meta.env.DEV;

if (placement) {
  if (preview) {
    placement.hidden = false;
    placement.classList.add('content-ad-preview');
    const note = document.createElement('p');
    note.textContent = 'Ad placement preview · No live ad request';
    placement.appendChild(note);
  } else if (/^ca-pub-\d{16}$/.test(client ?? '') && /^\d+$/.test(slot ?? '')) {
    placement.hidden = false;
    let requested = false;
    const observer = new IntersectionObserver(entries => {
      if (requested || !entries.some(entry => entry.isIntersecting) || document.hidden || placement.clientWidth === 0) return;
      requested = true;
      observer.disconnect();
      const ad = document.createElement('ins');
      ad.className = 'adsbygoogle';
      ad.style.display = 'block';
      ad.dataset.adClient = client;
      ad.dataset.adSlot = slot;
      ad.dataset.adFormat = 'auto';
      ad.dataset.fullWidthResponsive = 'true';
      placement.appendChild(ad);
      // Only Google's explicit unfilled result collapses the slot; do not time out a slow ad.
      new MutationObserver((_changes, monitor) => {
        if (ad.dataset.adStatus === 'unfilled') { placement.hidden = true; monitor.disconnect(); }
        else if (ad.dataset.adStatus === 'filled') monitor.disconnect();
      }).observe(ad, { attributes: true, attributeFilter: ['data-ad-status'] });
      const win = window as Window & { adsbygoogle?: Record<string, never>[] };
      win.adsbygoogle = win.adsbygoogle || [];
      win.adsbygoogle.push({});
      if (!document.querySelector('script[data-content-adsense]')) {
        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.contentAdsense = 'true';
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
        script.addEventListener('error', () => { placement.hidden = true; }, { once: true });
        document.head.appendChild(script);
      }
    }, { rootMargin: '0px' });
    observer.observe(placement);
  }
}
