---
title: Machine learning picks AAV capsids that clear six tests at once
subtitle: "Benjamin Deverman's group at the Broad Institute trained sequence-to-function models that designed liver-targeted, manufacturable capsid variants, 88 percent of which met all six criteria."
status: reviewed
item_type: validated-sequence
item_date: 2024-08-04
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: The designed objects are short peptide insertions into a natural AAV9 capsid chosen by machine learning for several traits at once, so the provenance of a gene therapy vector increasingly rests on a model and a training dataset rather than on a selection history alone.
archive:
  doi: 10.1038/s41467-024-50555-y
  source_title: Systematic multi-trait AAV capsid engineering for efficient gene delivery
  container: Nature Communications
  biosafety_class: none
  molecule_type: protein
  function_class: shell
  subject_class:
  classification_note: >-
    The capsids are aimed at liver tissue across species. There is no cell or
    tissue value in SUBJECT_CLASSES, and naming the capsid itself as the
    subject would describe the thing rather than what it acts on.
  generating_model: "Fit4Function, an ensemble of six sequence-to-function machine learning models including long short-term memory regression models, used to design 7-mer capsid insertions; no single version number stated"
  model_availability: open-weights
  design_target: AAV9 capsids carrying engineered 7-mer peptide insertions that are simultaneously manufacturable and liver-targeted across species
  n_designed: unknown
  n_tested: 7
  n_functional: 7
  counts_note: "The MultiFunction library of model-designed variants had an 88.4 percent validation rate for meeting all six criteria, against 2.6 percent for a uniform library and 7.0 percent for a production-fit library. Seven top variants, BI151 to BI157, were individually produced and validated; six of the seven showed reduced brain, spinal cord and kidney targeting, and leads transduced human hepatocyte lines 10 to 1000 fold better than AAV9. Exact designed and screened library sizes are not given as single integers."
  assays: [production, binding, transduction, in-vivo, biodistribution]
  expression_host: HUMAN
  sequences_deposited: yes
  accessions:
    - database: zenodo
      accession: 10.5281/zenodo.8401253
      url: https://doi.org/10.5281/zenodo.8401253
    - database: zenodo
      accession: 10.5281/zenodo.8388031
      url: https://doi.org/10.5281/zenodo.8388031
    - database: other
      accession: PRJNA1131359
      url: https://www.ncbi.nlm.nih.gov/bioproject/PRJNA1131359
    - database: other
      accession: Addgene 209523-209529
      url: https://www.addgene.org/
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is open access under CC BY 4.0. The paper does not state a separate licence for its Zenodo deposits, Sequence Read Archive data or Addgene plasmids, so the data licence is recorded as unstated.
  staging: staged
  staging_reason: Full plasmid sequences for the seven lead capsids BI151 to BI157 are deposited on Addgene and the supporting data are on Zenodo, and the designs are benign gene delivery vectors.
  ethics_code: Broad Institute IACUC approval number 0213-06-18-1 for mouse procedures; macaque work conducted under an approved institutional study plan.
credit:
  authors:
    - full_name: Fatma-Elzahraa Eid
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Albert T. Chen
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Ken Y. Chan
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Qin Huang
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Qingxia Zheng
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Isabelle G. Tobey
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Simon Pacouret
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Pamela P. Brauer
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Casey Keyes
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Megan Powell
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Jencilin Johnston
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Binhui Zhao
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Kasper Lage
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Alice F. Tarantal
      affiliation: California National Primate Research Center and Departments of Pediatrics and Cell Biology and Human Anatomy, University of California, Davis
      corresponding: no
    - full_name: Yujia A. Chan
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: no
    - full_name: Benjamin E. Deverman
      affiliation: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
      corresponding: yes
  institution: Stanley Center for Psychiatric Research, Broad Institute of MIT and Harvard, Cambridge
sources:
  - https://www.nature.com/articles/s41467-024-50555-y
---

# Machine learning picks AAV capsids that clear six tests at once

*Benjamin Deverman's group at the Broad Institute trained sequence-to-function models that designed liver-targeted, manufacturable capsid variants, 88 percent of which met all six criteria.*

**What was done.** A gene-therapy capsid has to survive manufacturing, evade the immune system and reach the right organ, and improving one of those traits usually spoils another. Conventional engineering funnels a random library through rounds of selection, which struggles when several clinical traits must hold at once. Fit4Function instead starts from a library that uniformly samples the manufacturable 7-mer insertion space of the AAV9 capsid, screens it to produce reproducible data, and trains sequence-to-function models. Six such models, covering production fitness and liver targeting in vitro and in vivo, were then combined to search the untested sequence space in silico for rare variants predicted to satisfy every criterion.

**What they made and measured.** The resulting MultiFunction library was validated at an 88.4 percent rate for meeting all six criteria, compared with 2.6 percent for a uniform library and 7.0 percent for a production-fit library. Seven top variants, deposited on Addgene as BI151 to BI157, were produced and characterized individually. They matched AAV9 for production yield, transduced human HEPG2 and THLE-2 hepatocyte lines 10 to 1000 fold better than AAV9, and transduced mouse liver efficiently. Six of the seven showed reduced targeting of brain, spinal cord and kidney. Models trained only on mouse in vivo and human in vitro data then predicted capsid biodistribution in macaque, and the leads were enriched for liver transduction in that species.

**What it shows.** Mapping sequence to multiple functions and composing the models replaces rounds of selection with prediction, and the cross-species transfer from rodent and cell data to macaque is the result worth noting. The designed objects are short peptide insertions into the natural AAV9 capsid rather than entirely new proteins, and the detailed in vivo validation rests on seven leads.

**Caveats.** The designed objects are short peptide insertions into the natural AAV9 capsid rather than entirely new proteins. Library-scale success is reported as validation rates rather than as a simple count of designs made and tested, and detailed in vivo validation rests on the seven leads.

**Why it matters for provenance.** When a vector is chosen by a model from a training dataset rather than by a traceable selection history, the record that explains why a capsid works is the model and its data, which a provenance scheme should capture alongside the sequence.

**In plain words.** Gene therapies travel inside empty virus shells. A shell has to survive manufacturing, slip past the immune system and reach the right organ, and improving one of those usually spoils another. The team trained models to predict all six requirements at once and designed shells to pass them together. About 88 in 100 did, against roughly 3 in 100 for shells picked at random.

Source: Fatma-Elzahraa Eid, Albert T. Chen, Ken Y. Chan and colleagues. Systematic multi-trait AAV capsid engineering for efficient gene delivery. Nature Communications, published 4 August 2024, doi 10.1038/s41467-024-50555-y. https://www.nature.com/articles/s41467-024-50555-y
