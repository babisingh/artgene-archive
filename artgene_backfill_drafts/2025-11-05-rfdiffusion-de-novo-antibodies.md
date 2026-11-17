---
title: Antibodies designed atom by atom against chosen epitopes
subtitle: A University of Washington team fine-tuned RFdiffusion to generate antibodies that bind user-specified epitopes, with cryo-electron microscopy confirming the designed loops.
status: reviewed
item_type: validated-sequence
item_date: 2025-11-05
peer_reviewed: yes
tinsel_relevance: high
tinsel_note: Designed antibodies are fully specified by their heavy and light chain sequences, and the validating structures and training data are deposited, so the designs are clean objects for sequence-level provenance.
archive:
  doi: 10.1038/s41586-025-09721-5
  source_title: Atomically accurate de novo design of antibodies with RFdiffusion
  container: Nature
  biosafety_class: none
  molecule_type: protein
  function_class: binder
  subject_class: virion
  classification_note: >-
    Six targets, of which influenza haemagglutinin, RSV sites I and III and
    the SARS-CoV-2 RBD are viral. Toxin B and IL-7R alpha are not, so this is
    the plurality rather than the whole.
  generating_model: RFdiffusion fine-tuned for antibody design, with ProteinMPNN for complementarity-determining region sequence design and a fine-tuned RoseTTAFold for filtering
  model_availability: open-weights
  design_target: de novo VHHs, single-chain variable fragments and full antibodies that bind user-specified epitopes on targets including Clostridioides difficile toxin B, influenza haemagglutinin, RSV sites I and III, SARS-CoV-2 RBD, IL-7R alpha and a PHOX2B peptide-MHC complex
  n_designed: unknown
  n_tested: unknown
  n_functional: unknown
  counts_note: About 9,000 computationally filtered designs were screened per target by yeast display for several targets, with per-target success rates from 0 to about 2 percent. VHH binders to four disease-relevant epitopes were experimentally characterized; two were confirmed by cryo-electron microscopy. The paper does not report single clean designed/tested/functional integers across all targets.
  assays: [expression, binding, structure, affinity-maturation]
  expression_host: YEAST
  sequences_deposited: partial
  accessions:
    - database: zenodo
      accession: 15741710
      url: https://zenodo.org/records/15741710
    - database: other
      accession: EMD-49373
      url: https://www.ebi.ac.uk/emdb/EMD-49373
    - database: other
      accession: EMD-49405
      url: https://www.ebi.ac.uk/emdb/EMD-49405
    - database: pdb
      accession: 9NFU
      url: https://www.rcsb.org/structure/9NFU
    - database: pdb
      accession: 9NH7
      url: https://www.rcsb.org/structure/9NH7
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is Creative Commons Attribution 4.0. The paper states no separate data licence. The antibody training dataset is on Zenodo (record 15741710); cryo-EM maps are in the EMDB (EMD-49373, EMD-49405) and atomic models in the PDB (9NFU, 9NH7); design and analysis code is in the RFantibody GitHub repository.
  staging: staged
  staging_reason: 
  ethics_code: none stated
