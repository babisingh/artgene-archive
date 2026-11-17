---
title: Designed repeat proteins that read a peptide one triplet at a time
subtitle: "A University of Washington team built hyperstable repeat proteins that clamp tripeptide-repeat peptides at nanomolar to picomolar affinity, with seven crystal structures confirming the design."
status: reviewed
item_type: validated-sequence
item_date: 2023-04-05
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: These binders are built from repeating units matched one-to-one to peptide triplets, so a designed protein can be programmed to recognize an arbitrary linear sequence, which is a provenance concern for any system that assumes recognition reagents come only from immunization or natural repertoires.
archive:
  doi: 10.1038/s41586-023-05909-9
  source_title: De novo design of modular peptide-binding proteins by superhelical matching
  container: Nature
  biosafety_class: none
  molecule_type: protein
  generating_model: "Geometric hashing to match protein backbones to peptide docking arrangements, with Rosetta FastDesign for sequence design; no version number stated"
  model_availability: open-weights
  design_target: repeat proteins that bind tripeptide-repeat peptides in polyproline II conformation through ladders of side chain to backbone hydrogen bonds
  n_designed: unknown
  n_tested: 54
  n_functional: 16
  counts_note: "Numbers are for the second, specificity-focused design round: 54 designed protein-peptide pairs tested by yeast display, 42 solubly expressed in E. coli, 16 bound with high affinity and specificity. A first round expressed 49 designs of which 30 were monomeric and soluble. Binders were raised against six tripeptide-repeat targets and seven crystal structures were solved."
  assays: [expression, binding, structure, in-cell]
  expression_host: ECOLI
  sequences_deposited: yes
  accessions:
    - database: pdb
      accession: 7UDJ
      url: https://www.rcsb.org/structure/7UDJ
    - database: pdb
      accession: 7UE2
      url: https://www.rcsb.org/structure/7UE2
    - database: pdb
      accession: 7UDK
      url: https://www.rcsb.org/structure/7UDK
    - database: pdb
      accession: 7UDL
      url: https://www.rcsb.org/structure/7UDL
    - database: pdb
      accession: 7UDM
      url: https://www.rcsb.org/structure/7UDM
    - database: pdb
      accession: 7UDN
      url: https://www.rcsb.org/structure/7UDN
    - database: pdb
      accession: 7UDO
      url: https://www.rcsb.org/structure/7UDO
    - database: other
      accession: PXD038492
      url: https://www.ebi.ac.uk/pride/archive/projects/PXD038492
    - database: supplementary
      accession: all_data_modular_peptide_binding_proteins.tar.gz
      url: https://files.ipd.uw.edu/pub/2023_modular_peptide_binding_proteins/all_data_modular_peptide_binding_proteins.tar.gz
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is published open access under CC BY 4.0. The paper states no separate licence for its deposited coordinates, proteomics data or design models, so the data licence is recorded as unstated.
  staging: staged
  staging_reason: All designed binder protein sequences are provided in Supplementary Table 2 and design models are on the Institute for Protein Design file server, and the designs are benign peptide binders.
  ethics_code: none stated
