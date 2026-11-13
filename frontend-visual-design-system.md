# Exotic Pet Keeper — Frontend Visual Design System

**Project:** Exotic Pet Keeper — Programming 5  
**Document version:** 1.2  
**Created:** 13 November 2026  
**Status:** Visual direction and two standalone animal illustrations approved; exact UI implementation tokens and further screen designs pending

> **Purpose:** This file is the single source of truth for frontend visual decisions. Attach it or paste its contents into a new ChatGPT conversation before continuing mockups, illustration generation, or frontend development. Update it whenever a visual decision changes.

## 1. Project context

Exotic Pet Keeper is a pet-management application for keepers of exotic animals (reptiles, amphibians, arachnids, and other invertebrates). Its planned frontend presents pets, enclosures, environmental sensor readings, alerts, and feeding records. The Programming 5 project already has a backend and existing architecture/API documentation. Frontend decisions must respect actual backend capabilities instead of assuming every element in a mockup is already implemented.

This is the **Programming 5 frontend**. Do not automatically merge scope or requirements from the separate UX Design course project, even if they share the same topic.

### Product experience goals

- **Welcoming and distinctive:** pleasant for people who care for unusual animals, not sterile enterprise software.
- **Professional and trustworthy:** important measurements, statuses, and records must be easy to scan.
- **Clear and usable:** illustrations support information rather than competing with it.
- **Scalable:** it should be realistic to create dozens of coherent animal, plant, and habitat assets over time.
- **Not childish:** friendly, but not cartoonishly exaggerated or visually cluttered.

## 2. Approved visual decisions (confirmed)

| Area | Decision |
| --- | --- |
| Overall style | **Soft Illustrative Cards** |
| Theme | **Light theme** |
| Color family | Warm cream, soft/sage greens, forest green, neutral dark text; distinct warning/error colors |
| Illustration approach | Soft flat-vector artwork of animals, terrariums, feeders, and plants; gentle layers and subtle shading |
| Animal portrayal | Stylized but anatomically recognizable; natural poses; avoid cute caricatures |
| Card treatment | Rounded cards, gentle shadows, soft backgrounds, illustrations integrated with restraint |
| Visual personality | Friendly, modern, organized, calm, professional |
| Data priority | Text, environmental readings, warnings, and actions must remain readable and prominent |
| Outlined nature art | **Not selected** as the overall illustration style |
| Illustrations in operational UI | Minimal around tables, sensor data, warnings, and dense controls; stronger in pet cards, overview cards, and empty states |

### The reference dashboard

The dashboard screenshot supplied in the design conversation is the **layout reference used to compare the four styles fairly**. It contains:

1. Dark forest-green left navigation with branding and links (Dashboard, Pets, Enclosures, Alerts).
2. Header with Dashboard title, subtitle, search, notification bell, and profile control.
3. Three summary tiles: Registered Pets, Enclosures, Active Alerts.
4. Recent Environmental Readings table.
5. Live Alerts panel.
6. My Pets cards.
7. Recent Feeding panel.

**Layout rule:** When refining or implementing *this approved dashboard concept*, preserve its information hierarchy and major component arrangement unless a change is explicitly discussed and approved. The screenshot is **not** a permanent pixel-perfect constraint for all future pages; other screens can have layouts appropriate to their function. Dates, values, pet names, and species in the image are illustrative mockup content, **not** fixed application data or definitive API contracts.

**Selected visual reference:** Version **4 — Soft Illustrative Cards** from the four-style comparison. Keep a copy of that mockup alongside this document when possible; this Markdown file describes the style but does not embed or replace the reference image.

## 3. Art direction: illustrations

### Must-haves

