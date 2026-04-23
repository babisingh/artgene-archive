// Shared components & SVG motifs for ArtGene Archive
const { useState, useEffect, useMemo, useRef } = React;

// ============ BRAND GLYPH ============
function BrandGlyph({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="0.6" opacity="0.4"/>
      <path d="M8 8 Q16 16, 24 8 M8 24 Q16 16, 24 24" stroke="currentColor" strokeWidth="1" fill="none"/>
      <path d="M8 8 Q16 16, 24 8" stroke="var(--accent)" strokeWidth="1" fill="none"/>
      <circle cx="16" cy="16" r="1.4" fill="var(--accent)"/>
      <line x1="10" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.4" opacity="0.5"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke="currentColor" strokeWidth="0.4" opacity="0.5"/>
    </svg>
  );
}

// ============ GOV STRIP ============
function GovStrip() {
  return (
    <div className="gov-strip">
      <div className="gov-strip-inner">
        <span>
          <svg className="shield" viewBox="0 0 10 12" fill="none">
            <path d="M5 0.5 L9.5 2 V6 C9.5 9, 5 11.5, 5 11.5 C5 11.5, 0.5 9, 0.5 6 V2 L5 0.5Z" stroke="currentColor" strokeWidth="0.6"/>
          </svg>
          An independent scientific registry
        </span>
        <span className="sep">·</span>
        <span>Operated under the ArtGene Consortium Charter v1.2</span>
        <span className="sep">·</span>
        <span>Endorsed by WHO BioSec Working Group (observer)</span>
        <span style={{marginLeft:'auto'}}>EN · FR · ES · ZH · JA</span>
      </div>
    </div>
  );
}

// ============ HEADER ============
function Header({ route, setRoute }) {
  const navItems = [
    ['home', 'Overview'],
    ['registry', 'Registry'],
    ['record', 'Record'],
    ['register', 'Deposit'],
    ['about', 'Charter'],
    ['docs', 'Documentation'],
  ];
  return (
    <>
      <GovStrip/>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href="#home" onClick={e=>{e.preventDefault();setRoute('home')}}>
            <BrandGlyph/>
            ArtGene <em>Archive</em>
          </a>
          <nav className="nav">
            {navItems.map(([k, label]) => (
              <a key={k} href={`#${k}`} className={route===k?'active':''} onClick={e=>{e.preventDefault();setRoute(k)}}>{label}</a>
            ))}
          </nav>
          <div className="nav-meta">
            <span className="dot"/>
            <span>LIVE · 18,427 SEQUENCES</span>
          </div>
        </div>
      </header>
    </>
  );
}

// ============ FOOTER ============
function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <div className="brand" style={{fontSize:22,marginBottom:16}}>
            <BrandGlyph size={28}/>
            ArtGene <em>Archive</em>
          </div>
          <p style={{color:'var(--ink-3)',fontSize:13,lineHeight:1.6,maxWidth:340}}>
            An open registry and provenance layer for AI-generated biological sequences. Operated by the ArtGene Consortium as a public-interest scientific infrastructure.
          </p>
          <div className="mono" style={{fontSize:10.5,color:'var(--ink-4)',letterSpacing:'0.08em',marginTop:20,textTransform:'uppercase'}}>
            artgene-archive.org · est. 2026
          </div>
        </div>
        <div>
          <h5>Registry</h5>
          <ul>
            <li><a>Deposit a sequence</a></li>
            <li><a>Browse records</a></li>
            <li><a>Biosafety console</a></li>
            <li><a>Contributor index</a></li>
            <li><a>API & downloads</a></li>
          </ul>
        </div>
        <div>
          <h5>Institution</h5>
          <ul>
            <li><a>Charter & governance</a></li>
            <li><a>Working groups</a></li>
            <li><a>Biosafety policy</a></li>
            <li><a>Funding & partners</a></li>
            <li><a>Press room</a></li>
          </ul>
        </div>
        <div>
          <h5>Contact</h5>
          <ul>
            <li><a>contact@artgene-archive.org</a></li>
            <li><a>biosafety@artgene-archive.org</a></li>
            <li><a>press@artgene-archive.org</a></li>
          </ul>
          <h5 style={{marginTop:24}}>Mirrors</h5>
          <ul>
            <li>EU · mirror.ebi.ac.uk/artgene</li>
            <li>JP · mirror.ddbj.nig.ac.jp/artgene</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 ArtGene Consortium · Open Data under CC-BY-4.0</span>
        <span>VERSION 1.3.0 · BUILD 2026.04.18-STABLE</span>
      </div>
    </footer>
  );
}

