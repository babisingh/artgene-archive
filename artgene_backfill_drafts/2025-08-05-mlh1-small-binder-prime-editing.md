---
title: A compact AI-designed binder that boosts prime editing
subtitle: Seoul National University researchers used RFdiffusion to design an 82-residue protein that blocks mismatch repair and raises prime editing efficiency in cells and in mice.
status: reviewed
item_type: validated-sequence
item_date: 2025-08-05
peer_reviewed: yes
tinsel_relevance: high
tinsel_note: MLH1-SB is a small fully encodable protein that is delivered as part of an editing construct, so its coding sequence is the complete object for any provenance record, although it was not deposited at preprint stage.
archive:
  doi: 10.1016/j.cell.2025.07.010
  source_title: AI-generated MLH1 small binder improves prime editing efficiency
  container: Cell
  biosafety_class: none
  molecule_type: protein
  generating_model: RFdiffusion for de novo binder backbone generation, with AlphaFold 3 used as a filtering and competition-test scoring system
  model_availability: open-weights
  design_target: a de novo small protein binder to the MLH1 and PMS2 dimeric interface that inhibits mismatch repair and so increases prime editing efficiency
  n_designed: 1978
  n_tested: 60
  n_functional: 5
  counts_note: Values are from the bioRxiv preprint read for this entry. RFdiffusion generated 1,978 candidate binders; 60 top candidates were experimentally tested, comprising 20 main-site, 23 combined-site and 17 lower-ranked control designs; 5 raised prime editing more than 2.5-fold at both RNF2 and HEK3, and the 82-residue MLH1-SB was taken forward. The published Cell abstract reports different headline fold-changes.
  assays: [activity, in-vivo, expression]
  expression_host: HUMAN
  sequences_deposited: no
  accessions: []
  article_license_spdx: CC-BY-NC-4.0
  data_license_spdx: UNSTATED
  data_license: CrossRef lists the Cell version of record as Creative Commons Attribution NonCommercial 4.0. The preprint read for this entry deposited no sequences and listed its code as forthcoming at github.com/baelab/PE-SB. A GEO series (GSE293633) is associated with the published version in third-party indexes but was not verifiable from a full text read here, so it is not listed as an accession.
  staging: none
  staging_reason: No sequences were deposited in the full text read for this entry (the bioRxiv preprint), so there is nothing to stage.
  ethics_code: Animal experiments were performed in mice; approval details are in the published paper, which was not accessible here.
credit:
  authors:
    - full_name: Ju-Chan Park
      affiliation: Genomic Medicine Institute, Seoul National University College of Medicine, Seoul, Republic of Korea
      corresponding: no
    - full_name: Heesoo Uhm
      affiliation: Genomic Medicine Institute, Seoul National University College of Medicine, Seoul, Republic of Korea
      corresponding: no
    - full_name: Yong-Woo Kim
      affiliation: Department of Biomedical Sciences, Seoul National University College of Medicine, Seoul, Republic of Korea
      corresponding: no
    - full_name: Ye Eun Oh
      affiliation: Department of Biomedical Sciences, Seoul National University College of Medicine, Seoul, Republic of Korea
      corresponding: no
    - full_name: Sangsu Bae
      affiliation: Genomic Medicine Institute, Seoul National University College of Medicine, Seoul, Republic of Korea
      corresponding: yes
  institution: Genomic Medicine Institute, Seoul National University College of Medicine, Seoul
sources:
  - https://doi.org/10.1016/j.cell.2025.07.010
  - https://www.biorxiv.org/content/10.1101/2024.09.11.612443v1
---

# A compact AI-designed binder that boosts prime editing

*Seoul National University researchers used RFdiffusion to design an 82-residue protein that blocks mismatch repair and raises prime editing efficiency in cells and in mice.*

**What was done.** Ju-Chan Park, Heesoo Uhm, Sangsu Bae and colleagues at the Genomic Medicine Institute, Seoul National University College of Medicine, reported this work in Cell, published 5 August 2025 after peer review. Prime editing installs precise edits but is held back by cellular mismatch repair, which excises the edited strand. The usual fix is transient expression of a dominant-negative MLH1, a large protein. The team instead used the generative model RFdiffusion, with AlphaFold 3 for filtering, to design a small de novo protein that binds the dimeric interface of MLH1 and PMS2 and disrupts assembly of the repair complex. The final binder, MLH1-SB, is only 82 amino acids, compact enough to be fused into existing prime editors through a 2A self-cleaving system.

**What they made and measured.** RFdiffusion generated 1,978 candidate binders at the main binding and critical activity hotspots, and after AlphaFold 3 scoring the top candidates were taken to the bench: 20 at the main site, 23 at the combined site and 17 lower-ranked controls. Five binders raised prime editing efficiency more than 2.5-fold at both the RNF2 and HEK3 loci, and the smallest of these became MLH1-SB. Built into the PE7 architecture, the resulting PE7-SB platform reached the highest prime editing efficiency the authors report, about 29.4-fold over PE2 and 2.4-fold over PE7 in HeLa cells in the version read here. The approach also improved editing in mice.

**What it shows.** This is a working demonstration that a generative protein design model can produce a functional, genetically encodable tool that slots into an existing genome-editing system and measurably improves it, replacing a bulky natural inhibitor with a purpose-built small binder.

**Caveats.** The full text read for this entry is the bioRxiv preprint, since the published Cell article is behind a paywall. The published abstract reports somewhat different headline figures, including an 18.8-fold gain over PEmax, 2.5-fold over PE7 in HeLa cells and 3.4-fold over PE7 in mice, so the counts above should be read as the preprint values. The preprint deposited no sequences; its code was listed as forthcoming.

**Why it matters for provenance.** MLH1-SB is a small, fully encodable protein that becomes part of a delivered editing construct, so its coding sequence is the whole object and is straightforward to register, though the authors had not deposited it at preprint stage.

Source: Ju-Chan Park, Heesoo Uhm, Yong-Woo Kim, Ye Eun Oh and Sangsu Bae. AI-generated MLH1 small binder improves prime editing efficiency. Cell, published 5 August 2025, doi 10.1016/j.cell.2025.07.010. https://doi.org/10.1016/j.cell.2025.07.010
