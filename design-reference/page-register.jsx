// ArtGene Archive — Register (deposit) flow + About + Docs
function RegisterPage({ setRoute }) {
  const [step, setStep] = React.useState(1);
  const [seq, setSeq] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const startAnalysis = () => {
    setStep(3);
    setRunning(true);
    setTimeout(()=>{ setRunning(false); setDone(true); }, 3400);
  };

  return (
    <div className="route">
      <section className="wrap" style={{padding:'48px 0 24px'}}>
        <div className="eyebrow mb-8">Deposit pathway</div>
        <h1 className="display" style={{fontSize:56,margin:0}}>Register a <em>new sequence.</em></h1>
        <p className="lede mt-16" style={{maxWidth:640}}>
          Four short steps. Your sequence is analyzed in under ninety seconds; a signed certificate is issued on pass. Submissions are free for public deposits.
        </p>
      </section>

      {/* Stepper */}
      <section className="wrap" style={{padding:'0 0 32px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0,borderTop:'0.5px solid var(--rule)',borderBottom:'0.5px solid var(--rule)'}}>
          {[['01','Sequence'],['02','Metadata'],['03','Biosafety review'],['04','Certificate']].map(([n,l],i)=>{
            const idx = i+1;
            const active = step === idx;
            const past = step > idx;
            return (
              <div key={n} style={{
                padding:'18px 24px',
                borderRight: i<3?'0.5px solid var(--rule)':'none',
                background: active ? 'var(--paper-3)' : 'transparent',
                opacity: past ? 0.6 : 1,
              }}>
                <div className="mono" style={{fontSize:10.5,color: active?'var(--accent)':'var(--ink-3)',letterSpacing:'0.12em',marginBottom:4}}>
                  {past?'✓':''} STEP {n}
                </div>
                <div className="serif" style={{fontSize:20,color:'var(--ink)'}}>{l}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Body */}
      <section className="wrap" style={{padding:'0 0 80px'}}>
        <div className="grid-12" style={{gap:40,alignItems:'start'}}>
          <div style={{gridColumn:'span 8'}}>
            {step === 1 && (
              <div className="card">
                <div className="eyebrow mb-16">§ 01 · Sequence input</div>
                <h3 className="serif" style={{fontSize:22,margin:'0 0 8px'}}>Paste a FASTA or drop a file</h3>
                <p style={{fontSize:13.5,color:'var(--ink-3)',lineHeight:1.55,marginBottom:20}}>
                  Accepted: FASTA, GenBank, plain DNA/RNA/protein. Up to 1,000 residues per sequence (contact us for larger). We do not store rejected inputs.
                </p>
                <textarea
                  value={seq}
                  onChange={e=>setSeq(e.target.value)}
                  placeholder="> MySequence | optional description&#10;MKLVGGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYG..."
                  style={{
                    width:'100%',minHeight:200,padding:16,
                    fontFamily:'var(--mono)',fontSize:12.5,lineHeight:1.7,
                    background:'var(--paper)',border:'0.5px solid var(--rule)',borderRadius:4,
                    color:'var(--ink)',resize:'vertical',outline:'none',
                  }}/>
                <div className="flex between center mt-16">
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm">Browse file…</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSeq('>CA-dT7 | Thermostable carbonic anhydrase de novo\nMKAKPYENWLHDFIVKDLASQFPNVYREMLHASTADQLVKAIDQLNEALRQLHKAGS')}>Load example</button>
                  </div>
                  <div className="mono" style={{fontSize:11,color:'var(--ink-3)'}}>{seq.replace(/[^A-Z]/gi,'').length} residues</div>
                </div>
                <div className="flex between mt-24" style={{alignItems:'center'}}>
                  <div className="mono" style={{fontSize:11,color:'var(--ink-3)'}}>All uploads are scanned locally before transmission.</div>
                  <button className="btn btn-primary" onClick={()=>setStep(2)} disabled={!seq.trim()}>Continue →</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="card">
                <div className="eyebrow mb-16">§ 02 · Metadata</div>
                <h3 className="serif" style={{fontSize:22,margin:'0 0 20px'}}>Describe your deposit</h3>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                  {[
                    ['Sequence name *','e.g. CA-ΔT7'],
                    ['Molecule type *','Protein / DNA / RNA'],
                    ['Expression host','E. coli BL21(DE3)'],
                    ['Generating model *','ESM-3 · v2.1'],
                    ['Design method','Conditional generation'],
                    ['Your institution','—'],
                  ].map(([l,p])=>(
                    <div key={l}>
                      <label className="mono" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:6}}>{l}</label>
                      <input placeholder={p} style={{
                        width:'100%',padding:'10px 12px',background:'var(--paper)',
                        border:'0.5px solid var(--rule)',borderRadius:3,fontSize:13.5,
                        fontFamily:'var(--sans)',color:'var(--ink)',outline:'none',
                      }}/>
                    </div>
                  ))}
                </div>
                <div className="mt-24">
                  <label className="mono" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:6}}>Abstract / description</label>
                  <textarea placeholder="A short description of the sequence, its intended function, how it was generated, and any wet-lab validation performed…" style={{
                    width:'100%',minHeight:100,padding:12,background:'var(--paper)',
                    border:'0.5px solid var(--rule)',borderRadius:3,fontSize:13.5,
                    fontFamily:'var(--sans)',color:'var(--ink)',resize:'vertical',outline:'none',lineHeight:1.6,
                  }}/>
                </div>
                <div className="mt-24 flex gap-16" style={{background:'var(--paper-3)',padding:16,borderRadius:4,border:'0.5px solid var(--rule)'}}>
                  <input type="checkbox" defaultChecked style={{marginTop:3}}/>
                  <div>
                    <div style={{fontSize:13,color:'var(--ink)'}}>Publish under CC-BY-4.0 (recommended)</div>
                    <div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>Makes the record public and citable. You retain attribution.</div>
                  </div>
                </div>
                <div className="flex between mt-24">
                  <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={startAnalysis}>Run biosafety analysis →</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="card">
                <div className="eyebrow mb-16">§ 03 · Automated biosafety review</div>
                <div className="flex between center mb-24">
                  <h3 className="serif" style={{fontSize:22,margin:0}}>{running ? 'Running three gates…' : done ? 'All gates passed' : 'Preparing…'}</h3>
                  {running && <div className="mono" style={{fontSize:11,color:'var(--accent)',letterSpacing:'0.1em',textTransform:'uppercase'}}>● LIVE</div>}
                </div>
                {[
                  { letter:'α', name:'Structural confidence (ESMFold)', ms:900 },
                  { letter:'β', name:'Off-target homology (BLAST + ToxinPred2)', ms:1900 },
                  { letter:'γ', name:'Ecological risk (HGT + DriftRadar)', ms:3200 },
                ].map((g,i) => (
                  <GateRow key={g.letter} gate={g} running={running} done={done}/>
                ))}
                {done && (
                  <div style={{marginTop:24,padding:'20px 22px',background:'color-mix(in oklab, var(--verify) 10%, var(--paper-2))',border:'0.5px solid color-mix(in oklab, var(--verify) 30%, transparent)',borderRadius:4}}>
                    <div className="mono" style={{fontSize:10.5,color:'var(--verify)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}}>Tier 1 · Unrestricted · Ready to certify</div>
                    <div style={{fontSize:13.5,color:'var(--ink-2)'}}>Your sequence passed all three biosafety gates. Proceed to mint the certificate and receive your AG-ID.</div>
                    <button className="btn btn-accent mt-16" onClick={()=>setStep(4)}>Mint certificate →</button>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="card" style={{textAlign:'center',padding:'48px 32px'}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:24}}>
                  <CertSeal size={200}/>
                </div>
                <div className="mono" style={{fontSize:11,color:'var(--accent)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:14}}>Certificate issued</div>
                <h2 className="display" style={{fontSize:40,margin:'0 0 14px'}}>
                  Your accession is<br/><em>AG-2026-018428</em>
                </h2>
                <p style={{fontSize:15,color:'var(--ink-2)',maxWidth:520,margin:'0 auto 28px',lineHeight:1.6}}>
                  The record is now public. A watermark has been embedded in the coding sequence and the certificate has been anchored to ledger block <span className="mono">148,903</span>.
                </p>
                <div className="flex gap-12" style={{justifyContent:'center'}}>
                  <button className="btn btn-primary" onClick={()=>setRoute('record')}>View record →</button>
                  <button className="btn btn-ghost">↓ Download certificate</button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside style={{gridColumn:'span 4'}}>
            <div className="card" style={{padding:20}}>
              <div className="mono mb-16" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>The three gates</div>
              <div style={{display:'grid',gap:14}}>
                {[
                  ['α','Structural','ESMFold pLDDT ≥ 0.70'],
                  ['β','Off-target','BLAST vs. pathogen DB. ToxinPred2 < 0.4'],
                  ['γ','Ecological','HGT probability < 0.25. DriftRadar.'],
                ].map(([L,n,d])=>(
                  <div key={L} style={{display:'flex',gap:14,alignItems:'start'}}>
                    <div style={{width:30,height:30,borderRadius:'50%',border:'0.5px solid var(--ink)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--serif)',fontSize:16,color:'var(--accent)',flexShrink:0}}>{L}</div>
                    <div>
                      <div style={{fontSize:13,color:'var(--ink)'}}>{n}</div>
                      <div style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.4,marginTop:1}}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card mt-16" style={{padding:20}}>
              <div className="mono mb-8" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Need help?</div>
              <p style={{fontSize:12.5,color:'var(--ink-3)',lineHeight:1.55,margin:'0 0 12px'}}>
                First-time depositors can request a walkthrough from the Consortium office.
              </p>
              <button className="btn btn-ghost btn-sm">Schedule a call →</button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function GateRow({ gate, running, done }) {
  const [prog, setProg] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  React.useEffect(()=>{
    if (!running && !done) return;
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / gate.ms);
      setProg(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setFinished(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, done]);
  return (
    <div style={{padding:'14px 0',borderTop:'0.5px solid var(--rule-2)'}}>
      <div className="flex between center">
        <div className="flex gap-12 center">
          <div style={{width:28,height:28,borderRadius:'50%',border:'0.5px solid var(--ink)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--serif)',fontSize:15,color:'var(--accent)'}}>{gate.letter}</div>
          <div style={{fontSize:13.5}}>{gate.name}</div>
        </div>
        {finished ? <span className="mono" style={{fontSize:11,color:'var(--verify)',letterSpacing:'0.1em',textTransform:'uppercase'}}>✓ PASS</span> : <span className="mono" style={{fontSize:11,color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>{prog>0?`${Math.round(prog*100)}%`:'QUEUED'}</span>}
      </div>
      <div style={{height:2,background:'var(--rule)',borderRadius:1,marginTop:10,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${prog*100}%`,background:finished?'var(--verify)':'var(--accent)',transition:'width 0.1s'}}/>
      </div>
    </div>
  );
}

// ============ ABOUT (charter) ============
function AboutPage({ setRoute }) {
  return (
    <div className="route wrap-narrow" style={{padding:'80px 0'}}>
      <div className="eyebrow mb-16">§ Charter · adopted 14 February 2026</div>
      <h1 className="display" style={{fontSize:64,margin:'0 0 24px'}}>
        A public-interest<br/>registry for the<br/><em>machine-designed</em> biome.
      </h1>
      <p className="lede" style={{margin:'24px 0 40px'}}>
        ArtGene Archive is operated by the ArtGene Consortium — a non-profit federation of sequencing institutions, national biosafety authorities, and independent researchers. We do not sell access. We do not gate the scholarly record. Our commitments are published here in full.
      </p>

      {[
        { n:'I.', t:'Openness', body:'All certified records are public, machine-readable, and available under CC-BY-4.0 by default. Mirrors in Hinxton, Mishima, and Bethesda ensure the registry is redundantly preserved.' },
        { n:'II.', t:'Neutrality', body:'The Archive does not recommend, endorse, or commercialize any generative model or depositor. The registry is agnostic to method and affiliation.' },
        { n:'III.', t:'Biosafety first', body:'Every deposit undergoes automated three-gate screening. Tier 3 records are never released publicly. The biosafety policy is reviewed by an independent panel annually.' },
        { n:'IV.', t:'Attribution, permanently', body:'First-deposit priority is recorded on a public Merkle ledger. Contributors and their institutions receive lasting, verifiable credit. Models themselves are credited as generative provenance.' },
        { n:'V.', t:'No lock-in', body:'The verification protocol is open-source. Certificates can be validated entirely offline. If the Consortium ceases to exist, the data remains readable.' },
      ].map(item => (
        <div key={item.n} style={{borderTop:'0.5px solid var(--rule)',padding:'28px 0',display:'grid',gridTemplateColumns:'80px 1fr',gap:24}}>
          <div className="serif" style={{fontSize:32,color:'var(--accent)'}}>{item.n}</div>
          <div>
            <div className="serif" style={{fontSize:26,marginBottom:8,letterSpacing:'-0.01em'}}>{item.t}</div>
            <p style={{fontSize:15,lineHeight:1.65,color:'var(--ink-2)',margin:0}}>{item.body}</p>
          </div>
        </div>
      ))}

      <div style={{marginTop:48,padding:'32px 36px',background:'var(--paper-3)',border:'0.5px solid var(--rule)',borderRadius:6}}>
        <div className="eyebrow mb-8">Signatories</div>
        <div style={{fontSize:14,color:'var(--ink-2)',lineHeight:1.7}}>
          Wellcome Trust · EMBL-EBI · National Institutes of Health · DDBJ (Japan) · Broad Institute · Arc Institute · Chan Zuckerberg Initiative · Institut Pasteur · The Francis Crick Institute · RIKEN · UCSF · Wyss Institute · Kyoto University · ETH Zürich
        </div>
      </div>
    </div>
  );
}

// ============ DOCS ============
function DocsPage() {
  return (
    <div className="route wrap" style={{padding:'64px 0'}}>
      <div className="grid-12" style={{gap:48,alignItems:'start'}}>
        <aside style={{gridColumn:'span 3',position:'sticky',top:110}}>
          <div className="mono mb-16" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Documentation</div>
          {[
            ['Quick start',true],
            ['Deposit lifecycle',false],
            ['CLI reference',false],
            ['REST API',false],
            ['Biosafety gates',false],
            ['Watermark protocol',false],
            ['Ledger spec',false],
            ['SDKs (Python, R, Julia)',false],
          ].map(([t,a])=>(
            <div key={t} style={{fontSize:13,padding:'8px 0',color:a?'var(--accent)':'var(--ink-2)',borderLeft:a?'2px solid var(--accent)':'2px solid transparent',paddingLeft:12,cursor:'pointer'}}>{t}</div>
          ))}
        </aside>
        <div style={{gridColumn:'span 8',gridColumnStart:5}}>
          <div className="eyebrow mb-8">Quick start · ≈ 3 minutes</div>
          <h1 className="display" style={{fontSize:48,margin:'0 0 20px'}}>Deposit from the command line.</h1>
          <p className="lede" style={{margin:'0 0 32px'}}>
            The ArtGene CLI handles authentication, FASTA validation, biosafety screening, and certificate retrieval in a single command. Read records without an API key; deposits require a free institutional key.
          </p>
          <div className="card mb-24">
            <div className="mono mb-8" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Install</div>
            <pre className="mono" style={{margin:0,background:'var(--paper)',padding:16,border:'0.5px solid var(--rule)',borderRadius:3,fontSize:12.5,color:'var(--ink)'}}>$ pip install artgene
$ artgene auth login</pre>
          </div>
          <div className="card mb-24">
            <div className="mono mb-8" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Deposit a sequence</div>
            <pre className="mono" style={{margin:0,background:'var(--paper)',padding:16,border:'0.5px solid var(--rule)',borderRadius:3,fontSize:12.5,color:'var(--ink)',lineHeight:1.7}}>{`$ artgene deposit my-sequence.fasta \\
    --model "ESM-3 v2.1" \\
    --host "E. coli BL21(DE3)" \\
    --license CC-BY-4.0

  ↳ validating FASTA         ✓
  ↳ gate α · structural      ✓ 0.91
  ↳ gate β · off-target      ✓ 0.97
  ↳ gate γ · ecological      ✓ 0.88
  ↳ watermark embedded       ✓ 128-bit
  ↳ certificate minted       ✓ AG-2026-018428
  ↳ anchored to ledger       ✓ block 148903`}</pre>
          </div>
          <div className="card">
            <div className="mono mb-8" style={{fontSize:10.5,color:'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Verify any record</div>
            <pre className="mono" style={{margin:0,background:'var(--paper)',padding:16,border:'0.5px solid var(--rule)',borderRadius:3,fontSize:12.5,color:'var(--ink)'}}>$ artgene verify AG-2026-018427
  ✓ certificate valid</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RegisterPage, AboutPage, DocsPage });