// ============ HELIX SVG (subtle, editorial) ============
function Helix({ animated = true }) {
  // Generate two sine-wave strands
  const points = 48;
  const w = 400, h = 400;
  const amp = 80;
  const cx = w/2;
  const strandA = [];
  const strandB = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const y = t * h;
    const phase = t * Math.PI * 5;
    strandA.push([cx + Math.sin(phase) * amp, y]);
    strandB.push([cx - Math.sin(phase) * amp, y]);
  }
  // Crossbars every 4 points
  const bars = [];
  for (let i = 2; i < points; i += 3) {
    const [x1, y1] = strandA[i];
    const [x2, y2] = strandB[i];
    const back = Math.sin((i/points)*Math.PI*5) > 0;
    bars.push({ x1, y1, x2, y2, back });
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <filter id="ink-blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.3"/>
        </filter>
      </defs>
      {/* Concentric rings backdrop */}
      {[180,140,100,60].map((r,i)=>(
        <circle key={r} cx={cx} cy={h/2} r={r} fill="none" stroke="var(--rule)" strokeWidth="0.3" opacity={0.6 - i*0.1}/>
      ))}
      {/* Compass ticks */}
      {Array.from({length:60}).map((_,i)=>{
        const a = (i/60)*Math.PI*2;
        const r1 = 190, r2 = i%5===0 ? 200 : 196;
        return <line key={i} x1={cx+Math.cos(a)*r1} y1={h/2+Math.sin(a)*r1} x2={cx+Math.cos(a)*r2} y2={h/2+Math.sin(a)*r2} stroke="var(--ink-4)" strokeWidth="0.4"/>;
      })}
      {/* Strand B (back, lighter) */}
      <polyline points={strandB.map(p=>p.join(',')).join(' ')} fill="none" stroke="var(--ink-3)" strokeWidth="0.8" opacity="0.55"/>
      {/* Bars behind */}
      {bars.filter(b=>b.back).map((b,i)=>(
        <line key={'bb'+i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke="var(--ink-4)" strokeWidth="0.5" opacity="0.7"/>
      ))}
      {/* Strand A (front) */}
      <polyline points={strandA.map(p=>p.join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="1.1"/>
      {/* Bars in front */}
      {bars.filter(b=>!b.back).map((b,i)=>(
        <line key={'bf'+i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke="var(--accent)" strokeWidth="0.7"/>
      ))}
      {/* Base labels */}
      {bars.slice(0,6).map((b,i)=>(
        <text key={'t'+i} x={Math.max(b.x1,b.x2)+6} y={b.y1+3} fontSize="7" fontFamily="var(--mono)" fill="var(--ink-4)" letterSpacing="0.05em">{['A-T','G-C','C-G','T-A','G-C','A-T'][i]}</text>
      ))}
      {/* Nodes */}
      {strandA.filter((_,i)=>i%6===0).map(([x,y],i)=>(
        <circle key={'a'+i} cx={x} cy={y} r="2" fill="var(--paper)" stroke="var(--ink)" strokeWidth="0.8"/>
      ))}
    </svg>
  );
}

// ============ CODON WATERMARK GRID (cryptographic motif) ============
function CodonGrid({ rows = 8, cols = 16, highlights = null }) {
  // Deterministic pattern: bits of an arbitrary signature
  const cells = [];
  const sig = "01101001 10110100 11001010 01110011 10010110 01011100 11100101 00110110".replace(/ /g,'');
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) % sig.length;
      const on = sig[idx] === '1';
      cells.push({ r, c, on });
    }
  }
  const cell = 14, gap = 3;
  const w = cols * (cell + gap), h = rows * (cell + gap);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {cells.map(({r,c,on},i)=>(
        <rect key={i} x={c*(cell+gap)} y={r*(cell+gap)} width={cell} height={cell} rx="1"
          fill={on ? 'var(--accent)' : 'var(--rule)'}
          opacity={on ? 1 : 0.5}/>
      ))}
    </svg>
  );
}