- Flat/soft-vector appearance, clean silhouettes, restrained detail, and subtle tonal shading or layering.
- Repeated visual rules for perspective, shadow softness, edge treatment, visual complexity, and color saturation.
- Recognizable species anatomy and proportions, even when simplified.
- Natural postures and readable forms at small card sizes.
- Flora, terrain, and terrarium decor in the same visual language.
- Objects should be easy to crop, scale, and reuse without losing important anatomy.
- No embedded labels or UI text in generated animal assets. Render text in frontend code.

### Avoid

- Photorealism, 3D renders, glossy effects, heavy black contour lines, watercolor inconsistencies, anime/chibi expressions, overly large eyes, or saturated neon colors.
- Decorative leaves that obscure values, status badges, navigation, or buttons.
- Unrecognizable generic animals presented as specific species.
- Inconsistent light directions, wildly varying perspectives, or different illustration styles between cards.

### Species accuracy examples

- A **leopard gecko** should have the appropriate body and tail form and distinctive spotting.
- A **ball python** should read as a robust snake with a broad back of the head, gently tapering snout, visible neck transition and continuous, anatomically plausible coils; never insert extra disconnected body sections for visual balance.
- A **crested gecko** should retain its characteristic crest and arboreal posture.
- A **tailless whip scorpion** is **not a true scorpion**: do not give it a scorpion tail or stinger; preserve its long whip-like sensory front legs and prominent pedipalps.
- A **tarantula** should keep an eight-legged spider body plan, not an insect body plan.

When generating a new species, describe its identifying physical traits explicitly and review the image before accepting it.

### Approved master illustration — Leopard Gecko (13 November 2026)

The illustration **Leopard Gecko — Concept 01** was approved after comparing transparent artwork in 170 px, 245 px and 335 px wide card mockups. It is the **primary reference for future individual animal illustrations** until an explicit decision supersedes it.

- **Original (preserve unchanged):** `design/illustrations/originals/leopard-gecko-concept-01.png` (transparent PNG, 1774 × 887 px).
- **Frontend export:** `frontend/public/assets/illustrations/animals/leopard-gecko.webp` (transparent, optimized WebP, 1400 × 700 px).
- **Card-size test:** `design/previews/leopard-gecko-card-test.html` and `design/previews/leopard-gecko-card-test.png`.
- **Dashboard style reference:** `design/references/dashboard-soft-illustrative-cards.png`.

**Approved visual language:** Moderately detailed soft digital illustration with a flat-vector-inspired visual construction, clean anatomy, carefully shaped tonal shading, clear features and natural species coloration. The illustrated gecko uses golden/cream skin with irregular brown spots and a proportionate thick tail, natural eye proportions, visible toes, and a calm three-quarter side view. The overall figure has a crisp, legible silhouette without thick black outlines or an exaggerated cartoon face. Use soft shading, restrained highlights, and a transparent asset background (plants, substrate, and card backdrops belong in separate layers).

**Approved detail level:** Retain the current detail for now; it tested well in compact and larger cards. Do not create a second simplified asset set unless a future real-world need justifies the maintenance cost. Future animals must match the visual richness, light direction, edge treatment, and rendering style without copying gecko-specific colors or anatomy.

**Scope of approval:** This approves the *animal illustration* and the idea of testing it at card sizes, **not** final card dimensions, UI colors/fonts, or a complete Pets page layout. The source is a PNG, not an editable SVG.

### Recommended asset workflow (guidance, not a finalized technical decision)

1. Define a reusable prompt with consistent style constraints.
2. Generate each species as a **separate asset**, preferably on transparent background if supported.
3. Inspect for anatomical errors, cropped legs/tails, artifacting, and off-style shading.
4. Approve one illustration as the quality benchmark, then compare subsequent artwork against it. For snakes, verify that the entire body follows a logical continuous path into a tapering tail before approval.
5. Export optimized assets appropriate for web use; use genuine SVG only when there is a real editable/vector source, not simply because artwork *looks* vector-like.
6. Keep original generations and production exports named predictably; use `leopard-gecko.webp` for the approved browser asset and preserve the original concept PNG separately.

