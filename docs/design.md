# Where Big Fish — Cozy Lakeside

Frontend design system, approved scope: map appearance, UI and interaction guidance using the existing production backend.

- Genre: playful, quiet lakeside outing; preserve chibi characters and live world.
- App structure: live canvas with compact corner instruments; central dialogs only when needed.
- Entry: expedition label, title, character picker, name and primary Play action.
- Palette: cream paper #fffaf0, dark pine #234c43, muted pine #60796c, lake #327b79, sun #f0c76b.
- Typography: existing Baloo 2 display and system body font, upright headings.
- Spacing: 4/8/12/16/24/32 px; rounded panels, thin borders, restrained shadow.
- Motion: short hover/press feedback; respect reduced motion.
- World: decorative shore signs placed only on land, no change to lake geometry/collision.
- Gameplay UX: contextual advice for idle, casting, waiting, reeling; server rules remain authoritative.
- Content pages share palette and buttons. No new dependency or backend contract.

## Gameplay HUD refinement
- Session location and two numeric stats at top-left.
- Keyboard-accessible collapsible ranking at top-right with aligned score column.
- Field guide and sound in bottom-left dock; minimap bottom-right; instruction pill centered.
- Reel panel: pale lake channel, green target zone, separate progress meter and numeric percentage; anonymous fish until caught.
- Compact landscape layout for short screens; mobile controls retain their original bindings.

## Public information architecture
- Home is a scrollable editorial introduction with visible content; game lives at /play/.
- How to play, Fish & lakes and About use content.css, shared typography/palette and persistent navigation.
- Catalog HTML is rendered by Vite from shared data at build time, available without client JavaScript.
- No ads or placeholders in gameplay. Publisher verification uses the AdSense account meta tag from the existing production environment.

## Landing revision: play first
Full-width game scenery, large game title, chibi and a dominant Play CTA above the fold. Keep accessible, scrollable explanatory content below. Use the real renderer with no network/game session; pause animation offscreen.
