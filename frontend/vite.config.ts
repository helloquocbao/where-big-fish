import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'node:fs';
import { FISH_CATALOG, LAKE_DEFINITIONS } from '@bomio/shared';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const lakes = `<div class="catalog">${LAKE_DEFINITIONS.map(lake => `<section><h3>${escape(lake.name)}</h3><p>${Object.entries(lake.fishWeights).filter(([, weight]) => weight > 0).map(([id]) => escape(FISH_CATALOG.find(fish => fish.id === id)?.name ?? id)).join(', ')}.</p></section>`).join('')}</div>`;
const fish = `<div class="table-wrap"><table><caption>${FISH_CATALOG.length} entries in the current catch catalog</caption><thead><tr><th scope="col">Catch</th><th scope="col">Rarity</th><th scope="col">Base value</th></tr></thead><tbody>${FISH_CATALOG.map(fish => `<tr><th scope="row">${escape(fish.name)}</th><td>${escape(fish.rarity)}</td><td>${fish.value.toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table></div>`;
export default defineConfig(({ mode }) => {
  const publisher = readFileSync(resolve(__dirname, "public/ads.txt"), "utf8").match(/pub-\d{16}/)?.[0];
  const account = loadEnv(mode, __dirname, "VITE_ADSENSE_CLIENT_ID").VITE_ADSENSE_CLIENT_ID || (publisher ? `ca-${publisher}` : "");
  const verification = /^ca-pub-\d{16}$/.test(account ?? "") ? `<meta name="google-adsense-account" content="${account}">` : "";
  return {
  plugins: [{ name: 'public-field-guide', transformIndexHtml(html) { return html.replace('<!-- LAKE_CATALOG -->', lakes).replace('<!-- FISH_CATALOG -->', fish).replace('</head>', `${verification}</head>`); } }],
  build: { rollupOptions: { input: {
    main: resolve(__dirname, 'index.html'),
    play: resolve(__dirname, 'play/index.html'),
    guide: resolve(__dirname, 'guide.html'),
    fieldGuide: resolve(__dirname, 'field-guide.html'),
    about: resolve(__dirname, 'about.html'),
    policy: resolve(__dirname, 'policy.html'),
  } } },
  };
});
