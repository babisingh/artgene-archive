---
title: Launching a designed protein nanoparticle vaccine from mRNA
subtitle: An Institute for Protein Design team encodes a secretion-optimized designed nanoparticle in mRNA, and the self-assembling immunogen protects mice against SARS-CoV-2 better than a matched spike mRNA vaccine.
status: reviewed
item_type: validated-sequence
item_date: 2025-10-15
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: The immunogen is a computationally designed protein delivered as mRNA, so its provenance spans both a designed amino acid sequence and the nucleotide construct that encodes it, and a complete record has to cover both layers.
archive:
  doi: 10.1126/scitranslmed.adu2085
  source_title: Computationally designed mRNA-launched protein nanoparticle immunogens elicit protective antibody and T cell responses in mice
  container: Science Translational Medicine
  biosafety_class: none
  molecule_type: protein
  function_class: shell
  subject_class: virion
  classification_note: >-
    The nanoparticle displays a SARS-CoV-2 antigen, so what it is aimed at is
    the virion, not the particle that carries the display.
  generating_model: Rosetta-based computational protein design, using the de novo icosahedral nanoparticle I3-01 re-engineered for secretion (I3-01NS) and a computationally stabilized SARS-CoV-2 RBD (Rpk9)
  model_availability: not stated
  design_target: a self-assembling 60-subunit protein nanoparticle that secretes from human cells and displays 60 copies of a viral antigen, delivered as an mRNA vaccine
  n_designed: unknown
  n_tested: 10
  n_functional: 6
  counts_note: This is a proof-of-concept study built on one core designed scaffold, I3-01NS. Ten antigen-display fusion constructs on I3-01NS or ferritin were assessed for secretion and assembly; 6 secreted and formed intact nanoparticles while 4 did not. The lead immunogen Rpk9-I3-01NS secreted at 29.9 mg per litre, assembled correctly, and was immunogenic and protective in mice.
  assays: [expression, secretion, binding, structure, in-vivo, size-exclusion-chromatography, dynamic-light-scattering, electron-microscopy, biolayer-interferometry, neutralization, t-cell-staining, viral-challenge]
  expression_host: HUMAN
  sequences_deposited: no
  accessions: []
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is Creative Commons Attribution 4.0. The data availability statement says all data are in the paper or supplementary materials and sets no separate data licence; reagents are available only on request under a Material Transfer Agreement.
  staging: none
  staging_reason: No designed sequences were deposited to a sequence database. Reagents are shared only under a Material Transfer Agreement, so there is no public accession to stage.
  ethics_code: Mouse studies; animal work approved under the authors' institutional protocols as described in the paper.
credit:
  authors:
    - full_name: Grace G. Hendricks
      affiliation: Institute for Protein Design, University of Washington, Seattle, WA
      corresponding: no
    - full_name: Lilit Grigoryan
      affiliation: Institute for Immunity, Transplantation and Infection, Stanford University, Stanford, CA
      corresponding: no
    - full_name: Neil P. King
      affiliation: Department of Biochemistry and Institute for Protein Design, University of Washington, Seattle, WA
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle, WA
sources:
  - https://doi.org/10.1126/scitranslmed.adu2085
---

# Launching a designed protein nanoparticle vaccine from mRNA

*An Institute for Protein Design team encodes a secretion-optimized designed nanoparticle in mRNA, and the self-assembling immunogen protects mice against SARS-CoV-2 better than a matched spike mRNA vaccine.*

**What was done.** Two vaccine ideas matured during the COVID-19 pandemic: mRNA delivery, and multivalent antigen display on computationally designed protein nanoparticles. A designed particle normally has to be made and purified before it is injected. Here it is built by the body's own cells instead. I3-01NS, a 60-subunit icosahedral nanoparticle the group had previously redesigned for efficient secretion from human cells, was fused to a SARS-CoV-2 receptor binding domain so the particle could be made by a cell from delivered mRNA.

**What they made and measured.** The wild-type Wuhan-Hu-1 RBD fusion did not secrete, but swapping in a computationally stabilized RBD called Rpk9 restored secretion to 29.9 mg per litre. The purified Rpk9-I3-01NS assembled into monodisperse, antigenically intact 60-mers confirmed by chromatography, light scattering, electron microscopy and biolayer interferometry. Delivered as mRNA in mice, it elicited 5 to 28 fold higher neutralizing antibody titers than a matched mRNA vaccine encoding membrane-anchored spike, induced strong CD8 T cell responses, and gave complete protection from lung virus after challenge with mouse-adapted SARS-CoV-2, including a mismatched Omicron strain. Displaying antigens from four additional viruses showed the scaffold generalizes: six of ten tested fusion constructs secreted and assembled.

**What it shows.** A computationally designed self-assembling nanoparticle can be produced inside an animal from mRNA and still fold, assemble and display antigen well enough to beat a best-in-class spike mRNA benchmark. This is a first proof of concept for mRNA-launched designed nanoparticle immunogens. The work is in mice only, assembly was not observed directly in vivo, and secretion depended strongly on the antigen, with several constructs failing to secrete.

**Caveats.** The work is in mice only, and whether these responses predict performance in larger animals or people is unknown. Nanoparticle assembly was not directly observed in vivo, and secretion depended strongly on the specific antigen, with several constructs failing to secrete.

**Why it matters for provenance.** The immunogen is a designed protein carried by a designed nucleotide sequence. No sequences were deposited, and reagents move only under a Material Transfer Agreement, so an external record must reconstruct both layers from the paper itself.

**In plain words.** A vaccine can carry instructions rather than the thing itself and let the cell build it. Here the instructions describe a designed ball that assembles itself and studs its surface with sixty copies of a piece of a virus, which the immune system notices far more than a single loose piece. In mice it protected better than an mRNA vaccine carrying that piece on its own.

Source: Grace G. Hendricks, Lilit Grigoryan and colleagues, Neil P. King corresponding. Computationally designed mRNA-launched protein nanoparticle immunogens elicit protective antibody and T cell responses in mice. Science Translational Medicine, 15 October 2025. doi 10.1126/scitranslmed.adu2085. https://doi.org/10.1126/scitranslmed.adu2085
