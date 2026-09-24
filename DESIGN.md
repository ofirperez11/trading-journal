---
version: beta
name: Workspace
description: A document-style trading journal. Every screen reads like a calm workspace page — warm-white canvas, a quiet sidebar of colour-coded pages, big bold page titles, soft hairline blocks, coloured select-property tags and callouts. Numbers carry the colour (green for profit, red for loss); chrome stays neutral.

colors:
  canvas: "#ffffff"
  surface: "#f7f7f5"
  surface-hover: "#fbfbfa"
  callout: "#f1f1ef"
  hairline: "#ededeb"
  hairline-soft: "#f1f1ef"
  ink: "#37352f"
  ink-secondary: "#5f5e5b"
  muted: "#787774"
  faint: "#91918e"
  divider-slash: "#c7c6c3"
  accent: "#2383e2"
  accent-hover: "#1a73c8"
  win: "#448361"
  loss: "#c4554d"
  today: "#eb5757"
  cover-fallback: "#e9e8e4"
  page-green: "#448361"
  page-blue: "#337ea9"
  page-purple: "#9065b0"
  page-orange: "#d9730d"
  page-yellow: "#cb912f"
  page-pink: "#c14c8a"
  tag-gray: "#e3e2e0"
  tag-gray-fg: "#32302c"
  tag-brown: "#eee0da"
  tag-brown-fg: "#442a1e"
  tag-orange: "#fadec9"
  tag-orange-fg: "#49290e"
  tag-yellow: "#fdecc8"
  tag-yellow-fg: "#402c1b"
  tag-green: "#dbeddb"
  tag-green-fg: "#1c3829"
  tag-blue: "#d3e5ef"
  tag-blue-fg: "#183347"
  tag-purple: "#e8deee"
  tag-purple-fg: "#412454"
  tag-pink: "#f5e0e9"
  tag-pink-fg: "#4c2337"
  tag-red: "#ffe2dd"
  tag-red-fg: "#5d1715"
  chart-neutral: "#d3d1cb"

typography:
  page-title:
    fontFamily: "Noto Sans Hebrew, ui-sans-serif, system-ui, sans-serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.2
  section-title:
    fontFamily: "Noto Sans Hebrew, ui-sans-serif, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 700
  block-title:
    fontFamily: "Noto Sans Hebrew, ui-sans-serif, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
  body:
    fontFamily: "Noto Sans Hebrew, ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  metric:
    fontFamily: "Noto Sans Hebrew, ui-sans-serif, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 700
    fontFeature: tabular-nums
  caption:
    fontFamily: "Noto Sans Hebrew, ui-sans-serif, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400

rounded:
  tag: 4px
  control: 6px
  callout: 8px
  block: 10px
  page-icon: 14px

spacing:
  sidebar-width: 248px
  page-max: 1100px
  page-max-wide: 1480px
  page-gutter-desktop: 64px
  page-gutter-mobile: 20px
  block-gap: 28px
---

## Overview

The journal is a set of **pages** in a workspace. One font (Noto Sans Hebrew) carries everything; hierarchy comes from size and weight, not from typeface changes. The single-font choice is deliberate: it's what makes the product read as a calm document rather than a dashboard.

## Structure

- **Sidebar** (desktop, fixed on the right in RTL; drawer on mobile): user header, "new trade" shortcuts, journal switcher, the journal's pages with colour-coded icons, then import / settings / sign-out at the bottom.
- **Breadcrumb bar**: `journal / page`, sticky, 44px.
- **Page**: optional full-width cover (dashboard: latest trade screenshot) → page icon overlapping the cover → bold title → property rows (label column + value) → blocks.

## Blocks

- **Panel / card**: white, 1px `hairline`, 10px radius, no shadow at rest.
- **Tag**: select-property chip — 4px radius, tinted bg + dark text from the `tag-*` pairs. Sides: long = blue, short = purple. Results: win = green, loss = red, BE = gray. Session time: 16:30 = yellow, 17:00 = orange.
- **Callout**: `callout` grey bg, leading icon, 15px text — used for insights.
- **Database block**: a heading, view tabs (table / gallery / board) with an ink underline on the active tab, then the view.
- **Link bar**: bordered strip of page links, each with a small coloured square.

## Colour rules

- Chrome is neutral; colour appears in page icons, tags and P&L numbers.
- Profit = `win`, loss = `loss`. Never use the tag greens/reds for text on white — they are backgrounds.
- `accent` blue is only for the primary action button and focus rings.

## Motion

- Blocks fade-up in sequence on page load (`.block-in` with `--i` for the stagger step, 60ms each).
- Charts draw in; calendar cells pop in with a small per-cell delay.
- Hover: rows and links get a `callout`/`surface` fill; gallery cards lift 2px with a soft shadow.
- All motion respects `prefers-reduced-motion`.

## Responsive

- `lg` (≥1024px): sidebar is fixed; below it collapses into a drawer behind a menu button.
- KPI cards: 2 columns on mobile, 4 on wide screens. Calendar hides per-day trade counts on mobile.
- The page never scrolls horizontally; wide tables scroll inside their own block.
