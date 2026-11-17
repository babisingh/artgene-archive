---
title: Sequence design that reads the ligands, metals and DNA around a protein
subtitle: LigandMPNN writes protein sequences conditioned on the non-protein atoms in a binding site, and the designs were confirmed by four X-ray structures.
status: reviewed
item_type: validated-sequence
item_date: 2025-03-28
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: A LigandMPNN design is defined together with the small molecule, metal or nucleic acid it is built around, so a codon-level record of the protein alone does not capture the bound partner that gives the design its function.
archive:
  doi: 10.1038/s41592-025-02626-1
  source_title: Atomic context-conditioned protein sequence design using LigandMPNN
  container: Nature Methods
  biosafety_class: none
  molecule_type: protein
  function_class: method
  subject_class:
  classification_note: >-
    A method paper, like RFdiffusion: sequence design in the context of small
    molecules, nucleotides and metals, for binders, sensors and enzymes alike.
    No single function of a designed thing is true of it, which is what the
    method class says. The subject stays empty for the same reason: a method
    aimed at no one target.
  generating_model: LigandMPNN, an atomic context-conditioned message-passing neural network for protein sequence and sidechain design, extending ProteinMPNN to model non-protein atoms
  model_availability: open-weights
  design_target: amino-acid sequences and sidechain conformations for protein backbones in the context of small molecules, nucleotides and metals, for binders, sensors and enzymes
  n_designed: unknown
  n_tested: unknown
  n_functional: over 100
  counts_note: The paper reports more than 100 experimentally validated small-molecule and DNA-binding proteins, a figure that aggregates designs across this work and collaborating studies (Lee et al., An et al., Krishna et al.); no uniform designed/tested/functional denominators are given. Four X-ray structures of designs were solved.
  assays: [binding, activity, structure, sequence-recovery-benchmark]
  expression_host: ECOLI
  sequences_deposited: partial
  accessions:
    - database: pdb
      accession: 8VEI
      url: https://www.rcsb.org/structure/8VEI
    - database: pdb
      accession: 8VEZ
      url: https://www.rcsb.org/structure/8VEZ
    - database: pdb
      accession: 8VFQ
      url: https://www.rcsb.org/structure/8VFQ
    - database: pdb
      accession: 8TAC
      url: https://www.rcsb.org/structure/8TAC
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is Creative Commons Attribution 4.0. The paper states no separate data licence. Four crystal structures of designs (8VEI cholic acid binder, 8VEZ and 8VFQ apixaban binder, 8TAC DNA-binding protein) are in the PDB; the LigandMPNN code is on GitHub. Designed construct sequences are described in the Article and Supplementary Information rather than deposited to a sequence database.
  staging: staged
  staging_reason: 
  ethics_code: none stated
credit:
  authors:
    - full_name: Justas Dauparas
      orcid: 0000-0002-0030-144X
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Gyu Rie Lee
      orcid: 0000-0002-9119-5303
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Robert Pecoraro
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Linna An
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Ivan Anishchenko
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Cameron Glasscock
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: David Baker
      orcid: 0000-0001-7896-6217
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle
sources:
  - https://doi.org/10.1038/s41592-025-02626-1
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC11978504/
---

# Sequence design that reads the ligands, metals and DNA around a protein

*LigandMPNN writes protein sequences conditioned on the non-protein atoms in a binding site, and the designs were confirmed by four X-ray structures.*

**What was done.** Justas Dauparas, Gyu Rie Lee, David Baker and colleagues at the Institute for Protein Design, University of Washington, published LigandMPNN in Nature Methods on 28 March 2025 after peer review. Earlier deep-learning sequence design tools such as ProteinMPNN consider only protein atoms, so they are blind to the small molecules, nucleotides and metals that a binding site is built around. LigandMPNN takes these non-protein atoms as explicit input and generates both amino-acid sequences and sidechain conformations for a given backbone, which allows the atomic detail of a predicted interaction to be inspected directly.

**What they made and measured.** On native backbones, LigandMPNN recovered the correct residues far more often than Rosetta or ProteinMPNN for positions contacting small molecules (63.3 percent against 50.4 and 50.5), nucleotides (50.5 against 35.2 and 34.0) and metals (77.5 against 36.0 and 40.6). Beyond benchmarks, the method has been used to design more than 100 experimentally validated small-molecule and DNA-binding proteins with high affinity and specificity. Four X-ray crystal structures confirm the designs at the atomic level: a cholic acid binder (PDB 8VEI), an apixaban-binding protein in two crystal forms (8VEZ and 8VFQ) and a designed DNA-binding protein (8TAC). Redesign of existing Rosetta small-molecule binders with LigandMPNN increased binding affinity by as much as 100-fold.

**What it shows.** This is the first deep-learning sequence design method to model all non-protein components of a biomolecular system, and the crystal structures show that the designed sidechains sit where the model placed them. For enzymes, sensors and binders, where function is defined by chemistry at an interface, modeling that chemistry during sequence design is a genuine capability gain rather than an incremental tuning of an existing pipeline.

**Caveats.** Much of the more than 100 validated proteins figure aggregates designs reported across collaborating studies by Lee, An, Krishna and co-workers, so it is not a single clean campaign with one denominator. The paper does not give uniform designed, tested and functional counts across all targets.

**Why it matters for provenance.** A LigandMPNN design is only fully specified together with the ligand, metal or nucleic acid it was built around; the protein coding sequence alone does not capture the bound partner that defines its function.

Source: Justas Dauparas, Gyu Rie Lee, Robert Pecoraro and colleagues, including David Baker. Atomic context-conditioned protein sequence design using LigandMPNN. Nature Methods, published 28 March 2025, doi 10.1038/s41592-025-02626-1. https://doi.org/10.1038/s41592-025-02626-1