credit:
  authors:
    - full_name: Kejia Wu
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Hua Bai
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Ya-Ting Chang
      affiliation: Department of Cell Biology, New York University School of Medicine, New York
      corresponding: no
    - full_name: Rachel Redler
      affiliation: Department of Cell Biology, New York University School of Medicine, New York
      corresponding: no
    - full_name: Kerrie E. McNally
      affiliation: MRC Laboratory of Molecular Biology, Cambridge, UK
      corresponding: no
    - full_name: William Sheffler
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: T. J. Brunette
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Derrick R. Hicks
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Tomos E. Morgan
      affiliation: MRC Laboratory of Molecular Biology, Cambridge, UK
      corresponding: no
    - full_name: Tim J. Stevens
      affiliation: MRC Laboratory of Molecular Biology, Cambridge, UK
      corresponding: no
    - full_name: Adam Broerman
      affiliation: Institute for Protein Design and Department of Chemical Engineering, University of Washington, Seattle
      corresponding: no
    - full_name: Inna Goreshnik
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Michelle DeWitt
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Cameron M. Chow
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Yihang Shen
      affiliation: Department of Computational Biology, Carnegie Mellon University, Pittsburgh
      corresponding: no
    - full_name: Lance Stewart
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Emmanuel Derivery
      affiliation: MRC Laboratory of Molecular Biology, Cambridge, UK
      corresponding: no
    - full_name: Daniel Adriano Silva
      affiliation: Institute for Protein Design, University of Washington, Seattle, and Monod Bio, Seattle
      corresponding: no
    - full_name: Gira Bhabha
      affiliation: Department of Cell Biology, New York University School of Medicine, New York
      corresponding: no
    - full_name: Damian C. Ekiert
      affiliation: Departments of Cell Biology and Microbiology, New York University School of Medicine, New York
      corresponding: no
    - full_name: David Baker
      affiliation: Department of Biochemistry and Institute for Protein Design, University of Washington, and Howard Hughes Medical Institute, Seattle
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle
sources:
  - https://www.nature.com/articles/s41586-023-05909-9
---

# Designed repeat proteins that read a peptide one triplet at a time

*A University of Washington team built hyperstable repeat proteins that clamp tripeptide-repeat peptides at nanomolar to picomolar affinity, with seven crystal structures confirming the design.*

**What was done.** Kejia Wu, Hua Bai, David Baker and colleagues at the Institute for Protein Design, University of Washington, with collaborators at New York University School of Medicine and the MRC Laboratory of Molecular Biology, published this peer reviewed study in Nature on 5 April 2023. Emmanuel Derivery, Daniel Adriano Silva and David Baker are listed as co-corresponding authors; this record marks Baker. The aim was a general route to proteins that recognize a chosen linear peptide. Because repeat proteins and extended peptides both form superhelices, the team used geometric hashing to find backbone and docking arrangements where each protein repeat makes bidentate hydrogen bonds to one peptide triplet, then used Rosetta to design the rest of the sequence for folding and binding.

**What they made and measured.** In a first round, 49 designs were expressed in E. coli and 30 were monomeric and soluble; many bound, but affinity and specificity were modest. A revised protocol targeting three-residue repeats produced 54 protein-peptide pairs, of which 42 expressed solubly and 16 bound with much higher affinity and specificity. The proteins recognized six tripeptide-repeat targets in a polyproline II conformation, binding four to six tandem repeats at nanomolar to picomolar affinity in vitro and in living cells. Seven crystal structures, deposited as PDB 7UDJ, 7UE2, 7UDK, 7UDL, 7UDM, 7UDN and 7UDO, showed the designed repeating interactions, including the predicted ladders of hydrogen bonds from protein side chains to the peptide backbone.

**What it shows.** Peptide backbones bury polar groups that are hard to satisfy, which has long made sequence-specific peptide binding difficult. By enforcing a one-to-one match between protein repeat and peptide triplet, the method turns an awkward problem into a modular one, and redesigning individual repeat units extended recognition to non-repeating and disordered sequences. A general, programmable peptide binder is the boundary this work pushes.

**Caveats.** The strongest affinities require several tandem repeats, so single-triplet recognition remains weak. The headline counts come from the second design round, and success rates were lower before the protocol was tightened.

**Why it matters for provenance.** A protein that can be designed to grip an arbitrary linear sequence is a recognition reagent that did not come from immunization or any natural repertoire, so a registry that traces binders to biological origin needs to account for designed ones.

Source: Kejia Wu, Hua Bai, Ya-Ting Chang and colleagues. De novo design of modular peptide-binding proteins by superhelical matching. Nature, published 5 April 2023, doi 10.1038/s41586-023-05909-9. https://www.nature.com/articles/s41586-023-05909-9