credit:
  authors:
    - full_name: Nathaniel R. Bennett
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Joseph L. Watson
      orcid: 0000-0001-5492-0249
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Robert J. Ragotte
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Andrew J. Borst
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: DéJenaé L. See
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Connor Weidle
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Riti Biswas
      orcid: 0000-0003-3766-1980
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Yutong Yu
      orcid: 0009-0000-4656-9700
      affiliation: Department of Biomedical Engineering, University of California, Irvine, CA USA
      corresponding: no
    - full_name: Ellen L. Shrock
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Russell Ault
      affiliation: Department of Pediatrics, Children’s Hospital of Philadelphia, Philadelphia, PA USA
      corresponding: no
    - full_name: Philip J. Y. Leung
      orcid: 0000-0002-1801-8968
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Buwei Huang
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Inna Goreshnik
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: John Tam
      affiliation: Molecular Medicine Program, The Hospital for Sick Children, Toronto, Ontario Canada
      corresponding: no
    - full_name: Kenneth D. Carr
      orcid: 0009-0005-1929-3952
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Benedikt Singer
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Cameron Criswell
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Basile I. M. Wicky
      orcid: 0000-0002-2501-7875
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Dionne Vafeados
      orcid: 0000-0002-2560-8907
      affiliation: Institute for Protein Design, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Mariana Garcia Sanchez
      orcid: 0009-0002-9194-0251
      affiliation: Institute for Protein Design, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Ho Min Kim
      orcid: 0000-0003-0029-3643
      affiliation: Center for Biomolecular and Cellular Structure, Institute for Basic Science (IBS), Daejeon, Republic of Korea
      corresponding: no
    - full_name: Susana Vázquez Torres
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Sidney Chan
      orcid: 0000-0002-1617-0464
      affiliation: Institute for Protein Design, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Shirley M. Sun
      orcid: 0009-0007-6764-5750
      affiliation: Center for Computational and Genomic Medicine, Department of Pathology and Laboratory Medicine, Children’s Hospital of Philadelphia, Philadelphia, PA USA
      corresponding: no
    - full_name: Timothy T. Spear
      affiliation: Division of Oncology and Center for Childhood Cancer Research, Children’s Hospital of Philadelphia, Philadelphia, PA USA
      corresponding: no
    - full_name: Yi Sun
      affiliation: Center for Computational and Genomic Medicine, Department of Pathology and Laboratory Medicine, Children’s Hospital of Philadelphia, Philadelphia, PA USA
      corresponding: no
    - full_name: Keelan O’Reilly
      orcid: 0009-0005-9907-9859
      affiliation: Division of Oncology and Center for Childhood Cancer Research, Children’s Hospital of Philadelphia, Philadelphia, PA USA
      corresponding: no
    - full_name: John M. Maris
      orcid: 0000-0002-8088-7929
      affiliation: Department of Pediatrics, Perelman School of Medicine at the University of Pennsylvania, Philadelphia, PA USA
      corresponding: no
    - full_name: Nikolaos G. Sgourakis
      orcid: 0000-0003-3655-3902
      affiliation: Center for Computational and Genomic Medicine, Department of Pathology and Laboratory Medicine, Children’s Hospital of Philadelphia, Philadelphia, PA USA
      corresponding: no
    - full_name: Roman A. Melnyk
      orcid: 0000-0002-7187-2362
      affiliation: Molecular Medicine Program, The Hospital for Sick Children, Toronto, Ontario Canada
      corresponding: no
    - full_name: Chang C. Liu
      orcid: 0000-0002-3290-2880
      affiliation: Department of Biomedical Engineering, University of California, Irvine, CA USA
      corresponding: no
    - full_name: David Baker
      orcid: 0000-0001-7896-6217
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle
sources:
  - https://doi.org/10.1038/s41586-025-09721-5
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC12727541/
---

# Antibodies designed atom by atom against chosen epitopes

*A University of Washington team fine-tuned RFdiffusion to generate antibodies that bind user-specified epitopes, with cryo-electron microscopy confirming the designed loops.*

**What was done.** Antibody discovery normally relies on immunization or library screening, neither of which lets a researcher choose the target site in advance. The team fine-tuned the RFdiffusion generative network for antibodies and paired it with yeast display screening to produce de novo heavy-chain-only variable domains, single-chain variable fragments and full antibodies aimed at a chosen epitope, with ProteinMPNN designing the complementarity-determining regions.

**What they made and measured.** Designs were generated against targets including Clostridioides difficile toxin B, influenza H1 haemagglutinin, respiratory syncytial virus sites I and III, the SARS-CoV-2 receptor-binding domain and IL-7 receptor alpha. For several targets about 9,000 computationally filtered designs were screened per target by yeast display, with success rates running from zero to roughly two percent. Cryo-electron microscopy confirmed the binding pose of designed VHHs against influenza haemagglutinin and toxin B, and a high-resolution influenza structure verified the atomic accuracy of the designed loops. Initial designs bound at tens to hundreds of nanomolar; affinity maturation with the OrthoRep in vivo hypermutation system reached single-digit nanomolar while preserving the intended binding mode. Single-chain fragments were also designed against toxin B and a PHOX2B peptide-MHC complex.

**What it shows.** This is the first demonstration of designing epitope-specific antibodies entirely in silico with atomic-level structural accuracy, verified by cryo-electron microscopy rather than prediction alone. It moves antibody generation from immunization and random screening toward targeted computational design. The per-target success rate is low, from zero to about two percent, so many designs must be screened to find binders, and initial affinities were modest before OrthoRep maturation.

**Caveats.** The per-target success rate is low, from zero to about two percent, so many designs must be screened to find binders, and initial affinities were modest before OrthoRep maturation. The cryo-electron microscopy validation covers two targets rather than all. Several authors are inventors on a patent covering the pipeline and some are employed by a company, which the paper discloses.

**Why it matters for provenance.** The designed antibodies are fully encoded by their heavy and light chain sequences, and the training data and validating structures are deposited, so these designs are cleanly described at the sequence level for any registry.

**In plain words.** Antibodies are the body's grabbing tools. Normally you get them by injecting an animal and waiting to see what its immune system invents, which means you cannot choose which part of the germ gets grabbed. This team pointed at one spot and designed a gripper for exactly that spot. Most failed, roughly one or two in a hundred worked, but the ones that worked gripped where they were told to, and an electron microscope showed them sitting as drawn. Choosing the spot is what immunization cannot give you.

Source: Nathaniel R. Bennett, Joseph L. Watson, Robert J. Ragotte and colleagues, including David Baker. Atomically accurate de novo design of antibodies with RFdiffusion. Nature, published 5 November 2025, doi 10.1038/s41586-025-09721-5. https://doi.org/10.1038/s41586-025-09721-5
