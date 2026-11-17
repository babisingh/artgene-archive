---
title: General protein language models matured seven human antibodies in two rounds
subtitle: A Stanford group used ESM language models that saw no antigen, structure or binding data, yet their suggested mutations improved antibody affinities up to 160-fold.
status: reviewed
item_type: validated-sequence
item_date: 2023-04-24
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: The designs are defined as single-residue substitutions to named clinical and germline antibodies, so a provenance record must capture the parent identity plus the edits, not a standalone sequence.
archive:
  doi: 10.1038/s41587-023-01763-2
  source_title: Efficient evolution of human antibodies from general protein language models
  container: Nature Biotechnology
  biosafety_class: none
  molecule_type: protein
  function_class: improver
  subject_class: soluble_protein
  generating_model: ESM-1b and the ESM-1v ensemble of five models, six general protein language models total, used without task-specific training
  model_availability: open-weights
  design_target: affinity maturation of human antibodies by proposing evolutionarily plausible single-residue substitutions, with no antigen, structure or binding information given to the model
  n_designed: 122
  n_tested: 121
  n_functional: unknown
  counts_note: 76 language-model-recommended single-residue substitutions were made across seven antibodies and combined into 122 variants, all but one of which expressed. The paper reports outcomes per antibody rather than one functional total, all seven antibodies yielded higher-affinity variants, 36 of the 76 single-residue substitutions improved Kd, and affinity gains reached up to 7-fold for four mature clinical antibodies and up to 160-fold for three unmatured antibodies.
  assays: [expression, binding, thermostability, neutralization]
  expression_host: HUMAN
  sequences_deposited: partial
  accessions:
    - database: zenodo
      accession: 10.5281/zenodo.6968342
      url: https://doi.org/10.5281/zenodo.6968342
    - database: zenodo
      accession: 10.5281/zenodo.6977562
      url: https://doi.org/10.5281/zenodo.6977562
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is CC-BY 4.0. Raw Kd, IC50 and Tm values are deposited at Zenodo (10.5281/zenodo.6968342) and provided as Supplementary Data, and code at Zenodo (10.5281/zenodo.6977562), but the paper states no separate licence for its data. Wild-type antibody sequences and the designed substitutions are given in the Supplementary Information rather than a sequence database.
  staging: staged
  staging_reason: The designed variants are single-residue substitutions to named parent antibodies, with wild-type sequences and substitutions listed in the Supplementary Information and plasmid-level raw data at Zenodo. Nothing is deposited to GenBank or UniProt for the designs.
  ethics_code: none stated
credit:
  authors:
    - full_name: Brian L. Hie
      affiliation: Department of Biochemistry, Stanford University School of Medicine, and Sarafan ChEM-H, Stanford University, Stanford, CA
      corresponding: no
    - full_name: Varun R. Shanker
      affiliation: Sarafan ChEM-H and Stanford Medical Scientist Training Program, Stanford University School of Medicine, Stanford, CA
      corresponding: no
    - full_name: Duo Xu
      affiliation: Department of Biochemistry, Stanford University School of Medicine, and Sarafan ChEM-H, Stanford University, Stanford, CA
      corresponding: no
    - full_name: Theodora U. J. Bruun
      affiliation: Department of Biochemistry, Stanford University School of Medicine, Stanford, CA
      corresponding: no
    - full_name: Payton A. Weidenbacher
      affiliation: Sarafan ChEM-H and Department of Chemistry, Stanford University, Stanford, CA
      corresponding: no
    - full_name: Shaogeng Tang
      affiliation: Department of Biochemistry, Stanford University School of Medicine, and Sarafan ChEM-H, Stanford University, Stanford, CA
      corresponding: no
    - full_name: Wesley Wu
      affiliation: Chan Zuckerberg Biohub, San Francisco, CA
      corresponding: no
    - full_name: John E. Pak
      affiliation: Chan Zuckerberg Biohub, San Francisco, CA
      corresponding: no
    - full_name: Peter S. Kim
      affiliation: Department of Biochemistry, Stanford University School of Medicine, and Sarafan ChEM-H, Stanford University, Stanford, CA
      corresponding: yes
  institution: Stanford University School of Medicine and Sarafan ChEM-H, Stanford University, Stanford, CA
sources:
  - https://doi.org/10.1038/s41587-023-01763-2
---

# General protein language models matured seven human antibodies in two rounds

*A Stanford group used ESM language models that saw no antigen, structure or binding data, yet their suggested mutations improved antibody affinities up to 160-fold.*

**What was done.** Brian Hie, Peter Kim and colleagues at Stanford University School of Medicine and Sarafan ChEM-H, with collaborators at the Chan Zuckerberg Biohub, reported this work in Nature Biotechnology on 24 April 2023. It is peer reviewed. The method takes general protein language models, ESM-1b and the five-model ESM-1v ensemble, and ranks every possible single-residue substitution to an antibody by how much more plausible the model considers the mutated sequence. Crucially, the models were never shown the antigen, the binding specificity or any structure. The team used the top-ranked substitutions to guide two short rounds of laboratory affinity maturation. Both Brian Hie and Peter Kim are listed as corresponding authors.

**What they made and measured.** Across seven antibodies, the models recommended 76 single-residue substitutions, which were built into 122 variants, measuring 20 or fewer per antibody. All but one of the 122 expressed in Expi293F human cells. Binding was measured by biolayer interferometry, with added thermostability melts and pseudovirus neutralization assays. Thirty-six of the 76 single substitutions improved the dissociation constant. Four clinically relevant mature antibodies gained up to sevenfold affinity, while three unmatured antibodies gained up to 160-fold, and several evolved variants kept or improved thermostability and neutralized Ebola and SARS-CoV-2 pseudoviruses.

**What it shows.** The step change here is efficiency and generality. Earlier maturation campaigns screen thousands of variants with antigen-specific data, whereas these models reached comparable or better gains with at most 20 variants per antibody and no target information, a result the authors call unprecedented. The same models also guided evolution of other protein families, including antibiotic resistance and enzyme activity.

**Caveats.** The designs are single-residue edits to existing antibodies, so they are close in sequence to their parents rather than fully de novo molecules. No structure of an evolved complex was solved. Functional success is reported per antibody rather than as a single count of working designs, so n_functional is left unknown. The clinical parent antibodies themselves are proprietary starting points.

**Why it matters for provenance.** A designed object defined as a parent antibody plus a few model-chosen substitutions cannot be registered by its own sequence alone, since the record only makes sense against the named parent. Any catalogue of such designs must store the parent identity and the specific edits together.

Source: Brian L. Hie, Varun R. Shanker, Duo Xu, Theodora U. J. Bruun, Payton A. Weidenbacher, Shaogeng Tang, Wesley Wu, John E. Pak and Peter S. Kim. Efficient evolution of human antibodies from general protein language models. Nature Biotechnology, published online 24 April 2023, doi 10.1038/s41587-023-01763-2. https://doi.org/10.1038/s41587-023-01763-2
