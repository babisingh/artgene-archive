// ArtGene Archive — Sequence detail record (GenBank-style)
function RecordPage({ setRoute, recordId }) {
  const [tab, setTab] = React.useState('abstract');

  const rec = {
    id: recordId || 'AG-2026-018427',
    name: 'Thermostable carbonic anhydrase CA-ΔT7',
    short: 'CA-ΔT7',
    type: 'Protein (coding sequence)',
    host: 'Escherichia coli BL21(DE3)',
    organism_src: 'De novo — no natural homolog > 38% identity',
    aa: 258,
    bp: 777,
    mw: '28.4 kDa',
    model: 'ESM-3 · v2.1',
    method: 'Conditional generation + ProteinMPNN redesign',
    org: 'ETH Zürich — Platt Laboratory for Synthetic Biology',
    authors: ['Elena Rojas, PhD', 'Mikhail Volkov', 'Sofia Bianchi, PhD', 'R. Platt (PI)'],
    deposited: '2026-04-22 11:47 UTC',
    certified: '2026-04-22 11:48:12 UTC',
    hash: 'a9f0c3e8b41d2f7a9c8e0b4d6f2a1c7e8b3d5a9f',
    sig: '0x4c8e2a…b19f',
    keywords: ['carbonic anhydrase', 'CO₂ capture', 'thermostable', 'de novo', 'industrial enzyme'],
    license: 'CC-BY-4.0',
  };

  const tabs = [
    ['abstract','Abstract & description'],
    ['sequence','Sequence'],
    ['biosafety','Biosafety scorecard'],
    ['provenance','Provenance & watermark'],
    ['refs','References & versions'],
  ];

  return (
    <div className="route">
      {/* Top bar: ID + status */}
      <div style={{background:'var(--paper-3)',borderBottom:'0.5px solid var(--rule)',padding:'10px 0'}}>
        <div className="wrap flex between center" style={{gap:16,flexWrap:'wrap'}}>
          <div className="mono" style={{fontSize:11,letterSpacing:'0.08em',color:'var(--ink-3)',textTransform:'uppercase'}}>
            <span onClick={()=>setRoute('registry')} style={{cursor:'pointer'}}>Registry</span> ▸ <span>Record</span> ▸ <span style={{color:'var(--ink)'}}>{rec.id}</span>
          </div>
          <div className="flex gap-8" style={{alignItems:'center'}}>
            <span className="badge badge-verify badge-dot">Certified · Tier 1</span>
            <span className="badge">v1.0 · current</span>
            <span className="badge">Open · CC-BY-4.0</span>
            <button className="btn btn-ghost btn-sm">⎘ Cite</button>
            <button className="btn btn-ghost btn-sm">↓ FASTA</button>
            <button className="btn btn-ghost btn-sm">↓ Certificate</button>
          </div>
        </div>
      </div>

      {/* ============ HEADER ============ */}
      <section className="wrap" style={{padding:'48px 0 32px'}}>
        <div className="grid-12" style={{gap:40,alignItems:'start'}}>
          <div style={{gridColumn:'span 8'}}>
            <div className="mono" style={{fontSize:11,color:'var(--accent)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:14}}>
              {rec.id} · Protein coding sequence
            </div>
            <h1 className="display" style={{fontSize:52,margin:'0 0 14px',letterSpacing:'-0.02em'}}>
              {rec.name}
            </h1>
            <div className="serif" style={{fontSize:20,fontStyle:'italic',color:'var(--ink-3)',marginBottom:20}}>
              A de novo carbonic anhydrase engineered for sustained CO₂ capture above 75 °C.
            </div>
            <div className="flex" style={{gap:32,flexWrap:'wrap',marginTop:24,fontSize:13,color:'var(--ink-2)'}}>
              <div>
                <div className="mono" style={{fontSize:10,color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>Depositor</div>
                {rec.org}
              </div>
              <div>
                <div className="mono" style={{fontSize:10,color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>Deposited</div>
                {rec.deposited}
              </div>
              <div>
                <div className="mono" style={{fontSize:10,color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>Model</div>
                {rec.model}
              </div>
              <div>
                <div className="mono" style={{fontSize:10,color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>Length</div>
                {rec.aa} aa · {rec.bp} bp · {rec.mw}
              </div>
            </div>
          </div>
          <div style={{gridColumn:'span 4',display:'flex',justifyContent:'center'}}>
            <CertSeal size={180}/>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div style={{borderTop:'0.5px solid var(--rule)',borderBottom:'0.5px solid var(--rule)',position:'sticky',top:78,background:'var(--paper)',zIndex:10}}>
        <div className="wrap flex" style={{gap:0}}>
          {tabs.map(([k,label])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              padding:'16px 22px',
              background:'transparent',
              border:'none',
              borderBottom: tab===k ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              color: tab===k ? 'var(--ink)' : 'var(--ink-3)',
              fontSize:13.5,
              fontFamily:'var(--sans)',
              cursor:'pointer',
              marginBottom:'-0.5px',
              letterSpacing:'0.005em',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <section className="wrap" style={{padding:'48px 0 80px'}}>
        {tab === 'abstract' && <AbstractTab rec={rec}/>}
        {tab === 'sequence' && <SequenceTab rec={rec}/>}
        {tab === 'biosafety' && <BiosafetyTab rec={rec}/>}
        {tab === 'provenance' && <ProvenanceTab rec={rec}/>}
        {tab === 'refs' && <ReferencesTab rec={rec}/>}
      </section>
    </div>
  );
}

function AbstractTab({ rec }) {
  return (
    <div className="grid-12" style={{gap:48}}>
      <div style={{gridColumn:'span 8'}}>
        <div className="eyebrow mb-16">§ Abstract</div>
        <div className="serif" style={{fontSize:20,lineHeight:1.55,color:'var(--ink)',marginBottom:28,letterSpacing:'-0.005em'}}>
          CA-ΔT7 is a 258-residue de novo carbonic anhydrase, generated by conditional ESM-3 sampling and refined through three rounds of ProteinMPNN redesign, that retains > 85% catalytic activity at 80 °C — a regime where natural α- and β-class carbonic anhydrases denature within minutes.
        </div>
        <p style={{fontSize:15,lineHeight:1.7,color:'var(--ink-2)',marginBottom:20}}>
          The enzyme was designed for use in direct-air-capture (DAC) hydration loops, where the thermal floor of solvent regeneration (typically 75–95 °C) has historically precluded biological catalysis. Structural predictions place the active-site zinc coordination geometry within 0.3 Å of bovine CA II, while the surrounding scaffold bears no detectable homology (≤ 38% identity, E > 1e-12) to any sequence in UniProt, GenBank, or the NCBI non-redundant database.
        </p>
        <p style={{fontSize:15,lineHeight:1.7,color:'var(--ink-2)',marginBottom:20}}>
          Wet-lab validation in <em>E. coli</em> BL21(DE3) confirms soluble expression (12 mg/L), a melting temperature of Tₘ = 91.4 °C (ΔTₘ = +34 °C vs. hCA II), and a k_cat/K_M of 4.2 × 10⁶ M⁻¹s⁻¹ at 80 °C. All biosafety gates passed without exception; the sequence is deposited as Tier 1 (unrestricted, CC-BY-4.0).
        </p>
        <p style={{fontSize:15,lineHeight:1.7,color:'var(--ink-2)',marginBottom:20}}>
          This record supersedes internal identifier <span className="mono" style={{fontSize:13,color:'var(--accent)'}}>PLATT-CA-V3-REV04</span> and is cited in Rojas et al., <em>Nature Biotechnology</em> (submitted, 2026).
        </p>

        <div className="mt-40 mb-16 eyebrow">§ Keywords</div>
        <div className="flex gap-8" style={{flexWrap:'wrap'}}>
          {rec.keywords.map(k => <span key={k} className="badge" style={{textTransform:'none',letterSpacing:'0.02em',fontFamily:'var(--sans)',fontSize:12}}>{k}</span>)}
        </div>

        <div className="mt-40 mb-16 eyebrow">§ Authors & contributors</div>
        <div style={{borderTop:'0.5px solid var(--rule)'}}>
          {rec.authors.map((a,i) => (
            <div key={a} style={{padding:'14px 0',borderBottom:'0.5px solid var(--rule-2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:14}}>{a}</div>
                <div className="mono" style={{fontSize:11,color:'var(--ink-3)',letterSpacing:'0.04em',marginTop:2}}>ORCID 0000-000{i}-{1234+i}-{5678-i*3}</div>
              </div>
              <div className="mono" style={{fontSize:11,color:'var(--ink-3)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
                {i===3?'Principal investigator':i===0?'Corresponding author':'Co-author'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      <aside style={{gridColumn:'span 4'}}>
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--rule)',background:'var(--paper-3)'}}>
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Record metadata</div>
          </div>
          <dl style={{margin:0,padding:'8px 20px'}}>
            {[
              ['Accession', rec.id],
              ['Molecule type', rec.type],
              ['Expression host', rec.host],
              ['Natural homolog', rec.organism_src],
              ['Length', `${rec.aa} aa · ${rec.bp} bp`],
              ['Molecular weight', rec.mw],
              ['Generating model', rec.model],
              ['Design method', rec.method],
              ['License', rec.license],
              ['Citation', `ArtGene Archive, ${rec.id}`],
            ].map(([k,v]) => (
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid var(--rule-2)',gap:16}}>
                <dt className="mono" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.08em',textTransform:'uppercase',flexShrink:0,paddingTop:2}}>{k}</dt>
                <dd style={{margin:0,fontSize:12.5,color:'var(--ink-2)',textAlign:'right'}}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card mt-16" style={{padding:'20px'}}>
          <div className="mono mb-8" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Cite this record</div>
          <div className="mono" style={{fontSize:11.5,background:'var(--paper)',padding:12,borderRadius:3,border:'0.5px solid var(--rule)',lineHeight:1.6,color:'var(--ink-2)'}}>
            Rojas E., Volkov M., Bianchi S., Platt R. (2026). CA-ΔT7, a thermostable de novo carbonic anhydrase. <em>ArtGene Archive</em> <span style={{color:'var(--accent)'}}>{rec.id}</span>.
          </div>
        </div>

        <div className="card mt-16" style={{padding:'20px'}}>
          <div className="mono mb-8" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Quick actions</div>
          <div style={{display:'grid',gap:6}}>
            <button className="btn btn-ghost btn-sm" style={{justifyContent:'flex-start'}}>↓ Download FASTA (1.2 KB)</button>
            <button className="btn btn-ghost btn-sm" style={{justifyContent:'flex-start'}}>↓ Download GenBank (4.8 KB)</button>
            <button className="btn btn-ghost btn-sm" style={{justifyContent:'flex-start'}}>↓ Certificate JSON (2.1 KB)</button>
            <button className="btn btn-ghost btn-sm" style={{justifyContent:'flex-start'}}>↗ View on EMBL-EBI mirror</button>
            <button className="btn btn-ghost btn-sm" style={{justifyContent:'flex-start'}}>⇆ BLAST this sequence</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SequenceTab({ rec }) {
  // Generate a plausible 777bp sequence rendered in rows of 60
  const bases = 'ATGCATGAAGCCGTATAACGAATACTGGCTGCACGACTTCATCGTGAAAGATCTGGCCAGCCAGTTTCCGAATGTGTACCGCGAAATGCTGCATGCGAGCACCGCAGATCAGCTGGTGAAAGCGATTGATCAGCTGAATGAAGCGCTGCGCCAGCTGCATAAAGCGGGCAGCTAATAACGCGGTGAAAGAAATGCTGGATTACATCAAAGCGATGGAACAGCTGGCGAAAGAAGGCCAGGATTATGCGCGCAAACTGAAAGCGGATCTGAAAGCGGAACAGGTGGCCAAAGAAATTGATGCCGATCTGGAAGCGCTGGATGATGCGCTGAAAGAAGCGATGAAAGCGCTGAAAGCGAATGTGAAAGCCATGAAAGCGGATCAGGCCGGCATTCGTGAAGCGCTGGAAAAAGCCGCAGCGGCGAAACAGGCGCTGGCGCAGGAAATGGGCCAGCTGGAACGTGCGCTGAAAGCGGCGAATGGCGATATTGATGCGCTGCGTGAAAAAATTGATCGCCTGGAACAGCTGGCGGAAGAAGCGATTAAACGCCTGAATGAACAGGCGGCAAATCTGGCGCGTGAACAGGCGCTGAATGATCTGAAAGCGGAACAGCGCGCGCTGCGCGCGGAACTGAAAGAAAAACGCGATCTGCTGCAGCGCGAAAAAGAAGCGATGCGCCAGCAGCTGGAAGCGTAA';
  const rows = [];
  for (let i = 0; i < bases.length; i += 60) {
    rows.push({ start: i+1, seq: bases.slice(i, i+60) });
  }
  // Positions where watermark codons live
  const wmPositions = new Set([3,12,27,45,66,84,93,111,135,168,198,231,270,315,351]);

  return (
    <div className="grid-12" style={{gap:32}}>
      <div style={{gridColumn:'span 12'}}>
        <div className="flex between center mb-16">
          <div className="eyebrow">§ Coding sequence · 777 bp · 258 aa</div>
          <div className="flex gap-8">
            <div className="seg" style={{fontSize:11}}>
              <button className="active">DNA</button>
              <button>mRNA</button>
              <button>Protein</button>
            </div>
            <button className="btn btn-ghost btn-sm">Show watermark</button>
            <button className="btn btn-ghost btn-sm">Copy</button>
          </div>
        </div>

        <div className="seq-block">
          {rows.map(({start, seq}) => {
            // Split into triplets
            const triplets = seq.match(/.{1,3}/g) || [];
            return (
              <div key={start} style={{display:'flex',gap:24,alignItems:'baseline'}}>
                <span className="idx" style={{minWidth:40,textAlign:'right',color:'var(--ink-4)'}}>{String(start).padStart(4,'0')}</span>
                <span style={{flex:1}}>
                  {triplets.map((t, idx) => {
                    const globalIdx = Math.floor(start/3) + idx;
                    const isWm = wmPositions.has(globalIdx);
                    return (
                      <span key={idx} className={isWm ? 'wm' : ''} style={{marginRight:6, color: isWm ? 'var(--ink)' : 'inherit', fontWeight: isWm ? 500 : 400}}>
                        {t}
                      </span>
                    );
                  })}
                </span>
                <span className="idx" style={{minWidth:36,textAlign:'right',color:'var(--ink-4)'}}>{start+seq.length-1}</span>
              </div>
            );
          })}
        </div>

        <div className="mono" style={{fontSize:11,color:'var(--ink-3)',marginTop:12,letterSpacing:'0.04em'}}>
          <span style={{background:'color-mix(in oklab, var(--verify) 22%, transparent)',padding:'1px 4px',borderRadius:2}}>HIGHLIGHTED</span> · synonymous codons carrying the ArtGene 128-bit watermark. Protein sequence is unchanged.
        </div>

        {/* Feature track */}
        <div className="mt-40 eyebrow mb-16">§ Feature map</div>
        <div style={{background:'var(--paper-2)',border:'0.5px solid var(--rule)',borderRadius:6,padding:'24px 28px'}}>
          <div style={{position:'relative',height:80,marginBottom:16}}>
            {/* Scale */}
            <div style={{position:'absolute',top:0,left:0,right:0,height:14,display:'flex',justifyContent:'space-between',fontFamily:'var(--mono)',fontSize:10,color:'var(--ink-4)'}}>
              {[0,100,200,300,400,500,600,700,777].map(n => <span key={n}>{n}</span>)}
            </div>
            <div style={{position:'absolute',top:20,left:0,right:0,height:2,background:'var(--ink)'}}/>
            {/* Features */}
            {[
              { start:0, end:3, color:'var(--verify)', label:'Start' },
              { start:3, end:90, color:'var(--accent)', label:'Signal domain · α-helix bundle' },
              { start:90, end:310, color:'oklch(0.55 0.09 140)', label:'Active site · Zn²⁺ coord' },
              { start:310, end:580, color:'oklch(0.55 0.09 240)', label:'Catalytic core' },
              { start:580, end:774, color:'oklch(0.6 0.1 300)', label:'C-terminal scaffold' },
              { start:774, end:777, color:'var(--danger)', label:'Stop' },
            ].map((f,i) => (
              <div key={i} style={{
                position:'absolute',
                top: 28 + (i%2)*26,
                left: `${(f.start/777)*100}%`,
                width: `${((f.end-f.start)/777)*100}%`,
                height:18,
                background: f.color,
                opacity: 0.85,
                borderRadius: 2,
                display:'flex',
                alignItems:'center',
                padding:'0 6px',
                fontSize:10,
                fontFamily:'var(--mono)',
                color:'var(--paper)',
                whiteSpace:'nowrap',
                overflow:'hidden',
              }}>{f.label}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BiosafetyTab({ rec }) {
  const gates = [
    {
      letter:'α', name:'Structural confidence', tool:'ESMFold · pLDDT', score:0.91, threshold:0.70, pass:true,
      detail:'Mean pLDDT 91.3 across the predicted fold. Active-site residues coordinated within 0.3 Å of reference. No disordered regions exceeding 12 residues.',
    },
    {
      letter:'β', name:'Off-target homology', tool:'BLAST + ToxinPred2', score:0.97, threshold:0.60, pass:true,
      detail:'Best hit: bovine CA II, 38% identity (E = 2.1e-11). No match to any sequence in NCBI pathogen/toxin databases (PATRIC, VFDB, DBETH). ToxinPred2 score: 0.03.',
    },
    {
      letter:'γ', name:'Ecological risk', tool:'HGT + DriftRadar', score:0.88, threshold:0.55, pass:true,
      detail:'HGT probability (SynthoHGT v2): 0.04. No CRISPR spacer matches. Fitness in E. coli minimal media: neutral (ΔGR = +0.02 ± 0.11). No evidence of environmental persistence risk.',
    },
  ];

  return (
    <div className="grid-12" style={{gap:48}}>
      <div style={{gridColumn:'span 8'}}>
        <div className="eyebrow mb-16">§ Biosafety scorecard</div>
        <div style={{background:'color-mix(in oklab, var(--verify) 8%, var(--paper-2))',border:'0.5px solid color-mix(in oklab, var(--verify) 30%, transparent)',borderRadius:6,padding:'24px 28px',marginBottom:32}}>
          <div className="flex between center">
            <div>
              <div className="mono" style={{fontSize:10.5,color:'var(--verify)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}}>Overall assessment · Tier 1 · Unrestricted</div>
              <div className="serif" style={{fontSize:28,color:'var(--ink)',letterSpacing:'-0.01em'}}>All three gates passed without exception.</div>
            </div>
            <div style={{fontFamily:'var(--mono)',fontSize:48,color:'var(--verify)',letterSpacing:'-0.02em'}}>✓</div>
          </div>
        </div>

        {gates.map(g => (
          <div key={g.letter} style={{borderTop:'0.5px solid var(--rule)',padding:'28px 0'}}>
            <div className="flex" style={{gap:24,alignItems:'start'}}>
              <div style={{
                width:56,height:56,borderRadius:'50%',
                background:'var(--paper-2)',border:'0.5px solid var(--rule)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontFamily:'var(--serif)',fontSize:28,color:'var(--accent)',
                flexShrink:0,
              }}>{g.letter}</div>
              <div style={{flex:1}}>
                <div className="flex between center mb-8">
                  <div>
                    <div className="mono" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>Gate {g.letter} · {g.tool}</div>
                    <div className="serif" style={{fontSize:22}}>{g.name}</div>
                  </div>
                  <span className="badge badge-verify badge-dot">Passed</span>
                </div>
                {/* Score bar */}
                <div style={{marginTop:14,marginBottom:12}}>
                  <div className="flex between" style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)',marginBottom:6}}>
                    <span>Score</span>
                    <span style={{color:'var(--ink)'}}>{g.score.toFixed(2)} <span style={{color:'var(--ink-4)'}}>/ threshold {g.threshold.toFixed(2)}</span></span>
                  </div>
                  <div style={{height:4,background:'var(--rule)',borderRadius:2,position:'relative',overflow:'hidden'}}>
                    <div style={{position:'absolute',top:0,bottom:0,left:`${g.threshold*100}%`,width:'0.5px',background:'var(--ink-3)',zIndex:2}}/>
                    <div style={{position:'absolute',top:0,left:0,height:'100%',width:`${g.score*100}%`,background:'var(--verify)'}}/>
                  </div>
                </div>
                <p style={{fontSize:13.5,lineHeight:1.6,color:'var(--ink-2)',margin:'12px 0 0'}}>{g.detail}</p>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-24" style={{fontSize:12,color:'var(--ink-3)',lineHeight:1.6,paddingLeft:18,borderLeft:'2px solid var(--rule)'}}>
          Biosafety screening is automated and non-exhaustive. Flagged or borderline records route to the ArtGene Human Review Panel within 24 hours. Tier assignments are reviewed annually and may be revised as reference databases evolve.
        </div>
      </div>

      <aside style={{gridColumn:'span 4'}}>
        <div className="card" style={{padding:20}}>
          <div className="mono mb-16" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Tier legend</div>
          <div style={{display:'grid',gap:14}}>
            {[
              { t:'Tier 1', color:'var(--verify)', desc:'Unrestricted. Public, CC-BY-4.0. All three gates pass with margin.' },
              { t:'Tier 2', color:'var(--warn)', desc:'Conditional. Metadata public; sequence on request with institutional verification.' },
              { t:'Tier 3', color:'var(--danger)', desc:'Restricted. Flagged by one or more gates. Human review required before any release.' },
            ].map(t => (
              <div key={t.t} style={{paddingLeft:12,borderLeft:`2px solid ${t.color}`}}>
                <div style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>{t.t}</div>
                <div style={{fontSize:12,color:'var(--ink-3)',lineHeight:1.5,marginTop:2}}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card mt-16" style={{padding:20}}>
          <div className="mono mb-8" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Report a concern</div>
          <p style={{fontSize:12.5,color:'var(--ink-3)',lineHeight:1.55,margin:'0 0 12px'}}>
            If you believe this record was misclassified or poses a risk not captured by automated screening, contact the biosafety panel.
          </p>
          <button className="btn btn-ghost btn-sm">biosafety@artgene-archive.org →</button>
        </div>
      </aside>
    </div>
  );
}

function ProvenanceTab({ rec }) {
  return (
    <div className="grid-12" style={{gap:48}}>
      <div style={{gridColumn:'span 7'}}>
        <div className="eyebrow mb-16">§ Watermark fingerprint</div>
        <div style={{background:'var(--paper-2)',border:'0.5px solid var(--rule)',borderRadius:6,padding:28,marginBottom:28}}>
          <div className="flex between center mb-16">
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>128-bit signature · ETH-ZURICH-PLATT-LAB</div>
            <span className="badge badge-verify badge-dot">Recovered intact</span>
          </div>
          <div style={{aspectRatio:'2/1',marginBottom:12}}>
            <CodonGrid rows={8} cols={16}/>
          </div>
          <div className="mono" style={{fontSize:10.5,color:'var(--ink-4)',letterSpacing:'0.04em'}}>
            HEX · 0x4c8e2a9f01bd3e7a6c8d0f42b19fac38
          </div>
        </div>

        <div className="eyebrow mb-16">§ Chain of custody</div>
        <div style={{position:'relative',paddingLeft:28}}>
          <div style={{position:'absolute',left:10,top:8,bottom:8,width:'0.5px',background:'var(--rule)'}}/>
          {[
            { t:'Generated', when:'2026-04-19 14:12 UTC', who:'ESM-3 v2.1 · Platt Lab cluster node 04', detail:'Model seed 0xAF42. Temperature 0.8. Conditional: CA catalytic motif.' },
            { t:'Redesigned', when:'2026-04-20 09:31 UTC', who:'ProteinMPNN · 3 iterations', detail:'Scaffold-preserved redesign. Best sequence selected by thermostability predictor.' },
            { t:'Wet-lab validated', when:'2026-04-21 16:08 UTC', who:'Bianchi · bench 3', detail:'Soluble expression confirmed. Tₘ measured by DSF at 91.4 °C.' },
            { t:'Deposited', when:'2026-04-22 11:47 UTC', who:'Rojas (corresponding)', detail:'Full metadata, E. coli host, Tier 1 candidate.' },
            { t:'Certified', when:'2026-04-22 11:48:12 UTC', who:'ArtGene automated pipeline', detail:'Hash a9f0c3e8… anchored to ledger block 148,902.', highlight:true },
          ].map((e,i) => (
            <div key={i} style={{position:'relative',paddingBottom:24}}>
              <div style={{position:'absolute',left:-24,top:4,width:14,height:14,borderRadius:'50%',border:'0.5px solid var(--ink)',background:e.highlight?'var(--accent)':'var(--paper)'}}/>
              <div className="mono" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.06em'}}>{e.when}</div>
              <div className="serif" style={{fontSize:18,margin:'2px 0 4px'}}>{e.t} <span style={{color:'var(--ink-3)',fontStyle:'italic',fontSize:14}}>— {e.who}</span></div>
              <div style={{fontSize:13,color:'var(--ink-2)',lineHeight:1.55}}>{e.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <aside style={{gridColumn:'span 5'}}>
        <div className="card" style={{padding:24}}>
          <div className="flex between center mb-16">
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Certificate JSON</div>
            <button className="btn btn-ghost btn-sm">Copy</button>
          </div>
          <pre className="mono" style={{margin:0,fontSize:11,lineHeight:1.7,color:'var(--ink-2)',whiteSpace:'pre-wrap',background:'var(--paper)',padding:16,border:'0.5px solid var(--rule)',borderRadius:3,overflow:'auto'}}>
{`{
  "accession": "${rec.id}",
  "version": "1.0",
  "hash_sha256": "${rec.hash}…",
  "signature":  "${rec.sig}",
  "issued_by":  "artgene-archive.org",
  "issued_at":  "${rec.certified}",
  "ledger": {
    "merkle_root": "f3a9…d01c",
    "block":       148902,
    "anchor":      "ethereum:0x9c…e2"
  },
  "depositor": {
    "org":  "ETH Zürich",
    "unit": "Platt Lab",
    "keyid":"ETH-ZURICH-PLATT-2026"
  },
  "biosafety": {
    "tier": 1, "alpha": 0.91,
    "beta": 0.97, "gamma": 0.88
  },
  "license": "${rec.license}"
}`}
          </pre>
          <button className="btn btn-accent btn-sm mt-16" style={{width:'100%',justifyContent:'center'}}>
            ⚑ Verify offline with CLI
          </button>
        </div>
      </aside>
    </div>
  );
}

function ReferencesTab({ rec }) {
  return (
    <div className="grid-12" style={{gap:48}}>
      <div style={{gridColumn:'span 8'}}>
        <div className="eyebrow mb-16">§ References</div>
        <div style={{borderTop:'0.5px solid var(--rule)'}}>
          {[
            { n:'[1]', ref:'Rojas E., Volkov M., Bianchi S., Platt R. (2026). Thermostable de novo carbonic anhydrases for direct air capture. Nature Biotechnology, submitted.', type:'preprint' },
            { n:'[2]', ref:'Hayes T., Rao R., Akin H., et al. (2024). Simulating 500 million years of evolution with a language model. bioRxiv 2024.07.01.601568.', type:'ref' },
            { n:'[3]', ref:'Dauparas J., Anishchenko I., Bennett N., et al. (2022). Robust deep learning-based protein sequence design using ProteinMPNN. Science 378, 49-56.', type:'ref' },
            { n:'[4]', ref:'Krishna R., Wang J., Ahern W., et al. (2024). Generalized biomolecular modeling and design with RoseTTAFold All-Atom. Science 384, eadl2528.', type:'ref' },
            { n:'[5]', ref:'ArtGene Consortium (2026). Technical specification: codon steganography for sequence provenance, v1.2. ArtGene Tech Report TR-2026-001.', type:'spec' },
          ].map(r => (
            <div key={r.n} style={{padding:'16px 0',borderBottom:'0.5px solid var(--rule-2)',display:'flex',gap:16}}>
              <div className="mono" style={{fontSize:11,color:'var(--accent)',minWidth:40,paddingTop:2}}>{r.n}</div>
              <div>
                <div style={{fontSize:13.5,lineHeight:1.55,color:'var(--ink-2)'}}>{r.ref}</div>
                <div className="mt-8 flex gap-8">
                  <span className="badge" style={{fontSize:10}}>{r.type}</span>
                  <a className="mono" style={{fontSize:11,color:'var(--accent)',letterSpacing:'0.05em',textTransform:'uppercase'}}>Fetch DOI →</a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-40 eyebrow mb-16">§ Version history</div>
        <div style={{border:'0.5px solid var(--rule)',borderRadius:6,overflow:'hidden'}}>
          <table className="tbl">
            <thead><tr style={{background:'var(--paper-3)'}}>
              <th>Version</th><th>Changes</th><th>Date</th><th>By</th><th/>
            </tr></thead>
            <tbody>
              <tr><td><a className="id">v1.0</a> <span className="badge badge-verify" style={{marginLeft:6,fontSize:9}}>Current</span></td><td>Initial deposit · Tier 1 certified</td><td className="mono" style={{fontSize:12}}>2026-04-22</td><td style={{fontSize:13}}>Rojas E.</td><td>→</td></tr>
              <tr><td><a className="id">v0.3-pre</a></td><td>Internal identifier PLATT-CA-V3-REV04 (not on ledger)</td><td className="mono" style={{fontSize:12}}>2026-04-20</td><td style={{fontSize:13}}>Volkov M.</td><td>→</td></tr>
              <tr><td><a className="id">v0.1-pre</a></td><td>Raw model output · pre-MPNN redesign</td><td className="mono" style={{fontSize:12}}>2026-04-19</td><td style={{fontSize:13}}>auto</td><td>→</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <aside style={{gridColumn:'span 4'}}>
        <div className="card" style={{padding:20}}>
          <div className="mono mb-16" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Related records</div>
          {[
            ['AG-2026-018301','CA-ΔT5 · earlier variant'],
            ['AG-2026-014902','DAC-Zn²⁺ coordination motif'],
            ['AG-2026-012044','Thermophilic scaffold parent'],
          ].map(([id,name])=>(
            <div key={id} style={{padding:'10px 0',borderBottom:'0.5px solid var(--rule-2)'}}>
              <a className="id" style={{fontSize:12}}>{id}</a>
              <div style={{fontSize:12.5,color:'var(--ink-2)',marginTop:2}}>{name}</div>
            </div>
          ))}
        </div>

        <div className="card mt-16" style={{padding:20}}>
          <div className="mono mb-8" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Cited by (1)</div>
          <div style={{fontSize:13,color:'var(--ink-2)',lineHeight:1.55}}>
            Rojas et al. (2026). <em>Nature Biotechnology</em>, submitted.
          </div>
        </div>
      </aside>
    </div>
  );
}

Object.assign(window, { RecordPage });
