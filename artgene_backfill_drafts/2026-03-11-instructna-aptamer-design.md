---
title: A language model paired with SELEX writes DNA aptamers that beat the screened candidates
subtitle: A Hangzhou team combined a nucleic-acid language model with Bayesian optimization to generate DNA aptamers binding LOX1 and CXCL5 at nanomolar affinity.
status: reviewed
item_type: validated-sequence
item_date: 2026-03-11
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: The designs are short single-stranded DNA oligonucleotides, fully described by their sequence, so they fit a sequence-level provenance record cleanly but are cheap to synthesize anywhere.
archive:
  doi: 10.1038/s43588-026-00965-3
  source_title: De novo design of functional nucleic acids of aptamers
  container: Nature Computational Science
  biosafety_class: none
  molecule_type: dna
  generating_model: InstructNA, a nucleic-acid language model continually pretrained on HT-SELEX data, DNABERT by default and also tested with Evo1 and Nucleotide Transformer, coupled to the HC-HEBO hill-climbing Bayesian optimization algorithm for latent-space directed evolution
  model_availability: open-weights
  design_target: de novo functional nucleic acids, transcription-factor-binding DNA with higher binding specificity and DNA aptamers with higher binding affinity to protein targets LOX1, CXCL5 and PTK7
  n_designed: 20
  n_tested: 20
  n_functional: 7
  counts_note: Counts cover the wet-lab aptamer validation and are floors. Transcription-factor-binding DNA sequences were assessed only in silico by a binding-specificity score, not in the lab. For aptamers, InstructNA generated 10 per protein, LOX1 and CXCL5, all measured by surface plasmon resonance, of which 4 of 10 for LOX1 and 3 of 10 for CXCL5 were strong binders with dissociation constant at or below 100 nanomolar, best values 12.9 nanomolar for LOX1 and 6.6 nanomolar for CXCL5. Additional strong binders for PTK7 are reported without a stated count.
  assays: [binding]
  expression_host: not stated
  sequences_deposited: partial
  accessions:
    - database: ena
      accession: ERP001824
      url: https://www.ebi.ac.uk/ena/browser/view/ERP001824
    - database: other
      accession: github.com/zhimingzhang275/InstructNA
      url: https://github.com/zhimingzhang275/InstructNA
  article_license_spdx: CC-BY-NC-ND-4.0
  data_license_spdx: UNSTATED
  data_license: The article is CC-BY-NC-ND 4.0. The ENA accession ERP001824 is the pre-existing transcription-factor HT-SELEX dataset the authors downloaded for training, not a deposit of their designs. The authors state all study data are in the main text and Supplementary Information and the InstructNA code is on GitHub and Code Ocean, but no separate licence is stated for the sequence data.
  staging: staged
  staging_reason: Generated aptamer sequences for LOX1 and CXCL5 are listed in the Supplementary Tables and the code is public, so the designs are obtainable. The designed aptamer sequences are not deposited to a sequence database, and the ENA accession listed is reused training data rather than a design deposit.
  ethics_code: none stated
credit:
  authors:
    - full_name: Zhiming Zhang
      affiliation: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China
      corresponding: no
    - full_name: Meng Jiang
      affiliation: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China
      corresponding: no
    - full_name: Axin He
      affiliation: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China
      corresponding: no
    - full_name: Youyuan Zhu
      affiliation: Zhejiang Laboratory, Hangzhou, China
      corresponding: no
    - full_name: Ercheng Wang
      affiliation: Zhejiang Laboratory, Hangzhou, China
      corresponding: no
    - full_name: Liqi Wan
      affiliation: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China
      corresponding: no
    - full_name: Jiezhong Qiu
      affiliation: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China
      corresponding: no
    - full_name: Pei Guo
      affiliation: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China
      corresponding: no
    - full_name: Guangyong Chen
      affiliation: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China
      corresponding: no
    - full_name: Da Han
      affiliation: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China, and Institute of Molecular Medicine, Renji Hospital, School of Medicine, Shanghai Jiao Tong University, Shanghai, China
      corresponding: yes
  institution: Zhejiang Key Laboratory of Functional Nucleic Acids for Basic and Clinical Application, Hangzhou, China
sources:
  - https://doi.org/10.1038/s43588-026-00965-3
---

# A language model paired with SELEX writes DNA aptamers that beat the screened candidates

*A Hangzhou team combined a nucleic-acid language model with Bayesian optimization to generate DNA aptamers binding LOX1 and CXCL5 at nanomolar affinity.*

**What was done.** Zhiming Zhang, Meng Jiang and colleagues at the Zhejiang Key Laboratory of Functional Nucleic Acids, with Jiezhong Qiu, Pei Guo, Guangyong Chen and Da Han as the four corresponding authors, published InstructNA in Nature Computational Science on 11 March 2026. It is peer reviewed. Functional nucleic acid design has lagged protein design because nucleic acids have few experimental structures and high flexibility. InstructNA sidesteps structure prediction. It continually pretrains a nucleic-acid language model, DNABERT by default, on high-throughput SELEX reads, then uses a new hill-climbing Bayesian optimization method called HC-HEBO to evolve sequences in the model latent space inside a generation and evaluation loop.

**What they made and measured.** The team tested two tasks. For transcription-factor-binding DNA, assessed in silico by a binding-specificity score, InstructNA outperformed the RaptGen baseline across benchmark datasets. For aptamers, the lab work, they ran HT-SELEX against LOX1 and CXCL5, trained InstructNA on the final round and generated 10 aptamers per target. Surface plasmon resonance showed four strong LOX1 binders, best dissociation constant 12.9 nanomolar, and three strong CXCL5 binders, best 6.6 nanomolar, with several generated aptamers beating the top SELEX candidates. One LOX1 design shared only 38 percent sequence similarity with its nearest screened aptamer. Strong binders for PTK7 were also generated.

**What it shows.** This is an early demonstration that language-model generation, fused with SELEX data and directed evolution in latent space, can design functional nucleic acids that exceed the molecules found by physical screening. It extends the sequence-only generative design paradigm from proteins to aptamers, a different chemical class.

**Caveats.** The wet-lab validation is binding only, by SPR, with no solved aptamer-target structure, since the reported structures come from AlphaFold3, docking and molecular dynamics. The transcription-factor results are computational. Functional counts are modest, 7 strong aptamer binders across the two fully reported targets, and PTK7 binders are reported without a number. Success varied sharply by dataset.

**Why it matters for provenance.** A short single-stranded DNA aptamer is fully specified by its sequence, so it maps cleanly to a sequence-level catalogue entry. The flip side is that such designs are inexpensive to synthesize from a public model, so the record matters precisely because the barrier to reproduction is low.

Source: Zhiming Zhang, Meng Jiang, Axin He, Youyuan Zhu, Ercheng Wang, Liqi Wan, Jiezhong Qiu, Pei Guo, Guangyong Chen and Da Han. De novo design of functional nucleic acids of aptamers. Nature Computational Science, published online 11 March 2026, doi 10.1038/s43588-026-00965-3. https://doi.org/10.1038/s43588-026-00965-3