// ============ CERT SEAL ============
function CertSeal({ size = 180 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <path id="seal-circle" d="M 100 100 m -78 0 a 78 78 0 1 1 156 0 a 78 78 0 1 1 -156 0"/>
      </defs>
      {/* Outer ring with ticks */}
      <g className="seal-ring">
        {Array.from({length:72}).map((_,i)=>{
          const a=(i/72)*Math.PI*2;
          const r1 = 92, r2 = i%6===0?98:95;
          return <line key={i} x1={100+Math.cos(a)*r1} y1={100+Math.sin(a)*r1} x2={100+Math.cos(a)*r2} y2={100+Math.sin(a)*r2} stroke="var(--ink)" strokeWidth="0.5"/>;
        })}
        <text fontSize="8.5" fontFamily="var(--mono)" letterSpacing="0.28em" fill="var(--ink-2)">
          <textPath href="#seal-circle" startOffset="0">
            ARTGENE CONSORTIUM · CERTIFIED PROVENANCE · 2026 · TAMPER EVIDENT ·
          </textPath>
        </text>
      </g>
      {/* Inner */}
      <circle cx="100" cy="100" r="62" fill="none" stroke="var(--ink)" strokeWidth="0.5"/>
      <circle cx="100" cy="100" r="52" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="0.5"/>
      {/* Central mark */}
      <g transform="translate(100 100)">
        <path d="M -28 14 Q 0 -20, 28 14 M -28 -14 Q 0 20, 28 -14" stroke="var(--accent)" strokeWidth="1.2" fill="none"/>
        <circle r="3" fill="var(--accent)"/>
      </g>
      <text x="100" y="156" textAnchor="middle" fontSize="8" fontFamily="var(--mono)" letterSpacing="0.2em" fill="var(--ink-2)">AG·2026</text>
    </svg>
  );
}

// ============ ANIMATED COUNTER ============
function Counter({ to, suffix = '', dur = 1200 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let start; let raf;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n.toLocaleString()}{suffix}</>;
}

// ============ TICKER ============
function Ticker({ items }) {
  return (
    <div style={{
      overflow:'hidden',
      borderTop:'0.5px solid var(--rule)',
      borderBottom:'0.5px solid var(--rule)',
      background:'var(--paper-2)',
      position:'relative',
    }}>
      <div style={{display:'flex',gap:'48px',padding:'10px 0',animation:'slide 60s linear infinite',whiteSpace:'nowrap'}}>
        {[...items, ...items].map((it,i)=>(
          <span key={i} style={{fontFamily:'var(--mono)',fontSize:11.5,color:'var(--ink-2)',letterSpacing:'0.04em'}}>
            <span style={{color:'var(--accent)'}}>▸</span> {it.id} <span style={{color:'var(--ink-4)'}}>·</span> {it.name} <span style={{color:'var(--ink-4)'}}>·</span> {it.org} <span style={{color:'var(--ink-4)'}}>·</span> {it.time}
          </span>
        ))}
      </div>
      <style>{`@keyframes slide { to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

// Export to window for cross-script access
Object.assign(window, {
  BrandGlyph, Header, Footer, Helix, CodonGrid, CertSeal, Counter, Ticker
});
