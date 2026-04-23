// ArtGene Archive — Registry browse page
function RegistryPage({ setRoute, setRecordId }) {
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');

  const records = [
    { id:'AG-2026-018427', name:'Thermostable carbonic anhydrase CA-ΔT7', type:'Protein', host:'E. coli', status:'certified', tier:'tier-1', safety:'pass', model:'ESM-3 · v2.1', org:'ETH Zürich · Platt Lab', aa:258, date:'2026-04-22' },
    { id:'AG-2026-018426', name:'CRISPR-Cas13d gRNA scaffold SCF-04', type:'RNA', host:'H. sapiens', status:'certified', tier:'tier-1', safety:'pass', model:'RNA-FM · v1.3', org:'Broad Institute', aa:127, date:'2026-04-22' },
    { id:'AG-2026-018425', name:'GLP-1R agonist mimetic series B', type:'Peptide', host:'H. sapiens', status:'certified', tier:'tier-2', safety:'pass', model:'RFdiffusion', org:'Institut Pasteur', aa:39, date:'2026-04-22' },
    { id:'AG-2026-018424', name:'Anti-malarial antibody H3 heavy chain', type:'Protein', host:'CHO cells', status:'under-review', tier:'tier-2', safety:'review', model:'IgLM · v0.4', org:'GlaxoSmithKline Vaccines', aa:452, date:'2026-04-21' },
    { id:'AG-2026-018423', name:'MHETase (plastic-degrading variant)', type:'Protein', host:'E. coli', status:'certified', tier:'tier-1', safety:'pass', model:'ProteinMPNN', org:'Kyoto University', aa:301, date:'2026-04-21' },
    { id:'AG-2026-018422', name:'Synthetic promoter SP-Δ14', type:'DNA', host:'S. cerevisiae', status:'certified', tier:'tier-1', safety:'pass', model:'DNA-Diffusion', org:'Wyss Institute', aa:84, date:'2026-04-21' },
    { id:'AG-2026-018421', name:'Fluorescent reporter mNeonLime-X', type:'Protein', host:'Mammalian', status:'certified', tier:'tier-1', safety:'pass', model:'AlphaFold-Gen', org:'UCSF · Lim Lab', aa:236, date:'2026-04-20' },
    { id:'AG-2026-018420', name:'Ribosome-binding site RBS-λ9', type:'DNA', host:'E. coli', status:'certified', tier:'tier-1', safety:'pass', model:'DNA-Diffusion', org:'MIT · Voigt Lab', aa:31, date:'2026-04-20' },
    { id:'AG-2026-018419', name:'Restricted — pathogen homolog flagged', type:'Protein', host:'—', status:'restricted', tier:'tier-3', safety:'fail', model:'ESM-3 · v2.1', org:'[Redacted — under review]', aa:412, date:'2026-04-19' },
    { id:'AG-2026-018418', name:'Thermophilic DNA polymerase θ variant', type:'Protein', host:'T. aquaticus', status:'certified', tier:'tier-1', safety:'pass', model:'ProGen-2', org:'Arc Institute', aa:832, date:'2026-04-19' },
  ];

  const filtered = records.filter(r => {
    if (filter !== 'all' && r.status !== filter && r.type.toLowerCase() !== filter) return false;
    if (query && !(r.id.includes(query) || r.name.toLowerCase().includes(query.toLowerCase()) || r.org.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  const statusBadge = (r) => {
    if (r.status === 'certified') return <span className="badge badge-verify badge-dot">Certified</span>;
    if (r.status === 'under-review') return <span className="badge badge-warn badge-dot">Under review</span>;
    if (r.status === 'restricted') return <span className="badge" style={{background:'#f3dede',color:'var(--danger)',borderColor:'color-mix(in oklab, var(--danger) 30%, transparent)'}}>◉ Restricted</span>;
    return <span className="badge">{r.status}</span>;
  };

  return (
    <div className="route">
      {/* Header */}
      <section className="wrap" style={{padding:'56px 0 32px'}}>
        <div className="flex between" style={{alignItems:'end',gap:24,flexWrap:'wrap'}}>
          <div>
            <div className="eyebrow mb-8">The Registry · Volume I</div>
            <h1 className="display" style={{fontSize:64,margin:0}}>
              18,427 <em>certified</em><br/>sequences.
            </h1>
            <p className="lede mt-16" style={{maxWidth:560}}>
              Every AI-designed biological sequence deposited to ArtGene is listed here. Records are public, citable by AG-ID, and carry a full biosafety scorecard.
            </p>
          </div>
          <div style={{textAlign:'right',fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)',letterSpacing:'0.08em',textTransform:'uppercase',lineHeight:1.9}}>
            <div>SNAPSHOT · 2026-04-22 · 14:33 UTC</div>
            <div>NEXT INDEX BUILD · IN 00:42:18</div>
            <button className="btn btn-ghost btn-sm" style={{marginTop:10}}>↓ Export CSV (2.4 MB)</button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="wrap" style={{padding:'0 0 20px'}}>
        <div style={{
          display:'flex',gap:8,alignItems:'center',padding:'14px 16px',
          background:'var(--paper-2)',border:'0.5px solid var(--rule)',borderRadius:6,flexWrap:'wrap'
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10,paddingRight:14,borderRight:'0.5px solid var(--rule)'}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="var(--ink-3)"/><path d="M10 10 L13 13" stroke="var(--ink-3)" strokeWidth="1"/></svg>
            <input
              value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="Search by AG-ID, sequence name, institution, model…"
              style={{border:'none',background:'transparent',outline:'none',fontSize:13.5,width:360,fontFamily:'var(--sans)',color:'var(--ink)'}}
            />
          </div>
          {[
            ['all','All records'],
            ['certified','Certified'],
            ['under-review','Under review'],
            ['restricted','Restricted'],
            ['protein','Protein'],
            ['rna','RNA'],
            ['dna','DNA'],
          ].map(([k,label])=>(
            <button key={k}
              onClick={()=>setFilter(k)}
              className="btn btn-sm"
              style={{
                background: filter===k ? 'var(--ink)' : 'transparent',
                color: filter===k ? 'var(--paper)' : 'var(--ink-2)',
                borderColor: filter===k ? 'var(--ink)' : 'var(--rule)',
                padding:'6px 12px',
              }}>{label}</button>
          ))}
          <div style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)',letterSpacing:'0.06em'}}>
            {filtered.length.toString().padStart(5,'0')} / 18427 results
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="wrap" style={{padding:'0 0 40px'}}>
        <div style={{background:'var(--paper-2)',border:'0.5px solid var(--rule)',borderRadius:6,overflow:'hidden'}}>
          <table className="tbl">
            <thead>
              <tr style={{background:'var(--paper-3)'}}>
                <th style={{width:140}}>AG-ID</th>
                <th>Sequence</th>
                <th style={{width:90}}>Type</th>
                <th style={{width:120}}>Host</th>
                <th style={{width:140}}>Status</th>
                <th style={{width:180}}>Generating model</th>
                <th style={{width:80,textAlign:'right'}}>Length</th>
                <th style={{width:110}}>Deposited</th>
                <th style={{width:60}}/>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{cursor:'pointer'}} onClick={()=>{setRecordId(r.id);setRoute('record')}}>
                  <td><a className="id">{r.id}</a></td>
                  <td>
                    <div style={{fontSize:13.5,color:'var(--ink)',fontWeight:500,marginBottom:2}}>{r.name}</div>
                    <div style={{fontSize:12,color:'var(--ink-3)'}}>{r.org}</div>
                  </td>
                  <td className="mono" style={{color:'var(--ink-2)'}}>{r.type}</td>
                  <td style={{fontSize:12.5,color:'var(--ink-2)'}}>{r.host}</td>
                  <td>{statusBadge(r)}</td>
                  <td className="mono" style={{fontSize:11.5,color:'var(--ink-2)'}}>{r.model}</td>
                  <td className="mono" style={{textAlign:'right',fontSize:12,color:'var(--ink-2)'}}>{r.aa.toLocaleString()}</td>
                  <td className="mono" style={{fontSize:11.5,color:'var(--ink-3)'}}>{r.date}</td>
                  <td style={{textAlign:'right',color:'var(--ink-3)'}}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex between" style={{alignItems:'center',marginTop:20,fontFamily:'var(--mono)',fontSize:11.5,color:'var(--ink-3)',letterSpacing:'0.05em'}}>
          <div>PAGE 01 / 1843 · 10 PER PAGE</div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm">← Prev</button>
            <button className="btn btn-ghost btn-sm">Next →</button>
          </div>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { RegistryPage });
