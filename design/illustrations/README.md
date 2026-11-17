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

## Tarantula — APPROVED (13 November 2026)

- **Master original:** `originals/tarantula-approved.png` (keep unchanged, transparent PNG; 1536 × 1024 px).
- **Browser-ready asset:** `frontend/public/assets/illustrations/animals/tarantula.webp` (repository-root path; optimized transparent WebP).
- **Card-size test:** `design/previews/tarantula-card-test.html` and `.png`.
- **Art direction:** female-like full abdomen and robust terrestrial body, dark brown and rust-orange hair/banding, moderate-to-high visual detail consistent with the approved gecko and ball python.
- **Anatomy review:** four walking legs on EACH side and two shorter pedipalps, clearly separate from walking legs. Pedipalps are present in females and males, and adult males of many species have modified palpal bulbs. Do not mistake palps for an additional walking-leg pair.
- **Reference workflow:** user supplied a real tarantula photograph to help resolve repeated incorrect leg counts. Use reference photographs when complex animal anatomy is hard to generate, then independently inspect the illustrated limb count and connections. The photograph is **not** part of the distributed asset package.
- **Asset separation:** keep the transparent animal cutout isolated; overlays and backdrops are rendered in UI, not embedded in the asset.

## Scorpion — APPROVED (13 November 2026)

- **Master original:** `originals/scorpion-approved.png` (1254 × 1254, true transparent PNG).
- **Browser-ready asset:** `frontend/public/assets/illustrations/animals/scorpion.webp` (root-relative path, transparent WebP).
- **Card-size test:** `design/previews/scorpion-card-test.html` and `.png`.
- **Art direction:** emperor-scorpion-inspired appearance with dark brown / bronze armored shell, large pedipalp pincers, high curved five-segment tail and a clear terminal stinger.
- **Accuracy note:** four pairs of walking legs (some may overlap behind pincers in a three-quarter pose), with median eyes small and central on top of the carapace. Do not place large eyes on the side like a cartoon.
- **Naming:** use `scorpion` rather than a definitive species name until the product needs species-specific artwork.

## Desert habitat — APPROVED (17 November 2026)

- **Master original:** `originals/desert-habitat-approved.png` (preserve unchanged, transparent PNG; 1672 × 941 px).
- **Browser-ready asset:** `frontend/public/assets/illustrations/enclosures/desert-habitat.webp` (repository-root path; optimized transparent WebP).
- **Art direction:** soft flat-vector-inspired habitat illustration matched to the approved tropical habitat's composition and rendering style, but using sandy terrain, warm beige and ochre rocks, a rocky hide, sparse succulents, dry grasses, a curved dry branch, and a shallow stone water dish.
- **Composition rule:** keep a broad central rock platform and enough open space for the featured animal overlay in the Enclosure Details view.
- **Integration scope:** approved for enclosure habitat presentation only; preserve existing animal scaling and positioning adjustments when displayed in the UI.

## Next phase — Illustration roadmap (not yet defined)

Define a manageable list of generic category illustrations and representative common species for snakes, frogs, lizards, tarantulas and other exotic animals. Do not silently treat suggestions from prior chats as final commitments. The tailless whip scorpion illustration has been deferred rather than approved.


Generate and approve **one animal at a time**. Preserve originals in this directory and use descriptive, stable filenames for optimized WebP files. Add a new line to `frontend-visual-design-system.md`'s decision log after each approval.

## Temperate habitat - Concept 02 APPROVED (17 November 2026)

- **Approved original:** `design/illustrations/originals/temperate-habitat-approved.png` (1672 x 941 RGBA PNG; preserve unchanged).
- **Frontend export:** `frontend/public/assets/illustrations/enclosures/temperate-habitat.webp` (optimized transparent WebP on a 1672 x 941 canvas).
- **Art direction:** soft temperate forest with restrained, smooth branch textures, mossy hollow-log shelter on the left, broad central stone platform, water bowl on the right, ferns and oak leaves; revised to align composition and animal placement with Tropical and Desert.
- **Integration:** Enclosure Details only; keep approved animal illustrations and their positioning adjustments unchanged.

## Paludarium habitat - APPROVED (17 November 2026)

- **Original:** `design/illustrations/originals/paludarium-habitat-approved.png` (1672 x 941, transparent PNG; preserve unchanged).
- **Frontend export:** `frontend/public/assets/illustrations/enclosures/paludarium-habitat.webp` (optimized transparent WebP).
- **Art direction:** soft naturalistic paludarium with left hollow-log hide, right curved leafy tree, broad dry central stone platform, and shallow clear water occupying the foreground. No waterfall or redundant water dish.
- **Integration:** Enclosure Details habitat preview only. Preserve approved animal image transforms and name alignment.

## Aquatic habitat - APPROVED (17 November 2026)

- **Original:** `design/illustrations/originals/aquatic-habitat-approved.png` (1672 x 941, transparent PNG; preserve unchanged).
- **Frontend export:** `frontend/public/assets/illustrations/enclosures/aquatic-habitat.webp` (optimized transparent WebP).
- **Art direction:** underwater habitat illustration preserving the projectâ€™s established composition: submerged hollow-log hide on the left, broad central stone platform for featured animals, and curved tree-root structure on the right, with blue-green water, pebbles, rocks, and aquatic plants.
- **Integration:** Enclosure Details habitat preview only. Preserve approved animal image transforms and name alignment.
