import Link from "next/link";
import { ArrowLeft, FileSearch, TriangleAlert } from "lucide-react";
import { copy, type CopyEntry } from "@/lib/copy";

export function StatusPage({ label, detail, error, retry }: { label: CopyEntry; detail?: CopyEntry; error?: unknown; retry?: () => void }) {
  const Icon = label === copy.error ? TriangleAlert : FileSearch;
  let reference: { label: CopyEntry; value: string } | undefined;
  if (error && typeof error === "object") {
    for (const key of ["request_id", "requestId", "digest"] as const) {
      const value: unknown = Reflect.get(error, key);
      if (typeof value === "string" && value.length > 0) {
        reference = { label: key === "digest" ? copy.errorReference : copy.requestId, value };
        break;
      }
    }
  }
  return <div className="shell-width standalone"><section className="desk-panel status-page">
    <span className="panel-icon"><Icon aria-hidden /></span>
    <h1>{label.th}</h1><p lang="en">{label.en}</p>
    {detail && <p>{detail.th}<br /><span lang="en">{detail.en}</span></p>}
    {reference && <p>{reference.label.th} <code>{reference.value}</code></p>}
    <Link className="return-link" href="/" onNavigate={retry ? event => {
      if (window.location.pathname === "/") {
        event.preventDefault();
        retry();
      }
    } : undefined}><ArrowLeft size={16} aria-hidden />{copy.backToDesk.th}</Link>
  </section></div>;
}
