# Showtime — Design Language

## Named Aesthetic: "Late Night Rental"

The feeling of walking into a video store at 10pm. Warm incandescent light over dark shelves. The weight of a VHS case in your hand. Browsing is the experience — not a search, not a grid, but a *wander*. Every screen should feel like you're moving through a physical space, not a database.

Influences: Blockbuster at closing time, neon-lit Tokyo convenience stores, the inside cover of a Criterion Blu-ray.

---

## Typography

**Display — Bebas Neue**
Used for: movie titles on cards, section headings, stat numbers, the app name.
Why: condensed, cinematic, zero ambiguity. Looks like it belongs on a VHS spine or a marquee. Not a "tech startup" font.

**Body — Outfit**
Used for: descriptions, labels, metadata, notes, anything paragraph-length.
Why: geometric but warm. Distinguishes itself from Inter without being quirky. Reads cleanly at small sizes on mobile.

**Accent / Ratings — DM Serif Display (italic only)**
Used for: pull quotes, empty states, the random picker result reveal.
Why: one serif moment in an otherwise sans-serif UI creates a deliberate pause. Use sparingly.

```
font-display: 'Bebas Neue', sans-serif;
font-body:    'Outfit', sans-serif;
font-accent:  'DM Serif Display', serif;
```

**Scale (mobile-first, rem):**
| Token | Size | Usage |
|---|---|---|
| `text-xs` | 0.75rem | platform badges, timestamps |
| `text-sm` | 0.875rem | metadata, secondary labels |
| `text-base` | 1rem | body text, notes |
| `text-lg` | 1.125rem | card subtitles |
| `text-2xl` | 1.5rem | section headings (Outfit) |
| `text-4xl` | 2.25rem | movie title on detail page (Bebas Neue) |
| `text-6xl` | 3.75rem | stat numbers (Bebas Neue) |

Letter-spacing on Bebas Neue: `tracking-wide` (0.05em). Never tighter.

---

## Color

**Philosophy:** Warm blacks, not cold blacks. The darkness here is analog — felt curtains, not OLED. Every neutral leans amber, never blue-gray.

### Palette

```
--color-void:       #0A0906   /* page background — warm near-black */
--color-surface:    #161310   /* card backgrounds, drawers */
--color-raised:     #211D19   /* elevated surfaces, modals */
--color-border:     #2E2822   /* dividers, card outlines */

--color-text-primary:   #F0E8DC   /* warm off-white, not pure white */
--color-text-secondary: #8C7E6E   /* muted labels */
--color-text-ghost:     #4A3F35   /* placeholders, disabled */

--color-amber:      #F5A623   /* primary accent — neon sign amber */
--color-amber-dim:  #7A5212   /* hover states, muted amber */
--color-red:        #C0392B   /* watched indicator, destructive */
--color-red-dim:    #5C1A13   /* muted red, badges */

--color-white:      #F0E8DC   /* same as text-primary — intentional */
```

**Rules:**
- Background is always `--color-void`. Never pure `#000000`, never `#111827` (too blue).
- Accent color is amber (`#F5A623`), not white and not red. Red is reserved for "watched" state and destructive actions only.
- No gradients except one: a vertical `linear-gradient(to bottom, transparent, --color-void)` at the bottom of poster images to bleed into the background. That's it.
- No purple. No teal. No blue of any kind except inside external platform badges (Netflix red, Prime blue) which are treated as foreign objects with their own rules.
- Shadows use `rgba(0,0,0,0.6)` — strong, warm-black. Never colored shadows.

### Streaming Platform Badges
Platform badges are the one place external brand colors appear. Render them as small pill labels using the platform's own color — but desaturated by 20% so they don't fight the warm palette.

---

## Spacing Philosophy

**Touch targets first.** Minimum 44×44px for anything interactive. On mobile, buttons span full width or are at least thumb-reachable from the bottom of the screen.

**Vertical rhythm: 8px base unit.**
Spacing tokens: 4, 8, 12, 16, 24, 32, 48, 64, 96px. Nothing outside this set.

**Generous gutters.** Page padding: `px-4` (16px) on mobile, `px-8` (32px) on tablet+. Cards don't touch the screen edge.

**The shelf, not the grid.**
The main watchlist is a set of horizontal scrolling shelves (one per status or filter group), not a CSS grid. Each shelf shows ~1.5 posters on mobile (the half-poster signals scrollability). Aspect ratio for all posters: **2:3** (standard movie poster). No landscape thumbnails.

This is the single most important layout decision. A grid of equal rectangles looks like every streaming app. A shelf you drag through looks like a store.

**Detail pages breathe.** The title detail page opens with the poster filling the top 50% of the viewport (on mobile). Text content starts below the fold — scroll to read. This creates a deliberate beat: *look first, read second.*

**Empty states are not errors.** Empty shelves show a dim placeholder message in DM Serif Display italic — something human, not a CTA. No "Add your first movie!" energy.

---

## Motion

Minimal. This is a browsing app, not a dashboard.

- Shelf scroll: native `overflow-x: scroll` with `scroll-snap-type: x mandatory`. No JS carousels.
- Poster hover (desktop): `scale(1.04)` + subtle amber border glow. 150ms ease-out. That's it.
- Random picker reveal: the result poster flips in with a single `rotateY(180deg)` — like flipping a physical case over. 400ms ease-in-out.
- No skeleton loaders with shimmer animations. Use a simple `opacity: 0.4` static placeholder instead.
- No page transitions. The browser's default navigation is fine.

---

## Component Notes

**Poster card:** The poster IS the card. No white box around it, no title-below-poster layout. Title overlays on hover/tap via a bottom gradient. Genre badges sit at the top-left corner of the poster.

**Star rating:** Five amber stars (`★`), filled/unfilled. Not a slider, not a number input. Tap to rate on mobile.

**Watched indicator:** A thin red bar across the top edge of the poster — like the sticker a rental store puts on returned tapes.

**Random picker button:** Large, full-width, amber. Text in Bebas Neue. Feels like a slot machine lever, not a form submit.

**Navigation:** Bottom nav bar on mobile (thumb zone). Four items max: Watchlist, Discover, Stats, Search. No hamburger menu.

---

## What This Is Not

- Not a Notion-style data table
- Not a movie review blog (no editorial voice in the UI chrome)
- Not a social app (no likes, no follower counts, no avatars in feeds)
- Not Netflix (no autoplay, no "because you watched", no hero banner)

The UI gets out of the way. The movies are the content.
