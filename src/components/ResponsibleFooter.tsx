export type ResponsibleCfg = {
  status: string; intro: string; limit: string; help: string;
  support: Record<string, { name: string; url: string | null; line: string | null }>;
};

/** Bottom-of-page responsible gambling block. All wording is a placeholder until legal and compliance review it. */
export function ResponsibleFooter({ rg, region }: { rg: ResponsibleCfg; region: string }) {
  const s = rg.support[region] ?? rg.support.Other;
  return (
    <footer className="rg" aria-label="Responsible gambling">
      <h3>Play responsibly</h3>
      <p>{rg.intro}</p>
      <p>{rg.limit}</p>
      <p>{rg.help}</p>
      <p className="rg-help">
        {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : <span>{s.name}</span>}
        {s.line && <span>. {s.line}</span>}
      </p>
      <p className="rg-links"><a href="/privacy">Privacy notice</a></p>
      <p className="rg-status">{rg.status}</p>
    </footer>
  );
}
