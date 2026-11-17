---
title: A designed macrocycle and protein pair give chemical control of cells
subtitle: University of Washington and Fred Hutch researchers built a C2-symmetric membrane-permeable macrocycle and a matching protein homodimer, then used the pair to switch genes and reconstitute luciferase in cells.
status: reviewed
item_type: validated-sequence
item_date: 2026-05-18
peer_reviewed: yes
tinsel_relevance: medium
tinsel_note: The designed ligand is a macrocyclic peptide built from both L and D amino acids with N-alkylation, chemistry that the genetic code does not supply, so the ligand half of this system cannot be represented by a coding sequence even though its protein partner can.
archive:
  doi: 10.1038/s41467-026-71345-8
  source_title: De novo design of a macrocycle-induced dimerization system for cellular control
  container: Nature Communications
  biosafety_class: none
  molecule_type: protein
  function_class: switch
  subject_class: small_molecule
  generating_model: Rosetta de novo design, with a PyRosetta hashing protocol to find closed C2-symmetric macrocycle conformations and RosettaFastDesign allowing L and D amino acids and N-alkylation for the macrocycle, and RifGen, RifDock, RosettaFastDesign and ProteinMPNN for the protein binder, with AlphaFold2 filtering
  model_availability: open-weights
  design_target: a chemically induced dimerization system made of a de novo macrocyclic peptide ligand and a cognate protein homodimer that binds it across both chains, for conditional control of gene expression and luciferase reconstitution in cells
  n_designed: 263
  n_tested: 19
  n_functional: 1
  counts_note: For the protein binder, AlphaFold2 filtering yielded 263 designs, 19 were ordered and expressed in E. coli, and of 11 screened by equilibrium dialysis one, CID7, bound the macrocycle MC1 and formed a homodimer with a dissociation constant of 36 nM. The macrocyclic peptide ligand was designed separately by Rosetta hashing and FastDesign. The counts describe the protein binder campaign.
  assays: [expression, binding, structure, activity, in-cell]
  expression_host: ECOLI
  sequences_deposited: partial
  accessions:
    - database: pdb
      accession: 8VX7
      url: https://www.rcsb.org/structure/8VX7
    - database: pdb
      accession: 8TM9
      url: https://www.rcsb.org/structure/8TM9
    - database: pdb
      accession: 8TLP
      url: https://www.rcsb.org/structure/8TLP
    - database: other
      accession: CCDC 2354604
      url: https://www.ccdc.cam.ac.uk/structures/Search?ccdc=2354604
    - database: other
      accession: CCDC 2354605
      url: https://www.ccdc.cam.ac.uk/structures/Search?ccdc=2354605
    - database: other
      accession: CCDC 2354606
      url: https://www.ccdc.cam.ac.uk/structures/Search?ccdc=2354606
    - database: other
      accession: CCDC 2354607
      url: https://www.ccdc.cam.ac.uk/structures/Search?ccdc=2354607
    - database: other
      accession: CCDC 2354608
      url: https://www.ccdc.cam.ac.uk/structures/Search?ccdc=2354608
    - database: other
      accession: CCDC 2354609
      url: https://www.ccdc.cam.ac.uk/structures/Search?ccdc=2354609
    - database: other
      accession: CCDC 2354610
      url: https://www.ccdc.cam.ac.uk/structures/Search?ccdc=2354610
    - database: other
      accession: CCDC 2360904
      url: https://www.ccdc.cam.ac.uk/structures/Search?ccdc=2360904
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is Creative Commons Attribution 4.0. Source data are provided with the paper and the structures are deposited in the PDB and the Cambridge Crystallographic Data Centre, but no separate licence is stated for the data.
  staging: staged
  ethics_code: none stated
credit:
  authors:
    - full_name: Stephanie Hanna
      affiliation: Department of Chemistry and Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Patrick J. Salveson
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Basile Wicky
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Madison A. Kennedy
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Derrick R. Hicks
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Carolina Moller
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Suna Cheng
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Xinting Li
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Mohamad Abedi
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Brian Coventry
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Meerit Y. Said
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Asim K. Bera
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Alex Kang
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: no
    - full_name: Barry L. Stoddard
      affiliation: Division of Basic Sciences, Fred Hutchinson Cancer Center, Seattle
      corresponding: no
    - full_name: David Baker
      affiliation: Institute for Protein Design, University of Washington, Seattle
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle
sources:
  - https://www.nature.com/articles/s41467-026-71345-8
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC13385886/
---

# A designed macrocycle and protein pair give chemical control of cells

*University of Washington and Fred Hutch researchers built a C2-symmetric membrane-permeable macrocycle and a matching protein homodimer, then used the pair to switch genes and reconstitute luciferase in cells.*

**What was done.** Chemically induced dimerization puts a protein's activity under the control of a small molecule, but every system in use is built around a natural product: the ligand is a given, and the design problem is only to find a receptor that will accept it. This paper designs both halves at once, a C2-symmetric membrane-permeable macrocyclic peptide and a protein that homodimerizes around it. The macrocycle came from a PyRosetta hashing search for closed C2-symmetric conformations followed by RosettaFastDesign, with D amino acids and N-alkylation allowed so the ring could cross a membrane. The binder was built with RifGen, RifDock, RosettaFastDesign and ProteinMPNN, then filtered with AlphaFold2.

**What they made and measured.** AlphaFold2 filtering left 263 protein designs; 19 were expressed in E. coli, and of 11 screened by equilibrium dialysis, one design, CID7, bound the macrocycle MC1. The CID7 homodimer bound MC1 with a dissociation constant of 36 nM. An X-ray crystal structure of the homodimer and macrocycle complex matched the computational model closely, with the C2 axis of the macrocycle aligned with that of the homodimer. In mammalian cells, the system gave conditional control over a reporter gene and over split luciferase reconstitution, so adding the designed small molecule switched the designed proteins on.

**What it shows.** This is the first chemically induced dimerization system in which the ligand and its receptor are both de novo. The chemistry is no longer inherited from nature, so it can be designed to the application rather than worked around. The cost is a low hit rate at the bench: one binder out of eleven screened.

**Caveats.** Only one of the screened protein designs bound the macrocycle, so the success rate at the bench was low. The functional counts describe the protein binder campaign; the macrocycle was designed and validated on a separate track.

**Why it matters for provenance.** The protein half is genetically encoded, but the macrocycle uses D amino acids and N-alkylation that no codon record can express. Any registry built around coding sequences would capture the receptor and miss the ligand that activates it.

**In plain words.** Biologists have a standard trick for switching a cell's behaviour on: build a protein that only works when two copies of it are stuck together, then add a chemical that glues them. The catch is that the glue has always been borrowed from nature, so the trick only works with the handful of molecules nature happens to supply. Here both parts were drawn up from scratch, a ring-shaped molecule small enough to slip inside a cell and a protein that grips one ring between two copies of itself. Out of 263 candidate proteins, one worked. Adding the ring to human cells switched a gene on, and reassembled a light-producing enzyme that had been split in two. The switch no longer depends on what can be found in nature; the next one can be drawn to fit the job.

Source: Stephanie Hanna, Patrick J. Salveson, Basile Wicky and colleagues, including Barry L. Stoddard and David Baker. De novo design of a macrocycle-induced dimerization system for cellular control. Nature Communications, published 18 May 2026, doi 10.1038/s41467-026-71345-8. https://www.nature.com/articles/s41467-026-71345-8
