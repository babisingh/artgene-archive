---
title: Deep learning designs working luciferases from scratch
subtitle: A University of Washington team built artificial light-emitting enzymes on computer-generated scaffolds, reaching catalytic efficiency on par with natural luciferases.
status: reviewed
item_type: validated-sequence
item_date: 2023-02-22
peer_reviewed: yes
tinsel_relevance: high
tinsel_note: LuxSit-i is a single designed enzyme with a deposited gene, so it is fully captured by its coding sequence and is a clean candidate for provenance tracking of designed enzymes.
archive:
  doi: 10.1038/s41586-023-05696-3
  source_title: De novo design of luciferases using deep learning
  container: Nature
  biosafety_class: none
  molecule_type: protein
  generating_model: Family-wide hallucination using the trRosetta structure prediction network for scaffold generation, with ProteinMPNN for sequence design, AlphaFold2 for filtering, and RIF docking plus Rosetta for active-site placement
  model_availability: open-weights
  design_target: artificial luciferases that catalyze the oxidative chemiluminescence of the synthetic luciferins diphenylterazine and 2-deoxycoelenterazine
  n_designed: 7648
  n_tested: 7648
  n_functional: 3
  counts_note: 7,648 designs were ordered and screened; 3 showed luciferase activity in the first round (3/7,648), improving to 2/46 in a focused second round. The lead designs are LuxSit and the optimized LuxSit-i.
  assays: [expression, activity, kinetics, thermostability, selectivity]
  expression_host: ECOLI
  sequences_deposited: yes
  accessions:
    - database: genbank
      accession: OP820699
      url: https://www.ncbi.nlm.nih.gov/nuccore/OP820699
  article_license_spdx: CC-BY-4.0
  data_license_spdx: UNSTATED
  data_license: The article is Creative Commons Attribution 4.0. The paper states no separate licence for its data; the LuxSit-i gene is deposited in GenBank (OP820699) and codon-optimized plasmids are distributed through Addgene.
  staging: staged
  staging_reason: 
  ethics_code: none stated
credit:
  authors:
    - full_name: Andy Hsien-Wei Yeh
      orcid: 0000-0002-9023-776X
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Christoffer Norn
      orcid: 0000-0002-1450-4651
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Yakov Kipnis
      orcid: 0000-0002-3057-4916
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Doug Tischer
      orcid: 0000-0003-3633-5542
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Samuel J. Pellock
      orcid: 0000-0002-7557-7985
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Declan Evans
      affiliation: Department of Chemistry and Biochemistry, University of California, Los Angeles, Los Angeles, CA USA
      corresponding: no
    - full_name: Pengchen Ma
      affiliation: Department of Chemistry and Biochemistry, University of California, Los Angeles, Los Angeles, CA USA
      corresponding: no
    - full_name: Gyu Rie Lee
      orcid: 0000-0002-9119-5303
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Jason Z. Zhang
      orcid: 0000-0003-0091-6273
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Ivan Anishchenko
      orcid: 0000-0003-3645-2044
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Brian Coventry
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Longxing Cao
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Justas Dauparas
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Samer Halabiya
      affiliation: Institute for Protein Design, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Michelle DeWitt
      affiliation: Institute for Protein Design, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: Lauren Carter
      affiliation: Institute for Protein Design, University of Washington, Seattle, WA USA
      corresponding: no
    - full_name: K. N. Houk
      orcid: 0000-0002-8387-5261
      affiliation: Department of Chemistry and Biochemistry, University of California, Los Angeles, Los Angeles, CA USA
      corresponding: no
    - full_name: David Baker
      orcid: 0000-0001-7896-6217
      affiliation: Department of Biochemistry, University of Washington, Seattle, WA USA
      corresponding: yes
  institution: Institute for Protein Design, University of Washington, Seattle
sources:
  - https://doi.org/10.1038/s41586-023-05696-3
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC9946828/
---

# Deep learning designs working luciferases from scratch

*A University of Washington team built artificial light-emitting enzymes on computer-generated scaffolds, reaching catalytic efficiency on par with natural luciferases.*

**What was done.** Andy Hsien-Wei Yeh, Christoffer Norn, David Baker and colleagues at the Institute for Protein Design, University of Washington, with collaborators including K. N. Houk at UCLA, reported this work in Nature on 22 February 2023 after peer review. Yeh and Baker are the joint corresponding authors. Rather than reuse natural protein scaffolds, they introduced a deep-learning method they call family-wide hallucination. It generates large numbers of idealized NTF2-like structures with varied pocket shapes together with sequences predicted to fold into them. These scaffolds were then used to place an active site designed to catalyze the oxidative chemiluminescence of two synthetic luciferin substrates, diphenylterazine and 2-deoxycoelenterazine.

**What they made and measured.** From the designed pool, 7,648 candidates were selected and ordered as pooled oligonucleotides for experimental screening in Escherichia coli. Three sequences showed luciferase activity in the first round, a success rate of three in 7,648, which rose to two in 46 after a focused second round. The lead enzyme, named LuxSit from the Latin for let light exist, is 117 residues and 13.9 kilodaltons, smaller than any previously described luciferase. An optimized version, LuxSit-i, reached a catalytic efficiency on diphenylterazine of about ten to the sixth per molar per second, comparable to native luciferases but with much higher substrate specificity, and the enzyme remained folded above 95 degrees Celsius. The designs position an arginine guanidinium group next to an anion that forms during the reaction, inside a pocket with high shape complementarity.

**What it shows.** This is de novo creation of a small, thermostable and highly specific biocatalyst for a defined reaction, not the repurposing of an existing fold. Achieving native-like catalytic efficiency from computationally generated scaffolds marks a step change for computational enzyme design and points to a general route for building luciferases and other enzymes with tailored selectivity.

**Caveats.** No crystal structure of a designed luciferase was reported, so the active-site geometry rests on models supported by biochemistry and mutational analysis rather than a solved structure. The initial hit rate was low, and the best enzymes required an additional optimization round.

**Why it matters for provenance.** LuxSit-i is a single designed protein whose gene was deposited, so it is fully described by its coding sequence and is a clean object for any registry of designed enzymes.

Source: Andy Hsien-Wei Yeh, Christoffer Norn, Yakov Kipnis and colleagues, including David Baker. De novo design of luciferases using deep learning. Nature, published 22 February 2023, doi 10.1038/s41586-023-05696-3. https://doi.org/10.1038/s41586-023-05696-3
