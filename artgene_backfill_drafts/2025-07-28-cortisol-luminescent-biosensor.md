---
title: A cortisol biosensor designed from scratch on a computer
subtitle: A UC Santa Cruz group designs cortisol-triggered protein dimers and fuses them to a split luciferase, reaching a 375-fold luminescent response with picomolar sensitivity that a phone camera can read.
status: reviewed
item_type: validated-sequence
item_date: 2025-07-28
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: The working sensor is a fusion of several de novo designed modules whose function depends on their exact geometry, so a coding-sequence record captures the parts but not the spatial arrangement that makes the device respond to cortisol.
archive:
  doi: 10.1021/jacs.5c05004
  source_title: De Novo Design of High-Performance Cortisol Luminescent Biosensors
  container: Journal of the American Chemical Society
  biosafety_class: none
  molecule_type: protein
  function_class: sensor
  subject_class: small_molecule
  generating_model: a Rosetta-based de novo design pipeline using RIFdock and PatchDock for scaffold placement, Rosetta FastDesign and ProteinMPNN for sequence design, with AlphaFold2 and AlphaFold3 for filtering and fusion sampling
  model_availability: open-weights
  design_target: cortisol-induced protein heterodimers (lid proteins paired with the mhcy129 cortisol binder) fused to split luciferase fragments to make a luminescent cortisol biosensor
  n_designed: unknown
  n_tested: 10
  n_functional: 8
  counts_note: A 60,000 member yeast-display library of lid designs was screened from roughly 5 million docking configurations. 96 colonies were validated by flow cytometry, 35 showed cortisol-dependent binding, 10 were purified, 9 were monomeric and 8 formed cortisol-inducible heterodimers with mhcy129. The lead design corD1 was carried into the final biosensor.
  assays: [expression, binding, activity, size-exclusion-chromatography, yeast-display, luminescence, limit-of-detection]
  expression_host: ECOLI
  sequences_deposited: no
  accessions: []
  article_license_spdx: PROPRIETARY
  data_license_spdx: UNSTATED
  data_license: The journal copy carries the standard ACS copyright, shown in the archive only under a text-mining and fair-use notice rather than a Creative Commons licence. Sequence information is provided in the electronic supporting information and is not deposited in a sequence database.
  staging: none
  staging_reason: The designed sequences appear only in the electronic supporting information and were not deposited to a sequence database, so there is no public accession to stage.
  ethics_code: none stated
credit:
  authors:
    - full_name: Julie Yi-Hsuan Chen
      affiliation: Department of Biomolecular Engineering, University of California, Santa Cruz, CA
      corresponding: no
    - full_name: Xue Peng
      affiliation: Department of Biomolecular Engineering, University of California, Santa Cruz, CA
      corresponding: no
    - full_name: Chenggang Xi
      affiliation: Department of Biomolecular Engineering, University of California, Santa Cruz, CA
      corresponding: no
    - full_name: Gyu Rie Lee
      affiliation: Department of Biochemistry, Institute for Protein Design and Howard Hughes Medical Institute, University of Washington, Seattle, WA
      corresponding: no
    - full_name: David Baker
      affiliation: Department of Biochemistry, Institute for Protein Design and Howard Hughes Medical Institute, University of Washington, Seattle, WA
      corresponding: no
    - full_name: Andy Hsien-Wei Yeh
      affiliation: Department of Biomolecular Engineering and Genomics Institute, University of California, Santa Cruz, CA
      corresponding: yes
  institution: Department of Biomolecular Engineering, University of California, Santa Cruz, CA
sources:
  - https://doi.org/10.1021/jacs.5c05004
---

# A cortisol biosensor designed from scratch on a computer

*A UC Santa Cruz group designs cortisol-triggered protein dimers and fuses them to a split luciferase, reaching a 375-fold luminescent response with picomolar sensitivity that a phone camera can read.*

**What was done.** Julie Yi-Hsuan Chen, Xue Peng, Chenggang Xi and colleagues in Andy Hsien-Wei Yeh's group at the University of California, Santa Cruz, with Gyu Rie Lee and David Baker at the University of Washington, published this work in the Journal of the American Chemical Society, online 28 July 2025. It is peer reviewed. They set out to build a cortisol sensor without reusing any natural cortisol-binding protein. Starting from a de novo cortisol binder, they designed new lid proteins that cover the exposed face of the binder-cortisol complex, so that the two proteins pair only when cortisol is present. RIFdock placed candidate scaffolds, Rosetta FastDesign and ProteinMPNN wrote the sequences, and AlphaFold2 and AlphaFold3 filtered designs and sampled fusions to split luciferase.

**What they made and measured.** From a 60,000 member yeast-display library, 96 colonies were validated and 35 showed cortisol-dependent binding. Ten lid proteins were purified, nine were monomeric, and eight formed cortisol-inducible heterodimers by size exclusion chromatography. A structure prediction step then selected linker lengths and domain orders for fusing the dimer to split luciferase, cutting the number of constructs that needed bench testing from hundreds to a handful. The lead sensor gave a 375-fold luminescent increase with a limit of detection of 131 picomolar, spanned four orders of magnitude in cortisol, worked in synthetic urine and serum, and was selective over related steroids. A ratiometric version produced a color shift readable by a smartphone.

**What it shows.** A working small-molecule biosensor was designed end to end by computation, including the ligand-triggered dimer and its fusion geometry, and it outperformed a conventional NanoBiT design by more than tenfold in dynamic range and sensitivity.

**Caveats.** Serum attenuated the signal, the sensor shows a hook effect at high cortisol, and selectivity over progesterone and aldosterone was moderate rather than absolute. No experimental structure of the designed ternary complex was solved.

**Why it matters for provenance.** The device is several de novo modules joined in a specific geometry. The designed sequences are given only in the supporting information and were not deposited to a database, which limits how fully anyone else can register or reproduce the exact constructs.

Source: Julie Yi-Hsuan Chen, Xue Peng, Chenggang Xi and colleagues, Andy Hsien-Wei Yeh corresponding. De Novo Design of High-Performance Cortisol Luminescent Biosensors. Journal of the American Chemical Society, 28 July 2025. doi 10.1021/jacs.5c05004. https://doi.org/10.1021/jacs.5c05004
