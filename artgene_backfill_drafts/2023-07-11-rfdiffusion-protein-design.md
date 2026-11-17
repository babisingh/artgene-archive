---
title: A diffusion model that designs new proteins from simple specifications
subtitle: The Baker lab turns RoseTTAFold into a generative backbone designer and confirms hundreds of built proteins, including a cryo-EM structure that matches the design to within one angstrom.
status: reviewed
item_type: validated-sequence
item_date: 2023-07-11
peer_reviewed: yes
tinsel_relevance: high
tinsel_note: A single general-purpose generative model lowers the barrier to functional proteins with no natural homolog, which is exactly the class of sequence any provenance or watermarking scheme must be able to trace back to its origin.
archive:
  doi: 10.1038/s41586-023-06415-8
  source_title: De novo design of protein structure and function with RFdiffusion
  container: Nature
  biosafety_class: none
  molecule_type: protein
  function_class:
  subject_class:
  classification_note: >-
    A method paper. It produces monomers, oligomers, active-site scaffolds,
    metal-binding assemblies and binders, so no single function is true of it,
    and there is no 'method' value to say that with. Left empty rather than
    narrowed to one of its applications.
  generating_model: RFdiffusion, a denoising diffusion model built by fine-tuning the RoseTTAFold structure prediction network, with ProteinMPNN for sequence design
  model_availability: open-weights
  design_target: unconditional and fold-conditioned monomers, symmetric oligomers, functional-motif and enzyme active-site scaffolds, metal-binding assemblies, and de novo binders to specified protein targets
  n_designed: unknown
  n_tested: unknown
  n_functional: unknown
  counts_note: 'The paper reports results per design campaign rather than as one total. Examples: 608 symmetric oligomer designs screened with at least 87 matching the intended oligomeric state by size exclusion chromatography; 96 MDM2-targeting designs with 55 binding at 10 micromolar and the best at 0.5 to 0.7 nM; 44 nickel-binding designs expressed with 18 coordinating the metal; five binder targets at 95 designs each with an overall 19 percent experimental success rate.'
  assays: [expression, binding, structure, activity, biolayer-interferometry, size-exclusion-chromatography, electron-microscopy, cryo-EM, isothermal-titration-calorimetry, circular-dichroism]
  expression_host: ECOLI
  sequences_deposited: yes
  accessions:
    - database: figshare
      accession: 439fdd59488215753bc3
      url: https://figshare.com/s/439fdd59488215753bc3
    - database: pdb
      accession: 8SK7
      url: https://www.rcsb.org/structure/8SK7
    - database: other
      accession: EMDB-40557
      url: https://www.ebi.ac.uk/emdb/EMD-40557
    - database: other
      accession: EMDB-40602
      url: https://www.ebi.ac.uk/emdb/EMD-40602
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is Creative Commons Attribution 4.0. The paper sets no separate licence for its deposited design structures and models, which sit on figshare, the PDB and the EMDB without a stated reuse licence.
  staging: staged
  staging_reason: Design structures, AlphaFold2 models and measurements are posted on figshare and the influenza complex is in the PDB and EMDB, so deposited material exists to stage.
  ethics_code: none stated
credit:
  authors:
    - full_name: Joseph L. Watson
      affiliation: Department of Biochemistry and Institute for Protein Design, University of Washington, Seattle, WA
      corresponding: no
    - full_name: David Juergens
      affiliation: Department of Biochemistry and Institute for Protein Design, University of Washington, Seattle, WA
      corresponding: no
    - full_name: Nathaniel R. Bennett
      affiliation: Department of Biochemistry and Institute for Protein Design, University of Washington, Seattle, WA
      corresponding: no
    - full_name: David Baker
      affiliation: Department of Biochemistry, Institute for Protein Design and Howard Hughes Medical Institute, University of Washington, Seattle, WA
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle, WA
sources:
  - https://doi.org/10.1038/s41586-023-06415-8
  - https://github.com/RosettaCommons/RFdiffusion
---

# A diffusion model that designs new proteins from simple specifications

*The Baker lab turns RoseTTAFold into a generative backbone designer and confirms hundreds of built proteins, including a cryo-EM structure that matches the design to within one angstrom.*

**What was done.** Joseph Watson, David Juergens, Nathaniel Bennett and colleagues in David Baker's group at the Institute for Protein Design, University of Washington, with collaborators at Columbia, MIT, Cambridge, Harvard and Seoul National University, published this work in Nature on 11 July 2023. It is peer reviewed. They fine-tuned the RoseTTAFold structure prediction network into a denoising diffusion model, RFdiffusion, that builds protein backbones from random noise. ProteinMPNN then assigns sequences to those backbones. One model handles unconditional monomers, fold-constrained monomers, symmetric oligomers, active-site scaffolding and binder design, all from compact inputs such as a symmetry group or a set of target hotspots.

**What they made and measured.** The authors expressed designs in E. coli and characterized them across many separate campaigns. For symmetric assemblies, 608 designs were screened and at least 87 matched the intended oligomeric state by size exclusion chromatography, with negative stain and cryo-EM confirming shapes close to the models. Scaffolding the p53 helix against MDM2 produced binders at 0.5 and 0.7 nM, roughly three orders of magnitude tighter than the parent peptide, with 55 of 96 designs binding at 10 micromolar. Forty-four nickel-binding designs were expressed and 18 coordinated the metal. For binder design against five targets at 95 designs each, the overall experimental success rate was about 19 percent, two orders of magnitude above the prior Rosetta method. A cryo-EM structure of the strongest influenza hemagglutinin binder matched the design model to 0.6 angstrom over the binder.

**What it shows.** A single generative model solves design problems that previously required separate, hand-tuned pipelines, and it does so with far fewer designs per success. The atomic agreement between the influenza binder structure and its design model is the strongest evidence that the method places backbone and side chains where intended.

**Caveats.** Success rates vary sharply by task and by target surface, and the binder work concentrated on relatively non-polar sites. The in silico success metric was validated experimentally for a subset of designs, and very large designs are hard to validate by prediction alone.

**Why it matters for provenance.** RFdiffusion makes functional proteins with no natural homolog much easier to produce. Design structures, AlphaFold2 models and measurements are posted on figshare, the influenza complex is deposited in the PDB and the EMDB, and the code is open, which makes this a well documented reference point for tracing AI designed sequences.

Source: Joseph L. Watson, David Juergens, Nathaniel R. Bennett and colleagues, David Baker corresponding. De novo design of protein structure and function with RFdiffusion. Nature, 11 July 2023. doi 10.1038/s41586-023-06415-8. https://doi.org/10.1038/s41586-023-06415-8
