# Glyphs

Twenty-four drawings for catalogue records, in three sets. Open `contact-sheet.html`
to see them all at once.

## The three sets, and why they rank the way they do

Counting the twenty backfill records settled this, and it overturned the obvious
design:

- **18 of 20 records are `protein`.** A mark for the medium would stamp the same
  glyph on nine cards in ten, so it cannot carry the browse page.
- **10 of 20 are a binder of some kind**, and the rest spread across six other
  functions. Function separates the collection best.
- **7 of 20 name a pathogen anywhere.** For the half that are binders, what they
  act on is what distinguishes them.

So:

| Set | Role | Count | Size |
|---|---|---|---|
| `function/` | the primary mark; what the designed thing does | 7 | 56 × 56 |
| `subject/` | the plate; what it acts on | 10 | 140 × 110 |
| `medium/` | a quiet corner hallmark; what it is made of | 7 | 48 × 48 |

A plate is assembled from all three: subject engraving as the ground, function
emblem as the figure, hallmark stamped in the corner.

## Colour

Every glyph paints through CSS custom properties with sane fallbacks, so an
`<img src="/glyphs/function/binder.svg">` renders correctly with no styling at
all, and an inlined copy follows whatever the page sets:

| Token | Default | Used for |
|---|---|---|
| `--glyph-ink` | `#1c1b17`, or the medium's own ink on a hallmark | the main line |
| `--glyph-fill` | `#efe9d8` | the body of a filled form |
| `--glyph-haze` | `#b5af99` | hatching and construction lines |
| `--glyph-accent` | `#9a4a22` | the part that was designed |
| `--glyph-accent-fill` | `#f7e2d6` | the designed part's body |
| `--glyph-paper` | `#fbf9f1` | the hallmark's disc |

CSS custom properties do not cross into an SVG loaded through `<img>`, so an
`<img>` always gets the fallbacks. Inline the file if a page needs to recolour it.

The medium inks differ in lightness as well as hue, so the set survives greyscale
printing and does not rely on colour vision. Every glyph also differs in outline,
so colour never carries meaning on its own.

## Conventions worth keeping

- The three nucleic-acid parts follow **SBOL Visual**, the published standard for
  genetic-part glyphs: a bent arrow is a promoter, a block arrow is a coding
  sequence. Biologists read these without a key; don't redraw them freehand.
- Hallmark artwork stays within a 16-unit radius of (24, 24) so nothing touches
  the ring at any size.
- Clay (`--glyph-accent`) marks **the designed part**, never decoration.
- Avoid shapes with 180° arcs or threefold rotational symmetry. A 180° arc makes
  SVG's large-arc flag ambiguous between renderers, and a trefoil reads as a
  propeller once it is small.

## Provenance

**All twenty-four are original drawings made for this archive.** Nothing is
derived from a third-party icon set, so none of them carries an attribution
obligation and none needs a change log.

That was a deliberate choice over the free alternatives. NIH BioArt Source, the
DBCLS Togo Picture Gallery, Servier Medical Art and the Reactome icon library are
all CC BY 4.0 and all permit modification and redistribution; Bioicons is mixed
per icon, with a usable CC0 and MIT subset. Any of them would have worked. But
CC BY obliges you to credit each asset *and state every modification*,
permanently — a ledger of two dozen rows to maintain forever, for drawings this
simple, which would be restyled past recognition anyway.

If that decision is ever revisited, the obligation attaches per asset, so a
single borrowed glyph puts the ledger back.

### Structure renders

Where a record has a PDB or EMDB accession, a rendered structure can stand in for
the subject engraving. PDB coordinate files are **CC0**, and the RCSB states that
images rendered from them may be licensed however you like. Render with
open-source **PyMOL** (`pymol -cq`, whose CPU ray tracer suits the ink-on-paper
look) or with **Mol\*** (MIT), which runs headless under Node; PDBe's `pdb-images`
CLI is built on it.

Do **not** use ChimeraX. It is source-available under a non-commercial licence,
and a public archive is a judgement call best avoided.
