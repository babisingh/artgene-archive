---
title: Peptide binders designed from target sequence alone, with no structure required
subtitle: A Duke University group finetuned the ESM-2 language model to write linear peptide binders and degraders against cancer, reproductive and viral targets.
status: reviewed
item_type: validated-sequence
item_date: 2025-08-13
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: The binders are short linear peptides conditioned only on a target sequence, cheap to synthesize and easy to vary, which makes an accession-level provenance record useful but also easy to bypass.
archive:
  doi: 10.1038/s41587-025-02761-2
  source_title: Target sequence-conditioned design of peptide binders using masked language modeling
  container: Nature Biotechnology
  biosafety_class: none
  molecule_type: protein
  function_class: binder
  subject_class: soluble_protein
  classification_note: >-
    The targets span receptors and disordered proteins as well as soluble
    ones; soluble protein is the plurality, not the whole.
  generating_model: PepMLM, the ESM-2-650M protein language model finetuned with a span-masking strategy that reconstructs a masked binder region appended to the target protein sequence
  model_availability: open-weights
  design_target: de novo linear peptide binders conditioned on target protein sequence alone, used directly as binders and as guides in ubiquibody degraders against NCAM1, AMHR2, MSH3, mutant huntingtin, the henipavirus and metapneumovirus phosphoproteins and MESH1
  n_designed: 79
  n_tested: 79
  n_functional: 55
  counts_note: Counts aggregate several experiments and are floors. Binders, 4 against NCAM1 and 4 against AMHR2, all bound by ELISA near 60 nanomolar. Degraders in the ubiquibody format, 6 against MSH3 with 5 active, 5 against mutant huntingtin all active, and 20 each against the Nipah, Hendra and metapneumovirus phosphoproteins, of which 37 reduced protein by 20 to 49 percent, about a 63 percent hit rate. MESH1 degraders were also active but are not counted here. So n_designed and n_tested count 79 enumerated designs and n_functional counts 55.
  assays: [binding, activity, in-vivo]
  expression_host: HUMAN
  sequences_deposited: partial
  accessions:
    - database: zenodo
      accession: 10.5281/zenodo.15122756
      url: https://doi.org/10.5281/zenodo.15122756
    - database: other
      accession: huggingface.co/ChatterjeeLab/PepMLM-650M
      url: https://huggingface.co/ChatterjeeLab/PepMLM-650M
    - database: other
      accession: github.com/programmablebio/pepmlm
      url: https://github.com/programmablebio/pepmlm
  article_license_spdx: CC-BY-NC-ND-4.0
  data_license_spdx: UNSTATED
  data_license: The article is CC-BY-NC-ND 4.0, which governs the text and bars adapted material. Source data including raw immunoblots are at Zenodo (10.5281/zenodo.15122756) and the model, code and datasets are on Hugging Face and GitHub, but the paper states no separate licence for its sequence data. Designed peptide sequences are listed in the Supplementary Information.
  staging: staged
  staging_reason: Designed peptide sequences are provided in Supplementary Table 4 and the trained model is public on Hugging Face, so the designs are obtainable. Nothing is deposited to GenBank or UniProt.
  ethics_code: none stated
credit:
  authors:
    - full_name: Leo Tianlai Chen
      affiliation: Department of Biomedical Engineering, Duke University, Durham, NC
      corresponding: no
    - full_name: Zachary Quinn
      affiliation: Department of Biomedical Engineering, Duke University, Durham, NC
      corresponding: no
    - full_name: Madeleine Dumas
      affiliation: Department of Microbiology and Immunology, College of Veterinary Medicine, Cornell University, Ithaca, NY
      corresponding: no
    - full_name: Christina Peng
      affiliation: Department of Microbiology, Duke University, Durham, NC
      corresponding: no
    - full_name: Hector C. Aguilar
      affiliation: Department of Microbiology and Immunology, College of Veterinary Medicine, Cornell University, Ithaca, NY
      corresponding: no
    - full_name: Pranam Chatterjee
      affiliation: Department of Biomedical Engineering, Department of Computer Science and Department of Biostatistics and Bioinformatics, Duke University, Durham, NC, with present address Department of Bioengineering and Computer and Information Science, University of Pennsylvania, Philadelphia, PA
      corresponding: yes
  institution: Department of Biomedical Engineering, Duke University, Durham, NC
sources:
  - https://doi.org/10.1038/s41587-025-02761-2
---

# Peptide binders designed from target sequence alone, with no structure required

*A Duke University group finetuned the ESM-2 language model to write linear peptide binders and degraders against cancer, reproductive and viral targets.*

**What was done.** Leo Tianlai Chen, Zachary Quinn, Madeleine Dumas, Christina Peng and colleagues, with Pranam Chatterjee as corresponding author, published PepMLM in Nature Biotechnology on 13 August 2025, with wet-lab virology from the Hector Aguilar group at Cornell. It is peer reviewed. PepMLM finetunes the ESM-2-650M protein language model with a span-masking trick, placing a masked binder region at the C terminus of the target sequence and training the model to reconstruct it. Generation then needs only a target protein sequence and a chosen binder length, with no structure.

**What they made and measured.** The team first validated binders to two disease targets, NCAM1 in acute myeloid leukemia and AMHR2 in polycystic ovarian syndrome. Four PepMLM peptides per target all bound by ELISA near 60 nanomolar, outperforming RFdiffusion peptides designed against the same targets. They then fused peptides to an E3 ligase domain to build ubiquibody degraders expressed in human cells. Five of six anti-MSH3 designs lowered MSH3, all five anti-huntingtin designs cut mutant huntingtin after induction, and across three viral phosphoproteins, Nipah, Hendra and human metapneumovirus, 37 of 60 degraders reduced target protein by 20 to 49 percent. A MESH1 degrader also blocked ferroptotic cell death.

**What it shows.** PepMLM is a purely sequence-conditioned binder designer, which means it can target disordered or structurally unknown proteins that structure-based pipelines struggle with. It matched or beat a leading structure-based method on structured targets while also reaching the conformationally diverse, classically undruggable proteome.

**Caveats.** Reported affinities are ELISA-level signals near 60 nanomolar rather than full kinetic constants, and the degradation readouts are percentage reductions, modest in many cases. Counts span many sub-experiments, so the numbers here are floors. Some viral targets are from dangerous pathogens, but every designed object is a benign peptide binder or degrader, not any viral component.

**Why it matters for provenance.** Short linear peptides written from a target sequence are cheap to make and trivially mutable, so a design and its close relatives proliferate easily. A public model like this one lowers the barrier to generating binders, which strengthens the case for recording designs by sequence while acknowledging how easily such records are sidestepped.

**In plain words.** This method teaches a language model to write a short peptide that will stick to a target, given nothing but the target's sequence. Attached to a tag the cell uses to mark rubbish, those peptides drag their targets off to be destroyed. The targets included mutant huntingtin, the protein behind Huntington's disease, and proteins from two viruses.

Source: Leo Tianlai Chen, Zachary Quinn, Madeleine Dumas, Christina Peng and colleagues, with Hector C. Aguilar and Pranam Chatterjee. Target sequence-conditioned design of peptide binders using masked language modeling. Nature Biotechnology, published online 13 August 2025, doi 10.1038/s41587-025-02761-2. https://doi.org/10.1038/s41587-025-02761-2
