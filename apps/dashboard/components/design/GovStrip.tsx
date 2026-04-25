export function GovStrip() {
  return (
    <div className="gov-strip">
      <div className="gov-strip-inner">
        <span className="flex items-center gap-1">
          <svg className="shield" viewBox="0 0 10 12" fill="none" width="10" height="12" aria-hidden>
            <path d="M5 0.5 L9.5 2 V6 C9.5 9, 5 11.5, 5 11.5 C5 11.5, 0.5 9, 0.5 6 V2 L5 0.5Z" stroke="currentColor" strokeWidth="0.6"/>
          </svg>
          An independent scientific registry
        </span>
        <span className="sep">·</span>
        <span>For Art(tificial) biological sequences</span>
        <span className="sep">·</span>
        <span>Operated under the ArtGene Consortium v1.0</span>
        <span style={{ marginLeft: "auto" }}>EN · FR · ES · ZH · JA</span>
      </div>
    </div>
  );
}
