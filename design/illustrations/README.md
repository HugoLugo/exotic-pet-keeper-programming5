# Exotic Pet Keeper — Illustration asset catalog

## Leopard gecko — APPROVED (13 November 2026)

- **Master original**: `originals/leopard-gecko-concept-01.png` (keep unchanged).
- **Browser-ready asset**: `../../frontend/public/assets/illustrations/animals/leopard-gecko.webp` (path relative to the repository root is `frontend/public/assets/illustrations/animals/leopard-gecko.webp`).
- **Card test**: `../previews/leopard-gecko-card-test.html` (open in a browser; the relative image path works when the package folders remain intact).
- **Visual benchmark**: moderately detailed soft flat-vector-inspired illustrations with transparent background and recognizable anatomy; see `frontend-visual-design-system.md` §3.

The browser WebP is a raster image even if the illustration has a vector-inspired appearance. Do not rename the file to `.svg`.

## Ball python — APPROVED (13 November 2026)

- **Master original:** `originals/ball-python-approved.png` (keep unchanged, true transparency).
- **Browser-ready asset:** `frontend/public/assets/illustrations/animals/ball-python.webp` (repository-root path).
- **Card test:** `design/previews/ball-python-card-test.html` and `.png`.
- **Art direction:** broader posterior head, gently tapering muzzle, visible heat pits, thick body, warm natural-pattern markings.
- **Anatomy rule:** do not invent extra coils for decorative balance. The head, body loops, and narrowing tail must read as one continuous animal.
- **Asset separation:** rocks, foliage, gradients, shadows and other habitat decoration should be added in UI layers, not baked into the isolated animal image.

## Next planned references (not yet approved)

1. Tarantula
2. Tailless whip scorpion

A broader generic/category/common-species illustration roadmap has been discussed but is **not yet specified**; do not treat any species list as final.

Generate and approve **one animal at a time**. Preserve originals in this directory and use descriptive, stable filenames for optimized WebP files. Add a new line to `frontend-visual-design-system.md`'s decision log after each approval.
