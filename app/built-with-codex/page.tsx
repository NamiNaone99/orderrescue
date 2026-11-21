import type { Metadata } from "next";
import { Fragment } from "react";
import { ArrowDown, ArrowUpRight, BookOpenText, GitPullRequest, ListChecks, MessageSquareText, Network, PackageCheck, ScrollText, Signature, Sparkles } from "lucide-react";
import { buildCopy as c, copy } from "@/lib/copy";
import { directory, loadBuildEvidence, repository, source, type LogRow } from "@/lib/codex-log";
import "./evidence.css";

export const metadata: Metadata = { title: copy.built.th };

const links = [
  [c.repository, repository],
  [c.requests, repository + "/pulls?q=is%3Apr"],
  [c.instructions, source("AGENTS.md")],
  [c.plans, directory(".agent/plans")],
  [c.taskLogs, directory("docs/codex-log")],
] as const;

function Heading({ th, en }: { th: string; en: string }) {
  return <h2>{th}<small lang="en">{en}</small></h2>;
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="evidence-link" href={href}>{children}<ArrowUpRight aria-hidden size={15} /></a>;
}

// The ledger uses inline code and links. React escapes every other character as text.
function Inline({ value }: { value: string }) {
  return value.split(/(`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g).map((piece, index) => {
    if (piece.startsWith("`") && piece.endsWith("`")) return <code key={index}>{piece.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(piece);
    if (!link) return <Fragment key={index}>{piece}</Fragment>;
    const safe = /^https:\/\//.test(link[2]) || /^(?:[.\w-]+\/)*[.\w-]+\.md(?:#[\w-]+)?$/.test(link[2]);
    const ledger = source("docs/CODEX_LOG.md");
    return safe && URL.canParse(link[2], ledger)
      ? <a key={index} href={new URL(link[2], ledger).href}>{link[1]}</a>
      : <Fragment key={index}>{link[1]}</Fragment>;
  });
}

function Timeline({ rows }: { rows: LogRow[] }) {
  return <section className="evidence-panel evidence-timeline" id="timeline">
    <div className="evidence-section-head"><Heading {...c.timeline} />
      <SourceLink href={source("docs/CODEX_LOG.md")}>{c.ledger.th}</SourceLink></div>
    {rows.length ? <div className="evidence-table-scroll" tabIndex={0} role="region" aria-label={c.table.th}>
      <table><caption className="sr-only">{c.table.th}</caption>
        <thead><tr>{[c.time, c.task, c.surface, c.model, c.outcome, c.human].map(label => <th key={label.en} scope="col">{label.th}<small lang="en">{label.en}</small></th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.time + row.task}>
          <td className="event-time"><time>{row.time}</time></td>
          <th scope="row">{row.logHref
            ? <a className="event-task" href={row.logHref}>{row.task}</a>
            : <><b lang="en">{row.task}</b><span>{row.who}</span></>}
            <span lang="en">{row.summary}</span></th>
          <td className="event-meta"><span className="mobile-label">{c.surface.th} </span>{row.surface === "to fill" ? c.unknown.th : row.surface}</td>
          <td className="event-meta"><span className="mobile-label">{c.model.th} </span>{row.model === "to fill" ? c.unknown.th : row.model}</td>
          <td className="event-outcome" lang="en"><Inline value={row.outcome} /></td>
          <td className="event-correction"><span className="mobile-label">{c.human.th} </span>{row.corrections && row.corrections !== "to fill" ? <span lang="en"><Inline value={row.corrections} /></span> : c.pending.th}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="evidence-muted">{c.noRows.th}<span lang="en">{c.noRows.en}</span></p>}
  </section>;
}

const stageIcons = [MessageSquareText, Sparkles, ListChecks, Network, Signature, PackageCheck];

function Architecture() {
  return <section className="evidence-panel evidence-diagram">
    <Heading {...c.architecture} />
    <svg role="img" aria-labelledby="architecture-title architecture-desc" viewBox="0 0 310 284" className="evidence-flow">
      <title id="architecture-title">{c.architecture.th}</title>
      <desc id="architecture-desc">{c.stages.map(stage => stage.th).join(" → ")}</desc>
      {c.stages.map(({ th, en }, index) => {
        const Icon = stageIcons[index];
        const last = index === c.stages.length - 1;
        return <g key={en} transform={`translate(2 ${index * 48 + 1})`}>
          {!last && <path d="M18 33v15m-3-4 3 4 3-4" fill="none" stroke="#638c83" strokeWidth="1.6" />}
          <rect width="36" height="33" rx="7" fill={last ? "#0f766e" : "#e8f3ef"} />
          <Icon x={9} y={7} width={18} height={18} stroke={last ? "#fff" : "#145d51"} aria-hidden />
          <text x="51" y="14" className="flow-th">{th}</text><text x="51" y="32" className="flow-en" lang="en">{en}</text>
        </g>;
      })}
    </svg>
    <SourceLink href={source("docs/ARCHITECTURE.md")}>{c.architectureDoc.th}</SourceLink>
  </section>;
}

function CaseStudy({ prompt, review, row }: { prompt?: string; review?: string; row: LogRow }) {
  const pull = row.outcome.match(/https:\/\/github\.com\/NamiNaone99\/orderrescue\/pull\/\d+/)?.[0];
  return <section className="evidence-panel evidence-example">
    <div className="evidence-section-head"><Heading {...c.example} /><GitPullRequest aria-hidden size={23} /></div>
    <p>{c.brief.th}</p>
    {prompt && <><blockquote lang="en">{prompt.split(/\r?\n/)[0]}</blockquote>
      <details className="evidence-prompt"><summary>{c.fullPrompt.th} <span lang="en">{c.fullPrompt.en}</span></summary><pre lang="en">{prompt}</pre><SourceLink href={repository + "/blob/862a306/docs/CODEX_TASKS.md#t03-planner-first-come-and-joint-execplan"}>{c.originalPrompt.th}</SourceLink></details></>}
    <div className="evidence-case-links">
      <SourceLink href={repository + "/blob/fe5d641/.agent/plans/T03.md"}>{c.plan.th}</SourceLink>
      {pull && <SourceLink href={pull}>PR #{pull.split("/").at(-1)}</SourceLink>}
      <SourceLink href={repository + "/blob/fe5d641/tests/planner/solver.test.ts"}>{c.regression.th}</SourceLink>
    </div>
    {review && <><h3>{c.review.th}</h3><p>{c.reviewCase.th}<small lang="en">{review}</small></p></>}
    <SourceLink href={source("docs/codex-log/T03.md")}>{c.caseLog.th}</SourceLink>
  </section>;
}

export default function BuiltPage() {
  const { rows, counts, corrections, prompt, plannerReview } = loadBuildEvidence();
  const planner = rows.find(row => row.task === "T03");
  const metrics = ([[counts.tasks, c.numbered], [counts.pulls, c.pulls], [counts.fixes, c.fixes]] as const)
    .filter(([value]) => value > 0);
  return <article className="evidence-page">
    <header className="evidence-cover">
      <div><p className="evidence-date"><time dateTime="2026-11-21">{c.date.th}</time><span>{c.zone.th} (ICT)</span></p>
        <h1>{copy.built.th}</h1><span className="evidence-cover-en" lang="en">{copy.built.en}</span>
        <p className="evidence-intro">{c.intro.th}<small lang="en">{c.intro.en}</small></p>
        <a className="evidence-jump" href="#timeline"><ArrowDown size={16} aria-hidden />{c.jump.th}</a>
      </div>
      {metrics.length > 0 && <dl className="evidence-metrics">
        {metrics.map(([value, { th, en }]) => <div key={en}><dt>{th}<span lang="en">{en}</span></dt><dd>{value}</dd></div>)}
      </dl>}
    </header>
    <div className="evidence-grid">{planner && <CaseStudy row={planner} prompt={prompt} review={plannerReview} />}<Architecture /></div>
    <Timeline rows={rows} />
    <div className="evidence-grid evidence-bottom"><section className="evidence-panel">
      <div className="evidence-section-head"><Heading {...c.corrections} /><ScrollText size={22} aria-hidden /></div>
      {corrections.length ? <ul className="evidence-corrections">{corrections.map((entry, index) => <li key={index}><Inline value={entry} /></li>)}</ul>
        : <p>{c.noCorrections.th} <small lang="en">{c.noCorrections.en}</small></p>}
    </section>
    <section className="evidence-panel"><div className="evidence-section-head"><Heading {...c.sources} /><BookOpenText size={22} aria-hidden /></div>
      <ul className="evidence-sources">{links.map(([{ th, en }, href]) => <li key={href}><a href={href}>{th}<span lang="en">{en}</span><ArrowUpRight size={16} aria-hidden /></a></li>)}</ul>
    </section></div>
  </article>;
}
