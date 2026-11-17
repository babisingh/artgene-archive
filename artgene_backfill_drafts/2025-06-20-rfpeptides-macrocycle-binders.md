---
title: Diffusion-designed macrocycles bind four proteins with structures matching the models
subtitle: A University of Washington team designed cyclic peptide binders de novo, reaching single-digit nanomolar affinity and sub-angstrom agreement with solved crystal structures.
status: reviewed
item_type: validated-sequence
item_date: 2025-06-20
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: Macrocyclic peptides are chemically synthesized and head-to-tail cyclized, so a coding-sequence record does not capture the cyclization or non-standard geometry that define the molecule.
archive:
  doi: 10.1038/s41589-025-01929-w
  source_title: Accurate de novo design of high-affinity protein-binding macrocycles using deep learning
  container: Nature Chemical Biology
  biosafety_class: none
  molecule_type: protein
  function_class: binder
  subject_class: soluble_protein
  generating_model: RFpeptides, RFdiffusion extended with cyclic relative positional encoding for backbone generation and ProteinMPNN for sequence design, with RoseTTAFold2 and AfCycDesign used to filter candidates
  model_availability: open-weights
  design_target: de novo macrocyclic peptide binders to four protein targets, MCL1, MDM2, GABARAP and the Acinetobacter baumannii surface protein Rhombotarget A
  n_designed: 77
  n_tested: 39
  n_functional: 12
  counts_note: Tens of thousands of backbones were generated per target in silico, then a small set was selected for chemical synthesis, 27 for MCL1, 11 for MDM2, 13 for GABARAP and 26 for RbtA, 77 in total. Many failed cyclization during synthesis, so 39 were assayed by surface plasmon resonance, 14, 8, 6 and 11 respectively. Binders detected, 3 for MCL1, 3 for MDM2, 2 for GABARAP and 4 for RbtA, 12 in total, with best affinities of 2 micromolar for MCL1, 1.9 micromolar for MDM2, 6 nanomolar for GABARAP and 9.4 nanomolar for RbtA.
  assays: [structure, binding, activity]
  expression_host: not stated
  sequences_deposited: partial
  accessions:
    - database: pdb
      accession: 9CDT
      url: https://www.rcsb.org/structure/9CDT
    - database: pdb
      accession: 9HGC
      url: https://www.rcsb.org/structure/9HGC
    - database: pdb
      accession: 9HGD
      url: https://www.rcsb.org/structure/9HGD
    - database: pdb
      accession: 9CDU
      url: https://www.rcsb.org/structure/9CDU
    - database: pdb
      accession: 9CDV
      url: https://www.rcsb.org/structure/9CDV
    - database: zenodo
      accession: 10.5281/zenodo.15264344
      url: https://doi.org/10.5281/zenodo.15264344
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is CC-BY 4.0. Five crystal structures of macrocycle-bound and apo targets are in the public Protein Data Bank and the RFpeptides code is at Zenodo (10.5281/zenodo.15264344) and the RFdiffusion GitHub, but the paper states no separate licence for its sequence data. The designed macrocycle models and sequences are given in the Supplementary Information.
  staging: staged
  staging_reason: Design models and macrocycle sequences are provided in the Supplementary Information and five complexes are deposited to the PDB, so the designs are obtainable. Nothing is deposited to GenBank or UniProt because these are chemically synthesized cyclic peptides.
  ethics_code: none stated
credit:
  authors:
    - full_name: Stephen A. Rettie
      affiliation: Department of Medicinal Chemistry and Institute for Protein Design, University of Washington, Seattle, WA
      corresponding: no
    - full_name: David Juergens
      affiliation: Institute for Protein Design and Molecular Engineering and Sciences Institute, University of Washington, Seattle, WA
      corresponding: no
    - full_name: Victor Adebomi
      affiliation: Department of Medicinal Chemistry and Institute for Protein Design, University of Washington, Seattle, WA
      corresponding: no
    - full_name: Gaurav Bhardwaj
      affiliation: Department of Medicinal Chemistry and Institute for Protein Design, University of Washington, Seattle, WA
      corresponding: no
    - full_name: David Baker
      affiliation: Institute for Protein Design and Department of Biochemistry, University of Washington, Seattle, WA
      corresponding: no
    - full_name: Frank DiMaio
      affiliation: Institute for Protein Design and Department of Biochemistry, University of Washington, Seattle, WA
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle, WA
sources:
  - https://doi.org/10.1038/s41589-025-01929-w
---

# Diffusion-designed macrocycles bind four proteins with structures matching the models

*A University of Washington team designed cyclic peptide binders de novo, reaching single-digit nanomolar affinity and sub-angstrom agreement with solved crystal structures.*

**What was done.** Stephen Rettie, David Juergens, Victor Adebomi and colleagues in the Institute for Protein Design at the University of Washington, with Gaurav Bhardwaj, David Baker and Frank DiMaio as corresponding authors, published RFpeptides in Nature Chemical Biology on 20 June 2025. It is peer reviewed. The pipeline adds cyclic relative positional encoding to the RoseTTAFold2 structure network and the RFdiffusion backbone generator, so the diffusion model produces head-to-tail cyclic peptide backbones, then ProteinMPNN assigns sequences. Candidates were filtered with AfCycDesign and RoseTTAFold2 repredictions plus Rosetta interface metrics before synthesis.

**What they made and measured.** The team ran RFpeptides against four proteins, MCL1, MDM2, GABARAP and Rhombotarget A, a surface protein from the pathogen Acinetobacter baumannii that has no experimental structure. After generating tens of thousands of backbones per target, they selected 77 macrocycles for Fmoc solid-phase synthesis and head-to-tail cyclization. Cyclization losses left 39 for surface plasmon resonance. Twelve bound their targets. The strongest, a GABARAP binder, reached a dissociation constant of 6 nanomolar, and the RbtA binder RBB_D10 reached 9.4 nanomolar despite being designed against a predicted structure. Five X-ray crystal structures were solved and matched the design models closely, with macrocycle Calpha root-mean-square deviations under 1.5 angstrom.

**What it shows.** This is the first robust framework for de novo design of protein-binding macrocycles with experimentally confirmed, atomically accurate binding modes. The agreement between designed and crystallographic structures, including for a target modeled only by prediction, marks a clear advance over earlier physics-based macrocycle design that achieved modest affinity and often did not match solved structures.

**Caveats.** Many designs failed the chemical cyclization step, so experimental throughput was much lower than the in silico output. Affinities for MCL1 and MDM2 stayed in the micromolar range, and only GABARAP and RbtA reached nanomolar binders. The expression host question does not apply, since the macrocycles are chemically synthesized rather than expressed.

**Why it matters for provenance.** A head-to-tail cyclic peptide is not fully described by a linear coding sequence, because the bond that closes the ring and the designed backbone geometry are part of the molecule. A registry that assumes a linear sequence is the whole object will miss what makes a macrocycle a macrocycle.

**In plain words.** A macrocycle is a short chain joined head to tail into a ring, which makes it tough and small enough to reach places a full protein cannot. The team designed rings to grip four chosen proteins. Seventy-seven were made by chemistry, many failed to close properly, and those that worked matched their crystal photographs almost exactly.

Source: Stephen A. Rettie, David Juergens, Victor Adebomi and colleagues, with David Baker, Frank DiMaio and Gaurav Bhardwaj. Accurate de novo design of high-affinity protein-binding macrocycles using deep learning. Nature Chemical Biology, published online 20 June 2025, doi 10.1038/s41589-025-01929-w. https://doi.org/10.1038/s41589-025-01929-w
