---
title: Deep learning designs proteins that grip flexible peptide hormones
subtitle: A University of Washington team generated binders to helical peptide hormones including parathyroid hormone and glucagon, some at picomolar affinity, and turned them into biosensors.
status: reviewed
item_type: validated-sequence
item_date: 2023-12-18
peer_reviewed: yes
tinsel_relevance: none
archive:
  doi: 10.1038/s41586-023-06953-1
  source_title: De novo design of high-affinity binders of bioactive helical peptides
  container: Nature
  biosafety_class: none
  molecule_type: protein
  function_class: binder
  subject_class: hormone_peptide
  generating_model: RFdiffusion, extended to flexible targets and to partial diffusion, with ProteinMPNN sequence design and AlphaFold2 filtering, alongside parametric Rosetta generation, RFjoint Inpainting and AF2 hallucination
  model_availability: open-weights
  design_target: high-affinity binding proteins for bioactive helical peptide hormones, including parathyroid hormone, glucagon, neuropeptide Y, secretin and the Bim peptide
  n_designed: unknown
  n_tested: unknown
  n_functional: unknown
  counts_note: Reported per campaign rather than as one total. In yeast display screens, 25 of 96 designs bound glucagon and 20 of 96 bound neuropeptide Y at 10 nM; completely de novo RFdiffusion runs yielded binders to parathyroid hormone and the Bim peptide without further optimization. Picomolar affinity was reached for glucagon. The three counts are left unknown because the paper gives figures separately for each method and target.
  assays: [expression, binding, structure, biosensor, mass-spectrometry]
  expression_host: ECOLI
  sequences_deposited: partial
  accessions:
    - database: pdb
      accession: 8GJG
      url: https://www.rcsb.org/structure/8GJG
    - database: pdb
      accession: 8GJI
      url: https://www.rcsb.org/structure/8GJI
    - database: pdb
      accession: 8T5E
      url: https://www.rcsb.org/structure/8T5E
    - database: pdb
      accession: 8T5F
      url: https://www.rcsb.org/structure/8T5F
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is Creative Commons Attribution 4.0. The paper states no separate licence for its data. Four atomic models were deposited to the PDB and the binder sequences are listed in Extended Data Table 1.
  staging: staged
  ethics_code: Human plasma work used de-identified leftover clinical samples.
credit:
  authors:
    - full_name: Susana Vazquez Torres
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Philip J. Y. Leung
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Preetham Venkatesh
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Isaac D. Lutz
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Fabian Hink
      affiliation: University of Copenhagen, Copenhagen
      corresponding: no
    - full_name: Huu-Hien Huynh
      affiliation: Department of Laboratory Medicine and Pathology, University of Washington, Seattle
      corresponding: no
    - full_name: Jessica Becker
      affiliation: Department of Laboratory Medicine and Pathology, University of Washington, Seattle
      corresponding: no
    - full_name: Andy Hsien-Wei Yeh
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: David Juergens
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Nathaniel R. Bennett
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Andrew N. Hoofnagle
      affiliation: Department of Laboratory Medicine and Pathology, University of Washington, Seattle
      corresponding: no
    - full_name: Eric Huang
      affiliation: Department of Genome Sciences, University of Washington, Seattle
      corresponding: no
    - full_name: Michael J. MacCoss
      affiliation: Department of Genome Sciences, University of Washington, Seattle
      corresponding: no
    - full_name: Marc Exposit
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Gyu Rie Lee
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Asim K. Bera
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Alex Kang
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Joshmyn De La Cruz
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Paul M. Levine
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Xinting Li
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Mila Lamb
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Stacey R. Gerben
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Analisa Murray
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Piper Heine
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Elif Nihal Korkmaz
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Jeff Nivala
      affiliation: Paul G. Allen School of Computer Science and Engineering, University of Washington, Seattle
      corresponding: no
    - full_name: Lance Stewart
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Joseph L. Watson
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Joseph M. Rogers
      affiliation: University of Copenhagen, Copenhagen
      corresponding: no
    - full_name: David Baker
      affiliation: Institute for Protein Design and Howard Hughes Medical Institute, University of Washington, Seattle
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle
  corresponding_note: The paper designates three co-corresponding authors, Joseph L. Watson, Joseph M. Rogers and David Baker, each marked with an envelope symbol in the byline. Only David Baker, the senior author, is flagged corresponding here because the schema allows a single corresponding author; Watson and Rogers are co-corresponding and are not merely contributing authors.
sources:
  - https://www.nature.com/articles/s41586-023-06953-1
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC10849960/
---

# Deep learning designs proteins that grip flexible peptide hormones

*A University of Washington team generated binders to helical peptide hormones including parathyroid hormone and glucagon, some at picomolar affinity, and turned them into biosensors.*

**What was done.** Susana Vazquez Torres, Joseph L. Watson, Joseph M. Rogers, David Baker and colleagues at the Institute for Protein Design, University of Washington, with collaborators at the University of Copenhagen, published this peer reviewed paper in Nature on 18 December 2023. Peptide hormones such as parathyroid hormone, glucagon and neuropeptide Y fold into a helix only when they meet their receptor, so they are hard targets for designed binders. The team extended RFdiffusion, a denoising diffusion method, to design against flexible targets and to refine existing models by partial diffusion, noising a structure part way and then denoising it. ProteinMPNN assigned sequences and AlphaFold2 filtered the results. Parametric Rosetta generation, RFjoint Inpainting and AlphaFold2 hallucination were also used.

**What they made and measured.** Designs were screened by yeast surface display and then expressed in E. coli, purified, and characterized by fluorescence polarization and biolayer interferometry. Success rates were often high: 25 of 96 designs bound glucagon and 20 of 96 bound neuropeptide Y at 10 nM in the initial screen. The strongest glucagon binders reached affinities below the picomolar limit of detection, and some parathyroid hormone and Bim binders were generated completely de novo from random noise with no experimental optimization. Four designed complexes were solved by X-ray crystallography. The binders enriched parathyroid hormone and glucagon for detection by mass spectrometry and were built into split luciferase biosensors that report hormone concentration through light.

**What it shows.** Earlier de novo binder design worked best against rigid, well folded targets. This work pushes the boundary to short peptides that are disordered until they bind, and shows that partial diffusion can polish both natural and designed starting points to very high affinity. Reaching picomolar binders directly from noise, without rounds of laboratory optimization, is the result worth noting.

**Caveats.** The headline counts are reported per campaign and per target rather than as a single designed, tested and functional tally, so those three totals are left unknown here. Affinities below the detection limit are reported as bounds rather than exact values.

**Why it matters for provenance.** These are standard genetically encoded proteins whose full identity is captured by their coding sequence, which makes them clean cases for any registry of designed sequences. The authors deposited four structures and listed binder sequences in the supplementary material.

**In plain words.** Hormones such as glucagon and parathyroid hormone are short, floppy chains, which makes them awkward to grab: there is no fixed shape to take hold of. The team designed proteins that hold them anyway, some so tightly that letting go takes hours, and then wired those grippers into sensors that light up when the hormone is there.

Source: Susana Vazquez Torres, Philip J. Y. Leung, Preetham Venkatesh and colleagues, including Joseph L. Watson, Joseph M. Rogers and David Baker. De novo design of high-affinity binders of bioactive helical peptides. Nature, published 18 December 2023, doi 10.1038/s41586-023-06953-1. https://www.nature.com/articles/s41586-023-06953-1