**Important:** AI-generated mockup screenshots are references, **not** frontend source code. Actual interface copy, data, buttons, and status indicators must be implemented as accessible UI components.

## 4. UI component guidelines

- **Navigation/sidebar:** Keep the established forest-green identity, legible icons and labels, and a clearly distinguishable active destination.
- **Dashboard overview:** Rounded cards with soft backgrounds. Illustrations can occupy a supporting edge or corner, leaving numbers and labels unobstructed.
- **Pet cards:** Illustrations are welcome and relatively prominent; pet name, species, enclosure assignment, and available actions remain clearly readable.
- **Tables and sensor readings:** Reduce decoration; prioritize column alignment, units, readable numbers, statuses, and timestamps.
- **Alerts:** Use descriptive text and icons alongside warning colors. Active alerts must stand out more than decorative content.
- **Feeding history:** Favor scan-friendly text, dates, quantities, and species/food identifiers; illustrations, if present, should be small.
- **Icons:** Use a consistent functional icon family. Simple outlined *interface icons* are acceptable even though the full outlined-nature illustration style was rejected.
- **Buttons and inputs:** Distinct hover, focus, active, disabled, and error states will be needed when coding.
- **Responsive screens:** Preserve task priority on mobile; components may stack or reflow appropriately. Do not try to shrink a desktop dashboard unchanged onto a phone.

### Accessibility requirements

- Aim for WCAG 2.2 AA contrast and keyboard/focus usability.
- Never communicate an alert's meaning through color alone.
- Maintain appropriately sized targets for touch interaction (around 44 × 44 CSS px is a practical design target).
- Decorative images can be hidden from assistive technology; meaningful species illustrations need appropriate alternative text.
- Respect reduced-motion settings if future animations are added.

## 5. Proposed palette direction — **not yet approved**

The exact colors and fonts have **not** been chosen or tested together. These values are preliminary swatches for implementation experiments, not locked rules:

| Role | Example | Hex |
| --- | --- | --- |
| Page background | Warm ivory | `#FAF8F3` |
| Card surface | Soft off-white | `#FFFDF8` |
| Secondary surface | Pale sage | `#EAF0E0` |
| Main brand / sidebar | Forest green | `#25452D` |
| Supporting green | Leaf green | `#5B7D43` |
| Main text | Deep charcoal-green | `#203027` |
| Subdued text | Warm slate | `#59645B` |
| Error accent | Brick red | `#B63E2F` |

**Still to decide:** final tested palette, UI font, exact corner radius, shadow scale, spacing tokens, functional icon library, responsive breakpoints, and illustration export standards. We should test contrast and actual data-density before locking them.

## 6. Reusable master prompt — new UI screens

Copy the following into an image-generation or design conversation and attach the approved Soft Illustrative Cards dashboard mockup:

> Design a new screen for the **Exotic Pet Keeper** application, following our established **Soft Illustrative Cards** visual system. Use a light theme with warm cream surfaces, sage green and forest-green accents, soft rounded cards, gentle shadows, clear modern typography, and restrained flat-vector exotic animal and botanical illustrations. Maintain a friendly but professional appearance. Keep information, monitoring data, alerts, and actions more prominent than decorative artwork. Reuse the visual language of the attached approved dashboard mockup: consistent navigation, controls, cards, icon treatment, spacing character, and illustration rendering. Do not invent backend features or change existing product requirements. For this task, the screen is **[SCREEN NAME]** and it must show **[REQUIRED SECTIONS / ACTIONS / DATA]**. Preserve the arrangement of existing components where specified; otherwise organize new screen content for clear usability. Do not add unnecessary decorative elements. Produce a design mockup, not code.

## 7. Reusable master prompt — individual animal assets

