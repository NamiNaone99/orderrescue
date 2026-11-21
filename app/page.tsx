"use client";

import { ArrowRight, Boxes, ChartNoAxesColumnIncreasing, Check, GitCompareArrows, Inbox, ListOrdered, MessageSquareText, PackageOpen } from "lucide-react";
import { copy } from "@/lib/copy";
import { DataBadge } from "@/components/header";
import { useScenario } from "@/components/scenario-shell";

const steps = [copy.stepMessage, copy.stepIncident, copy.stepPlan, copy.stepConfirm];

export default function DeskPage() {
  const scenario = useScenario();
  return <div className="shell-width desk">
    <div className="desk-heading">
      <div><div className="heading-line"><h1>{copy.desk.th}</h1><span lang="en">{copy.desk.en}</span></div>
        <p>{copy.tagline.th}</p></div>
      <DataBadge scenario={scenario} />
    </div>
    <ol className="workflow" aria-label={copy.workflow.th}>{steps.map((step, index) => (
      <li aria-current={index === 0 ? "step" : undefined} key={step.en}>
        <span className="step-count">{index + 1}</span>{step.th}
        {index + 1 < steps.length && <span className="step-rule" aria-hidden />}
      </li>
    ))}</ol>
    <div className="desk-grid">
      <section className="desk-panel message-panel">
        <div className="panel-heading"><span className="panel-icon"><MessageSquareText aria-hidden /></span>
          <div><h2>{copy.message.th}</h2><span lang="en">{copy.message.en}</span></div></div>
        <div className="message-space"><Inbox size={25} strokeWidth={1.6} aria-hidden />
          <p>{copy.awaitMessage.th}</p><span lang="en">{copy.awaitMessage.en}</span></div>
      </section>
      <section className="desk-panel plan-panel">
        <div className="panel-heading"><span className="panel-icon"><GitCompareArrows aria-hidden /></span>
          <div><h2>{copy.compare.th}</h2><span lang="en">{copy.compare.en}</span></div></div>
        <div className="strategy-grid">{[
          { label: copy.firstCome, Icon: ListOrdered, kind: "baseline" },
          { label: copy.joint, Icon: ChartNoAxesColumnIncreasing, kind: "joint" },
        ].map(({ label, Icon, kind }) => <div className={"strategy " + kind} key={kind}>
          <div className="strategy-title"><Icon size={18} aria-hidden /><div><h3>{label.th}</h3><span lang="en">{label.en}</span></div></div>
          <dl><div><dt><Check size={14} aria-hidden />{copy.onTime.th}</dt><dd aria-label={copy.emptyValue.th}>—</dd></div>
            <div><dt>{copy.extraCost.th}</dt><dd aria-label={copy.emptyValue.th}>—</dd></div></dl>
        </div>)}</div>
        <p className="plan-hint"><ArrowRight size={16} aria-hidden />{copy.hint.th}</p>
      </section>
      <section className="desk-panel stock-panel">
        <div className="panel-heading"><span className="panel-icon"><Boxes aria-hidden /></span>
          <div><h2>{copy.stock.th}</h2><span lang="en">{copy.stock.en}</span></div></div>
        <div className="stock-empty"><span className="stock-sku" aria-label={copy.defaultSku.th + " " + scenario.default_sku_id}>
          <PackageOpen size={16} aria-hidden />{scenario.default_sku_id}</span><span>{copy.stockEmpty.th}</span></div>
      </section>
    </div>
  </div>;
}
