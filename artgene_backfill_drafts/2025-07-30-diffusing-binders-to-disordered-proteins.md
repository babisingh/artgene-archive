---
title: Diffusion models design binders to shape-shifting disordered proteins
subtitle: A University of Washington group used sequence-only RFdiffusion to make nanomolar binders for eight intrinsically disordered targets, then disrupted stress granules and amylin fibrils.
status: reviewed
item_type: validated-sequence
item_date: 2025-07-30
peer_reviewed: yes
tinsel_relevance: none
archive:
  doi: 10.1038/s41586-025-09248-9
  source_title: Diffusing protein binders to intrinsically disordered proteins
  container: Nature
  biosafety_class: none
  molecule_type: protein
  function_class: binder
  subject_class: disordered_chain
  generating_model: RFdiffusion v1.1.0, fine-tuned for flexible targets with sequence-only target input and an added secondary structure specification, with ProteinMPNN v1.0.1 for sequence design and AlphaFold2 initial guess for filtering
  model_availability: open-weights
  design_target: high-affinity binding proteins for intrinsically disordered proteins and regions, including amylin, C-peptide, VP48, BRCA1_ARATH, FUS, G3BP1, the prion protein and IL-2RG
  n_designed: unknown
  n_tested: unknown
  n_functional: unknown
  counts_note: Roughly 10,000 to 50,000 designs were generated in silico per target, then narrowed to 48 to 96 per target for testing. Validated binders were obtained for eight targets with dissociation constants from 3 to 100 nM. Representative per-target results include 107 of 174 top designs binding amylin, 6 of 95 binding C-peptide, 5 of 78 binding G3BP1, and single-digit hits for FUS, IL-2RG and BRCA1_ARATH. The three summary counts are left unknown because figures are reported per target and per round rather than as one total.
  assays: [expression, binding, structure, in-cell-imaging, activity]
  expression_host: ECOLI
  sequences_deposited: partial
  accessions:
    - database: pdb
      accession: 9CC5
      url: https://www.rcsb.org/structure/9CC5
    - database: pdb
      accession: 9CC6
      url: https://www.rcsb.org/structure/9CC6
  article_license_spdx: UNSTATED
  data_license_spdx: UNSTATED
  data_license: The published version carries the statement 2025 The Author(s), but the full text available to me did not include an explicit article licence, so the licence of the version of record is left UNSTATED. The bioRxiv preprint version is CC-BY-ND 4.0. No separate data licence is stated.
  staging: staged
  staging_reason: PDB 9CC5 (amylin-22 complex) and 9CC6 (G3BP1-11 complex) were taken from the preprint full text. The published version reports a third deposited structure, amylin-18, whose accession code was not recoverable from the full text available to me and so is not listed.
  ethics_code: Human plasma work used de-identified leftover clinical samples reviewed by the University of Washington Human Subjects Division, STUDY00013706.
credit:
  authors:
    - full_name: Caixuan Liu
      affiliation: Department of Biochemistry and Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Kejia Wu
      affiliation: Department of Biochemistry and Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Hojun Choi
      affiliation: Department of Biochemistry and Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Hannah L. Han
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Xueli Zhang
      affiliation: Institute of Biophysics, Chinese Academy of Sciences, Beijing
      corresponding: no
    - full_name: Joseph L. Watson
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Green Ahn
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Jason Z. Zhang
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Sara Shijo
      affiliation: Department of Laboratory Medicine and Pathology, University of Washington, Seattle
      corresponding: no
    - full_name: Lydia L. Good
      affiliation: University of Washington, Seattle
      corresponding: no
    - full_name: Charlotte M. Fischer
      affiliation: University of Washington, Seattle
      corresponding: no
    - full_name: Asim K. Bera
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Alex Kang
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Evans Brackenbrough
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Brian Coventry
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Derrick R. Hick
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Seema Qamar
      affiliation: University of Cambridge, Cambridge
      corresponding: no
    - full_name: Xinting Li
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Justin Decarreau
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Stacey R. Gerben
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Wei Yang
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Inna Goreshnik
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Dionne Vafeados
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Xinru Wang
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Mila Lamb
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Analisa Murray
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Sebastian Kenny
      affiliation: University of Washington, Seattle
      corresponding: no
    - full_name: Magnus S. Bauer
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Andrew N. Hoofnagle
      affiliation: Department of Laboratory Medicine and Pathology, University of Washington, Seattle
      corresponding: no
    - full_name: Ping Zhu
      affiliation: Institute of Biophysics, Chinese Academy of Sciences, Beijing
      corresponding: no
    - full_name: Tuomas P. J. Knowles
      affiliation: University of Cambridge, Cambridge
      corresponding: no
    - full_name: David Baker
      affiliation: Institute for Protein Design and Howard Hughes Medical Institute, University of Washington, Seattle
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle
sources:
  - https://www.nature.com/articles/s41586-025-09248-9
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC12367549/
---

# Diffusion models design binders to shape-shifting disordered proteins

*A University of Washington group used sequence-only RFdiffusion to make nanomolar binders for eight intrinsically disordered targets, then disrupted stress granules and amylin fibrils.*

**What was done.** Caixuan Liu, Kejia Wu, David Baker and colleagues at the Institute for Protein Design, University of Washington, with collaborators at the Chinese Academy of Sciences and the University of Cambridge, published this peer reviewed paper in Nature on 30 July 2025. Intrinsically disordered proteins have no single fold, which defeats methods that need a fixed target shape. The team fine-tuned RFdiffusion so that it starts only from the target sequence and lets both the target and the binder sample many conformations at once. They added a feature that can specify the target secondary structure, which was useful for short regions bound as beta strands. ProteinMPNN assigned sequences and AlphaFold2 filtered the designs.

**What they made and measured.** Binders were expressed in E. coli and measured by biolayer interferometry. Validated binders were obtained for eight targets, including amylin, C-peptide, VP48, BRCA1_ARATH, FUS, G3BP1, the prion protein and IL-2RG, with affinities from 3 to 100 nM. Crystal structures of the amylin-22 and G3BP1-11 complexes closely matched the design models. In cells, binders colocalized with their full-length targets. The G3BP1 binder blocked stress granule formation under stress, the amylin binders stopped fibril formation and broke up existing fibers, and an amylin binder fused to an endocytosis tag routed amylin to lysosomes.

**What it shows.** This extends diffusion-based binder design from rigid targets, and from helix-only peptides, to disordered proteins across a wide range of conformational preferences. Designing a well folded binder that selects one conformation from a broad ensemble, starting from sequence alone, is the capability that moves the field forward.

**Caveats.** The counts are reported per target and per round, so single designed, tested and functional totals are left unknown. The binder to the prion protein was kept out of cell experiments on safety grounds; the designed object is a benign binder, not the pathogenic protein.

**Why it matters for provenance.** The binders are standard genetically encoded proteins, so their coding sequence captures the full molecule. Two complex structures are deposited; a third deposited structure from the published version could not be verified here.

**In plain words.** Some proteins never settle into a shape; they thrash about. That makes them important in disease and very hard to take hold of. Working from sequence alone, the team designed grippers for eight such targets, then used them to break up clumps inside cells and to interfere with the fibres that build up in type 2 diabetes.

Source: Caixuan Liu, Kejia Wu, Hojun Choi and colleagues, including David Baker. Diffusing protein binders to intrinsically disordered proteins. Nature, published 30 July 2025, doi 10.1038/s41586-025-09248-9. https://www.nature.com/articles/s41586-025-09248-9
