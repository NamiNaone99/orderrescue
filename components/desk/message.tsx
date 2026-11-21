import { BadgeCheck, Check, ChevronRight, CircleHelp, Clock3, LoaderCircle, MessageSquareText, Pencil, ScanText, Warehouse } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { copy, polishCopy } from "@/lib/copy";
import { formatBangkokTime } from "@/lib/domain/time";
import type { InterpretResponse, StateResponse } from "@/lib/domain/contracts";

export function MessageInput({ message, samples, edit, analyse, pending, locked, editingDisabled, inputRef, onManual, manualOpen, manualDisabled }: {
  onManual: () => void; manualOpen: boolean; manualDisabled: boolean;
  message: string; samples: StateResponse["scenario"]["sample_messages"]; edit: (text: string) => void;
  analyse: () => void; pending: boolean; locked: boolean; editingDisabled: boolean; inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return <section className="desk-panel message-panel">
    <div className="panel-heading"><span className="panel-icon"><MessageSquareText aria-hidden /></span>
      <div><h2><label htmlFor="warehouse-message">{copy.message.th}</label></h2><span lang="en">{copy.message.en}</span></div></div>
    <textarea id="warehouse-message" ref={inputRef} className="message-editor" value={message} maxLength={500}
      disabled={locked || editingDisabled} onChange={event => edit(event.target.value)} aria-describedby="privacy-note"
      onKeyDown={event => { if (event.ctrlKey && event.key === "Enter" && !pending && !locked && message.trim()) { event.preventDefault(); analyse(); } }} />
    <div className="input-meta"><span>{copy.sample.th}</span><span>{message.length}/500</span></div>
    <div className="sample-chips">{samples.map(sample => <button type="button" key={sample.text}
      disabled={locked || editingDisabled} aria-pressed={sample.text === message} onClick={() => edit(sample.text)}>{sample.label_th}</button>)}</div>
    <p id="privacy-note" className="privacy-note">{copy.privacy.th}<span lang="en">{copy.privacy.en}</span></p>
    <div className="analyse-slot"><button className="primary-action analyse-action" type="button" disabled={locked || pending || !message.trim()}
      aria-busy={pending} onClick={analyse}>{pending ? <LoaderCircle className="spin" /> : <ScanText />}
      {pending ? copy.analysing.th : copy.analyse.th}<ChevronRight className="end-icon" /></button></div>
    <button type="button" className="text-action manual-link" disabled={manualDisabled} aria-expanded={manualOpen} onClick={onManual}>{copy.manualEntry.th}</button>
  </section>;
}

export function IncidentCard({ answer, message, sku, catalog, select, locked, edit, note }: {
  answer: Extract<InterpretResponse, { outcome: "incident" }>; message: string; sku: string;
  catalog: StateResponse["skus"]; select: (id: string) => void; locked: boolean; edit: () => void; note?: ReactNode;
}) {
  const inc = answer.incident;
  const start = message.indexOf(inc.evidence_quote);
  return <section id="desk-incident" className="desk-panel incident-card" tabIndex={-1} aria-labelledby="incident-heading">
    <div className="panel-heading"><span className="panel-icon"><BadgeCheck /></span><div><h2 id="incident-heading">{copy.incident.th}</h2><span lang="en">{copy.incident.en}</span></div><button className="text-action incident-edit" type="button" onClick={edit} disabled={locked}><Pencil aria-hidden />{polishCopy.edit.th}</button></div>
    <div className="incident-meta"><span><Warehouse />{copy.warehouse.th} {inc.warehouse_id}</span><span><Clock3 />{formatBangkokTime(inc.window_start)}–{formatBangkokTime(inc.window_end)}</span></div>
    <fieldset className="incident-skus"><legend>{inc.sku_ids.length > 1 ? copy.chooseSku.th : copy.item.th}</legend>
      {inc.sku_ids.map(id => <label key={id}>{inc.sku_ids.length > 1 && <input type="radio" name="incident-sku" value={id}
        checked={sku === id} disabled={locked} onChange={() => select(id)} />}<b>{id}</b> <span className="sku-name" title={catalog.find(item => item.id === id)?.name}>{catalog.find(item => item.id === id)?.name}</span></label>)}</fieldset>
    {inc.sku_ids.length > 1 && !sku && <button type="button" className="mobile-choose-sku" onClick={() =>
      document.querySelector<HTMLInputElement>('input[name="incident-sku"]')?.focus()}>{copy.chooseSku.th}</button>}
    <span className="field-caption">{copy.evidence.th}</span><blockquote>{start < 0 ? message : <>
      {message.slice(0, start)}<mark>{inc.evidence_quote}</mark>{message.slice(start + inc.evidence_quote.length)}</>}</blockquote>
    <div className="verify-line"><span><Check />{copy.validated.th}</span><small>{answer.interpreter.used} · {answer.interpreter.latency_ms} ms</small></div>
    {note}
  </section>;
}

const secondary = { warehouse: copy.aboutWarehouse, sku: copy.aboutSku, time: copy.aboutTime, conflict: copy.aboutConflict, other: copy.aboutOther };
export function ClarificationCard({ answer, onEdit, onManual, manualOpen }: {
  answer: Extract<InterpretResponse, { outcome: "clarification" }>; onEdit: () => void; onManual: () => void; manualOpen: boolean;
}) {
  const about = secondary[answer.clarification.about];
  return <section id="desk-incident" className="desk-panel clarification" tabIndex={-1} aria-labelledby="clarify-heading">
    <div className="panel-heading"><span className="panel-icon"><CircleHelp /></span><h2 id="clarify-heading">{copy.clarify.th}</h2></div>
    <p>{answer.clarification.question_th}</p><small lang="en">{about.en}</small>
    <button className="outline-action" onClick={onEdit}>{copy.editMessage.th}</button>
    <button type="button" className="text-action manual-link" aria-expanded={manualOpen} onClick={onManual}>{copy.manualShort.th}</button>
  </section>;
}

export function IncidentSkeleton() {
  return <section className="desk-panel incident-card incident-skeleton" aria-label={copy.incident.th} aria-busy="true">
    <div className="panel-heading"><span className="panel-icon"><BadgeCheck aria-hidden /></span><div><h2>{copy.incident.th}</h2><span lang="en">{copy.incident.en}</span></div></div>
    <div className="skeleton-fields" aria-hidden><i /><i /><i /></div>
  </section>;
}
