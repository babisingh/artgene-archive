---
title: A designed chaperone switch dissolves condensates inside living cells
subtitle: University of Washington and UCSF researchers built artificial J-domain proteins from scratch; one, JDM37, activates the Hsp70 chaperone and clears RNA and oncoprotein condensates in cells.
status: reviewed
item_type: validated-sequence
item_date: 2025-02-07
peer_reviewed: yes
tinsel_relevance: none
archive:
  doi: 10.1016/j.chembiol.2025.01.006
  source_title: De novo designed Hsp70 activator dissolves intracellular condensates
  container: Cell Chemical Biology
  biosafety_class: none
  molecule_type: protein
  function_class: switch
  subject_class: condensate
  classification_note: >-
    It binds Hsp70 and acts on condensates. The condensate is the effect the
    paper is about, and the more informative plate.
  generating_model: Rosetta de novo design, using RifDock docking, FastDesign and MotifGraft for fully de novo J-domain mimics and RosettaRemodel for the partially designed series, with AlphaFold2 used to filter predicted complexes
  model_availability: open-weights
  design_target: synthetic J-domain mimic proteins that bind the Hsp70 chaperone at the native J-domain site, activate its ATPase, and dissolve intracellular condensates
  n_designed: 25000
  n_tested: 41
  n_functional: 1
  counts_note: Over a million designs were generated computationally; roughly 25,000 were ordered for yeast display (20,000 fully de novo plus 5,000 partially designed). Four fully de novo designs bound Hsc70; affinity maturation produced 41 strong binders, all 41 were purified and measured by biolayer interferometry, and of 30 well expressing designs only JDM37 activated Hsc70 ATPase turnover and dissolved condensates. One residue pair separates the activator JDM37 from the inhibitor JDM16.
  assays: [expression, binding, activity, in-cell-imaging]
  expression_host: ECOLI
  sequences_deposited: partial
  accessions: []
  article_license_spdx: PROPRIETARY
  data_license_spdx: UNSTATED
  data_license: The copyright statement is Copyright 2025 University of Washington, published by Elsevier, all rights reserved. The paper states its data are on Figshare and publicly available, but the specific Figshare DOI was not present in the full text available to me, so no accession is listed.
  staging: refused
  staging_reason: The paper states that its data, including sequences, are deposited on Figshare, but the deposit DOI was not recoverable from the available full text, so no verified accession could be staged. PDB 5NRO appears in the paper but is a prior DnaK and DnaJ structure used as a design template, not a deposition of this work.
  ethics_code: none stated
credit:
  authors:
    - full_name: Jason Z. Zhang
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: yes
    - full_name: Nathan Greenwood
      affiliation: University of Washington, Seattle
      corresponding: no
    - full_name: Jason Hernandez
      affiliation: University of Washington, Seattle
      corresponding: no
    - full_name: Josh T. Cuperus
      affiliation: Department of Genome Sciences, University of Washington, Seattle
      corresponding: no
    - full_name: Buwei Huang
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Bryan D. Ryder
      affiliation: University of California San Francisco, San Francisco
      corresponding: no
    - full_name: Christine Queitsch
      affiliation: Department of Genome Sciences, University of Washington, Seattle
      corresponding: no
    - full_name: Jason E. Gestwicki
      affiliation: University of California San Francisco, San Francisco
      corresponding: no
    - full_name: David Baker
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
  institution: Institute for Protein Design, University of Washington, Seattle
sources:
  - https://doi.org/10.1016/j.chembiol.2025.01.006
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC11928274/
---

# A designed chaperone switch dissolves condensates inside living cells

*University of Washington and UCSF researchers built artificial J-domain proteins from scratch; one, JDM37, activates the Hsp70 chaperone and clears RNA and oncoprotein condensates in cells.*

**What was done.** Jason Z. Zhang, David Baker and colleagues at the Institute for Protein Design, University of Washington, with collaborators including Jason E. Gestwicki at the University of California San Francisco, published this peer reviewed paper in Cell Chemical Biology on 7 February 2025. The Hsp70 chaperone is recruited to client proteins by J-domain proteins. The team set out to design synthetic J-domain mimics that bind Hsp70 at the natural site and switch on its activity. Using Rosetta de novo design, with RifDock, FastDesign and MotifGraft, they generated over a million candidates and filtered them with AlphaFold2.

**What they made and measured.** About 25,000 designs were displayed on yeast and sorted for binding to human Hsc70. Four fully de novo designs bound, and affinity maturation produced 41 strong binders that were expressed in E. coli, purified, and measured by biolayer interferometry, with affinities from 1 nM to 1 micromolar. Of 30 well expressing designs tested in ATP turnover assays, only one, JDM37, activated the chaperone, with a potency comparable to natural J-domains. Strikingly, the inhibitor JDM16 differs from the activator JDM37 at only two positions. In HEK293T and lung cells, a JDM37 fusion dissolved RIalpha signaling condensates, endogenous paraspeckles, and EML4-Alk oncoprotein condensates, and the EML4-Alk effect reduced downstream Ras and Erk signaling and cell growth.

**What it shows.** This is a de novo designed protein that does not merely bind a target but activates a natural enzyme, and then acts as a tool to perturb condensates in living cells. Turning an inhibitor into an activator by two substitutions, in a protein that lacks the conserved natural motif, is the step worth noting.

**Caveats.** The authors state that they could not pin down the exact mechanism of activation, and could not fully confirm that Hsp70 recruitment and ATPase activity drive the observed condensate dissolution because complete Hsp70 knockdown is toxic. No new structure of a designed complex was solved; the models rest on AlphaFold2 predictions.

**Why it matters for provenance.** The designs are standard genetically encoded proteins, so their identity is captured by their coding sequence. The paper states its sequence data are on Figshare, but the deposit identifier was not present in the full text available here, so nothing could be verified and staged.

**In plain words.** Cells form droplets of protein that gather and dissolve on purpose, and some of them stick when they should not. The cell's own cleaner, a protein called Hsp70, can break them up, but it has to be switched on first. The team designed a switch from scratch: over a million designs on the computer, about 25,000 ordered, and one of them clears the droplets inside living cells.

Source: Jason Z. Zhang, Nathan Greenwood, Jason Hernandez and colleagues, including Jason E. Gestwicki and David Baker. De novo designed Hsp70 activator dissolves intracellular condensates. Cell Chemical Biology, published 7 February 2025, doi 10.1016/j.chembiol.2025.01.006. https://doi.org/10.1016/j.chembiol.2025.01.006
