import type { Metadata } from "next";
import { ArrowUpRight, BookOpen, FlaskConical, ShieldCheck } from "lucide-react";
import { Label, ProvenanceTable, Text } from "@/components/ProvenanceTable";
import { copy, dataCopy as c } from "@/lib/copy";
import { fill, loadProvenance, parameters, type Evaluation, type Provenance } from "@/lib/provenance";
import "./provenance.css";

export const metadata: Metadata = { title: copy.data.th };
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });
const kinds = ["real", "simulated", "synthetic"] as const;

function Source({ p }: { p: Provenance }) {
  return <section className="provenance-source">
    <h2><BookOpen size={22} aria-hidden="true" /><span><Text item={c.source} /></span></h2>
    <div className="provenance-sourceTitle">
      {p.source_name && <strong lang="en">{p.source_name}</strong>}
      {p.source_url && <a href={p.source_url}>{c.original.th}<ArrowUpRight size={17} aria-hidden="true" /></a>}
      {p.licence && (p.licence_url ? <a href={p.licence_url} lang="en">{p.licence}<ArrowUpRight size={17} aria-hidden="true" /></a> : <span lang="en">{p.licence}</span>)}
    </div>
    {p.row_counts && <dl className="provenance-stats">{Object.entries(c.counts).map(([key, label]) => {
      const value = p.row_counts?.[key];
      return value !== undefined && <div key={key}><dt><Text item={label} /></dt><dd>{number.format(value)}</dd></div>;
    })}</dl>}
    <dl className="provenance-facts">
      {p.slice_date && <div><dt><Text item={c.sliceDate} /></dt><dd><time dateTime={p.slice_date}>{p.slice_date}</time></dd></div>}
      {p.seed !== undefined && <div><dt><Text item={c.seed} /></dt><dd>{p.seed}</dd></div>}
      {p.source_file_sha256 && <div><dt><Text item={c.hash} /></dt><dd><code>{p.source_file_sha256.slice(0, 12)}</code></dd></div>}
    </dl>
    {p.citation && <p className="provenance-citation" lang="en">{p.citation}</p>}
    <p className="provenance-notice"><Text item={c.modified} /></p>
  </section>;
}

function EvalTable({ run }: { run: Evaluation }) {
  const stats = run.counts;
  return <div className="provenance-eval"><h3><Text item={c.evalName} /></h3>
    <dl className="provenance-facts">
      {run.timestamp && <div><dt><Text item={c.date} /></dt><dd><time dateTime={run.timestamp}>{run.timestamp.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time></dd></div>}
      {run.interpreter && <div><dt><Text item={c.interpreter} /></dt><dd>{run.interpreter}{run.models?.length ? " · " + run.models.join(", ") : ""}</dd></div>}
      {run.split && <div><dt><Text item={c.split} /></dt><dd>{run.split}</dd></div>}
    </dl>
    {stats && <table className="provenance-scores"><thead><tr><th scope="col"><Text item={c.metric} /></th><th scope="col"><Text item={c.result} /></th></tr></thead>
      <tbody>{Object.entries(c.metrics).map(([key, label]) => {
        const value = stats[key as keyof typeof stats];
        return value !== undefined && <tr key={key}><th scope="row"><Text item={label} /></th>
          <td>{typeof value === "number" ? number.format(value) : number.format(value.correct) + " / " + number.format(value.total)}</td></tr>;
      })}</tbody></table>}
  </div>;
}

export default function DataPage() {
  const { provenance, messageCount, evaluation } = loadProvenance();
  const changes = provenance ? [c.filters, fill(c.shift, parameters(provenance)), fill(c.assumption, parameters(provenance))] : [];
  return <article className="provenance-page">
    <header className="provenance-intro"><h1><Text item={c.title} /></h1>
      <div className="provenance-summary">{(provenance ? kinds : ["synthetic"] as const).map(kind =>
        <div key={kind}><Label kind={kind} /><p><Text item={c.summary[kind]} /></p></div>)}</div>
      {!provenance && <p className="provenance-notice"><Text item={c.absent} /></p>}
    </header>
    {provenance && <><Source p={provenance} /><ProvenanceTable p={provenance} />
      <section className="provenance-panel"><h2><Text item={c.changes} /></h2><ul className="provenance-changes">
        {changes.map(item => item && <li key={item.en}><Text item={item} /></li>)}</ul></section></>}
    <section className="provenance-panel"><h2><Text item={c.chat} /></h2>
      {messageCount !== undefined && <p><Text item={fill(c.messages, { n: number.format(messageCount) }) ?? c.syntheticChat} /></p>}
      <p><Text item={c.syntheticChat} /></p>
      {evaluation ? <EvalTable run={evaluation} /> : <p className="provenance-notice"><Text item={c.noEval} /></p>}
    </section>
    <section className="provenance-panel"><h2><FlaskConical size={21} aria-hidden="true" /><span><Text item={c.limits} /></span></h2><p><Text item={c.limitText} /></p></section>
    <section className="provenance-panel"><h2><ShieldCheck size={21} aria-hidden="true" /><span><Text item={c.privacy} /></span></h2><p><Text item={c.privacyText} /></p></section>
  </article>;
}
