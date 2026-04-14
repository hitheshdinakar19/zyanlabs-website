# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZyanLabs is a static marketing website for a digital growth systems agency. It has no build system, backend, or package manager — just vanilla HTML/CSS/JS served directly.

## Running Locally

```bash
# Python (usually available)
python -m http.server 8000

# Or Node.js
npx http-server
```

## Architecture

**Pages:**
- `index.html` — Main landing page with hero, service cards, about section, and contact form
- `zyan-core.html` — Product page: high-performance website development
- `zyan-flow.html` — Product page: automated lead generation / WhatsApp automation
- `zyan-scale.html` — Product page: CRO and continuous growth service

**Shared assets:**
- `style.css` — All styling across every page (dark theme, glassmorphism, responsive grid)
- `script.js` — All interactivity: tsParticles animation, card 3D tilt effects, `selectProduct()` contact form auto-fill, budget slider, partial chat widget

**External dependencies (CDN only):**
- `tsParticles v2` — Canvas-based particle background animation
- Google Fonts — Poppins typeface

## Key Patterns

- Dark theme: background `#0f172a`, accent colors `#3b82f6` (blue) and `#9333ea` (purple)
- Responsive breakpoints: 1024px and 768px (3-column grid collapses to 1-column)
- Card 3D tilt is applied via `mousemove` listeners to `.service-card` elements in `script.js`
- `selectProduct(name)` pre-fills the contact form's service dropdown when called from product page CTAs

## Known Incomplete Areas

- Contact form `action` attribute is empty — no backend submission endpoint wired up
- Chat widget DOM elements exist in HTML but the implementation in `script.js` is partial
- Budget slider (`budgetRange`, `currencySelect`, `budgetText`) references elements that are not present in the current HTML
