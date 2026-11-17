---
title: Designing peptide binders from sequence alone, with no target structure required
subtitle: A Duke University team perturbs a protein language model and screens with a CLIP-style ranker, then shows the resulting peptides bind, inhibit and degrade targets in cells, including a disordered fusion oncoprotein.
status: reviewed
item_type: validated-sequence
item_date: 2025-01-24
peer_reviewed: yes
tinsel_relevance: high
tinsel_note: These peptides are generated from a language model using only a target sequence and carry no structural template, so the only record of their origin is the sequence itself, which makes a sequence-level provenance scheme both necessary and sufficient here.
archive:
  doi: 10.1126/sciadv.adr8638
  source_title: De novo design of peptide binders to conformationally diverse targets with contrastive language modeling
  container: Science Advances
  biosafety_class: none
  molecule_type: protein
  function_class: binder
  subject_class: soluble_protein
  generating_model: PepPrCLIP, which perturbs ESM-2-650M peptide embeddings with Gaussian noise to generate candidates and ranks them with a CLIP-style contrastive peptide-target model
  model_availability: open-weights
  design_target: short linear peptides that bind a user-specified target protein, deployed as inhibitory peptides and as guide peptides fused to the CHIP E3 ubiquitin ligase for targeted degradation
  n_designed: unknown
  n_tested: 36
  n_functional: unknown
  counts_note: 'The pipeline ranks roughly 100,000 candidates per target. Across three targets, 36 PepPrCLIP peptides were selected and tested: 20 against the enzyme UltraID, of which 19 inhibited it and 4 by more than 75 percent; 6 against beta-catenin, of which 4 reduced Wnt reporter activity and 2 were confirmed degraders binding at 150 and 200 nM; and 10 against the SS18-SSX1 fusion oncoprotein, of which SS_PpC_4 drove more than 40 percent degradation.'
  assays: [binding, activity, degradation, biolayer-interferometry, elisa, immunoblot, flow-cytometry, luciferase-reporter]
  expression_host: ECOLI
  sequences_deposited: yes
  accessions:
    - database: zenodo
      accession: 10.5281/zenodo.13917484
      url: https://doi.org/10.5281/zenodo.13917484
    - database: other
      accession: huggingface.co/ubiquitx/pepprclip
      url: https://huggingface.co/ubiquitx/pepprclip
  article_license_spdx: CC-BY-NC-4.0
  data_license_spdx: UNSTATED
  data_license: The article is Creative Commons Attribution NonCommercial 4.0. Raw and processed data including peptide sequences are on Zenodo without a stated reuse licence, and the model code is released under a noncommercial, research-only academic licence.
  staging: staged
  staging_reason: Peptide sequences are deposited on Zenodo and listed in the supplementary tables, so deposited material exists to stage.
  ethics_code: none stated
credit:
  authors:
    - full_name: Suhaas Bhat
      affiliation: Department of Biomedical Engineering, Duke University, Durham, NC
      corresponding: no
    - full_name: Kalyan Palepu
      affiliation: Department of Biomedical Engineering, Duke University, Durham, NC
      corresponding: no
    - full_name: Pranam Chatterjee
      affiliation: Department of Biomedical Engineering and Department of Computer Science, Duke University, Durham, NC
      corresponding: yes
  institution: Department of Biomedical Engineering, Duke University, Durham, NC
sources:
  - https://doi.org/10.1126/sciadv.adr8638
---

# Designing peptide binders from sequence alone, with no target structure required

*A Duke University team perturbs a protein language model and screens with a CLIP-style ranker, then shows the resulting peptides bind, inhibit and degrade targets in cells, including a disordered fusion oncoprotein.*

**What was done.** Suhaas Bhat, Kalyan Palepu and colleagues in Pranam Chatterjee's group at Duke University published this work in Science Advances on 24 January 2025. It is peer reviewed. Their pipeline, PepPrCLIP, needs only the amino acid sequence of a target. It samples the latent space of the ESM-2 protein language model by adding Gaussian noise to the embeddings of natural peptides, decodes new sequences, and then ranks them for target binding with a contrastive model built in the style of OpenAI's CLIP. Unlike structure-based design, nothing about the target fold is supplied, so the method can be aimed at disordered proteins.

**What they made and measured.** The team tested 36 PepPrCLIP peptides across three targets. Against the engineered biotin ligase UltraID, 20 inhibitory peptides were expressed, 19 reduced enzyme activity in cells and 4 by more than 75 percent. Against beta-catenin, 6 peptides were fused to the CHIP ubiquitin ligase, 4 lowered Wnt reporter signaling, and 2 drove more than 50 percent degradation with binding affinities of 150 and 200 nM measured by biolayer interferometry and confirmed by ELISA. Against the highly disordered synovial sarcoma fusion SS18-SSX1, 10 peptides were tested and one, SS_PpC_4, cut fusion protein levels by more than 40 percent in a patient-derived cell line, verified by flow cytometry and immunoblot.

**What it shows.** This is a de novo binder design method that works from sequence alone, with no three dimensional structure of the target. On the structured enzyme UltraID it matched or exceeded structure-based RFdiffusion, and it reached targets that structure-based tools cannot easily address, including an intrinsically disordered oncoprotein.

**Caveats.** Measured affinities are mid-nanomolar rather than tight, functional hit rates vary by target, and the strongest degradation of the fusion oncoprotein came from a single peptide out of ten. Selectivity across the proteome was not characterized.

**Why it matters for provenance.** Because the designs carry no structural template and are generated from a language model, the sequence is the whole object. The authors deposited sequences on Zenodo and released the model under an academic licence, so this is a clean example of an AI designed set whose origin can be recorded at the sequence level.

**In plain words.** To block a protein you normally need a picture of its shape, and some proteins never hold still long enough to have one. This method works from the target's sequence alone: it nudges a language model's reading of a peptide to invent candidates, then uses a second model to judge which of them suit the target. Of twenty made against one enzyme, nineteen slowed it down.

Source: Suhaas Bhat, Kalyan Palepu and colleagues, Pranam Chatterjee corresponding. De novo design of peptide binders to conformationally diverse targets with contrastive language modeling. Science Advances, 24 January 2025. doi 10.1126/sciadv.adr8638. https://doi.org/10.1126/sciadv.adr8638