> Create **one isolated illustration of [SPECIES]** for the Exotic Pet Keeper app in the approved **Soft Illustrative Cards** art style. Use clean flat-vector-like shapes, gentle tonal layers, restrained texture, soft shading, and natural, moderately stylized proportions. Keep the species anatomically recognizable, especially **[IDENTIFYING ANATOMICAL FEATURES]**. Use a natural pose and a palette compatible with warm cream, sage, and forest green UI surfaces while allowing appropriate natural coloration. No harsh heavy outlines, no photorealism, no 3D rendering, no oversized cartoon eyes, no labels, no logos, no app interface, and no unrelated objects. Show the whole animal with uncropped limbs and tail. Favor a transparent background so it can be placed in multiple cards. Match the visual complexity and light direction of our approved asset examples.

For terraria, plants, feeder insects, or empty-state illustrations, replace the species-specific anatomy instructions with equally precise subject requirements.

## 8. Frontend implementation guardrails

- Confirm real API routes and existing backend behavior from `docs/api-design.md` and `docs/architecture.md` before implementing data-driven screens.
- Do not treat screenshot mockup values or dates as live backend output.
- Implement the interface in reusable components, with shared design tokens and predictable asset filenames.
- Separate presentational assets from business logic, service calls, authentication, and WebSocket updates.
- Preserve clear state handling for loading, empty, errors, sensor thresholds, and realtime alerts.
- Maintain source files and this guide in Git so the project can continue across conversations.
- Do not add features simply because image generation included them in a mockup.

## 9. Decision log

| Date | Decision | State |
| --- | --- | --- |
| 2026-11-13 | Use the supplied dashboard UI layout as a fixed baseline **for comparing visual styles** | Confirmed |
| 2026-11-13 | Choose a light theme and a nature-inspired cream/green color family | Confirmed |
| 2026-11-13 | Reject the Outline / Line-Art Nature UI option | Confirmed |
| 2026-11-13 | Select **Soft Illustrative Cards** as the visual style | Confirmed |
| 2026-11-13 | Keep illustrations species-recognizable, welcoming, and not overly childish | Confirmed direction |
| 2026-11-13 | Finalize exact hex colors, fonts, spacing, responsive rules, and component tokens | **Open** |
| 2026-11-13 | Approve Leopard Gecko — Concept 01 as the first master illustration, after three card-size tests | **Confirmed** |
| 2026-11-13 | Extend the approved animal illustration reference set (tarantula, tailless whip scorpion) | **Open** |
| 2026-11-13 | Approve Ball Python illustration after revising the head anatomy and removing unnatural extra coils; preserve transparent PNG source and optimized WebP | **Confirmed** |
| 2026-11-13 | Create a generic and common-species illustration roadmap across animal groups before expanding the asset library further | **Planned, not yet defined** |

## 10. Handoff checklist for a new conversation

Share these items when relevant:

1. **This document** (latest version).
2. **Approved dashboard reference image** (Soft Illustrative Cards version) and `design/illustrations/originals/leopard-gecko-concept-01.png` and `design/illustrations/originals/ball-python-approved.png` as the two approved animal references.
3. If doing frontend implementation: `README.md`, `docs/api-design.md`, `docs/architecture.md`, and relevant frontend/backend code or repository details.
4. Briefly specify the immediate task and whether the work is **mockup**, **asset illustration**, or **functional frontend code**.

Suggested opening message:

> We're continuing the Programming 5 **Exotic Pet Keeper** frontend. Read the attached `frontend-visual-design-system.md` as our current design agreement. Our approved direction is **Soft Illustrative Cards**, light theme, friendly/professional, species-recognizable soft vector illustrations, and clear monitoring data. The attached dashboard image is our approved visual reference. Treat the document's **confirmed** decisions as fixed; the **open** items are not yet approved. Do not redesign established layout or invent backend features without discussing the change. Our next task is: **[TASK]**.

---

**Maintenance rule:** When a new decision is made, update the relevant section, add an entry to the decision log, and increment the version number if the change is substantive. This makes the file useful both to a future assistant and to the developer working in Git.
