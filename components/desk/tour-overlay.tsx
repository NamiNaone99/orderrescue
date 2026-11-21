"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, Compass, Play, RotateCcw, X } from "lucide-react";
import { caseCopy, tourCopy as c } from "@/lib/copy";

type Pair = { th: string; en: string };
type Geometry = { top: number; left: number; width: number; height: number; x: number; y: number; mobile: boolean };
type Props = {
  step: number; target: string; body: Pair; error?: Pair; busy: boolean; notes: boolean; since: number; host: HTMLElement | null;
  phase: string; backDisabled: boolean; receipt: boolean; finished: boolean; action?: string;
  back: () => void; next: () => void; act: () => void; exit: () => void; restart: () => void; retry: () => void; resetFinish: () => void;
  chooseCase: () => void;
};

function elapsed(start: number) {
  const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
}

function Notes({ step, since, inline }: { step: number; since: number; inline: boolean }) {
  const [time, setTime] = useState("0:00");
  useEffect(() => {
    function update() { setTime(elapsed(since)); }
    update();
    const timer = window.setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [since]);
  return <aside className={"tour-notes" + (inline ? " inline-notes" : "")} aria-label={c.notes.th}>
    <span><Clock3 aria-hidden /><time aria-label="Elapsed time">{time}</time></span><b>{c.notes.th}</b><p>{c.speaking[step - 1]}</p>
  </aside>;
}

export function TourOverlay(p: Props) {
  const coach = useRef<HTMLElement>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const title = c.titles[p.step - 1];
  useLayoutEffect(() => {
    const panel = coach.current;
    if (!panel) return;
    const target = document.querySelector<HTMLElement>(p.target);
    let frame = 0;
    const noteHeight = () => document.querySelector<HTMLElement>(".tour-notes:not(.inline-notes)")?.offsetHeight ?? 0;
    function place() {
      if (!panel || p.host) return;
      const mobile = window.innerWidth < 768, margin = mobile ? 8 : 20;
      const maxY = window.innerHeight - noteHeight() - margin;
      const box = target?.getBoundingClientRect();
      const top = Math.max(4, (box?.top ?? 12) - 5);
      const left = Math.max(4, (box?.left ?? 12) - 5);
      const width = Math.max(0, Math.min(window.innerWidth - left - 4, (box?.width ?? 0) + 10));
      const height = Math.max(0, Math.min(maxY - top, (box?.bottom ?? 12) + 5 - top));
      const panelWidth = panel.offsetWidth, panelHeight = panel.offsetHeight;
      const rightSpace = window.innerWidth - left - width;
      let x = left + width + 18;
      let y = top + (height - panelHeight) / 2;
      if (rightSpace < panelWidth + 32) {
        if (left > panelWidth + 32) x = left - panelWidth - 18;
        else { x = left + (width - panelWidth) / 2; y = top + height + 12; }
      }
      x = mobile ? margin : Math.max(margin, Math.min(x, window.innerWidth - panelWidth - margin));
      y = mobile ? maxY - panelHeight : Math.max(margin, Math.min(y, maxY - panelHeight));
      const next = { top, left, width, height, x: Math.round(x), y: Math.round(y), mobile };
      setGeo(prev => prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); }
    if (!p.host && target) {
      const mobile = window.innerWidth < 768;
      const box = target.getBoundingClientRect();
      const available = window.innerHeight - noteHeight() - (mobile ? panel.offsetHeight + 26 : 32);
      const wide = box.width > window.innerWidth - panel.offsetWidth - 70;
      const top = wide && !mobile ? 24 : Math.max(12, (available - box.height) / 2);
      window.scrollTo({ top: window.scrollY + box.top - top, behavior: "instant" });
    }
    panel.focus({ preventScroll: true });
    place();
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    if (target) observer.observe(target);
    const notes = document.querySelector<HTMLElement>(".tour-notes");
    if (notes) observer.observe(notes);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule);
    };
  }, [p.target, p.step, p.host, p.phase, p.notes]);

  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const source = event.target instanceof HTMLElement ? event.target : null;
      if (event.key !== "Escape" && (source?.closest("input, textarea, select, [contenteditable=true], [role=combobox]") || event.repeat)) return;
      if (event.key === "Enter" && source?.closest("button, a, [role=button]")) return;
      let action: (() => void) | undefined;
      if (event.key === "Escape") action = p.exit;
      else if (event.key === "ArrowLeft") action = p.back;
      else if (event.key === "ArrowRight" || event.key === "Enter") action = p.next;
      else if (event.key === ".") action = p.act;
      if (action) { event.preventDefault(); event.stopPropagation(); action(); }
    }
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [p]);
  const click = (fn: () => void) => (e: React.MouseEvent) => { if (e.detail <= 1) fn(); };
  const position: CSSProperties = !p.host && geo ? { left: geo.x, top: geo.y } : {};
  const part = <section ref={coach} className={"tour-coach" + (p.host ? " in-dialog" : "")} style={position} tabIndex={0}
    aria-label={c.name.th} data-tour-step={p.step} data-tour-phase={p.phase}>
    <div className="tour-meta"><span><Compass aria-hidden />{c.name.th}<i lang="en">{c.name.en}</i></span>
      <strong aria-label={p.step + " / 8"}>{p.step}/8</strong>
      <button type="button" className="tour-close" aria-label={c.exit.th} onClick={p.exit}><X aria-hidden /></button></div>
    <div className="tour-meter" role="progressbar" aria-label={c.name.en} aria-valuenow={p.step} aria-valuemin={0} aria-valuemax={8}><i style={{ width: (p.step / 8) * 100 + "%" }} /></div>
    <h2>{title.th}</h2><p className="tour-body">{p.error?.th ?? p.body.th}</p>
    <p className="tour-english" lang="en">{p.error?.en ?? p.body.en}</p>
    <div className="tour-actions">
      {p.error ? <><button type="button" disabled={p.busy} onClick={click(p.retry)}><RotateCcw />{c.retry.th}</button>
        <button type="button" disabled={p.busy} onClick={click(p.restart)}>{c.restart.th}</button></>
      : p.finished ? <><button type="button" onClick={p.exit}>{c.keep.th}</button><button type="button" disabled={p.busy} onClick={click(p.resetFinish)}><RotateCcw />{c.resetFinish.th}</button></>
      : <><button type="button" disabled={p.backDisabled || p.busy} onClick={click(p.back)}><ArrowLeft /><span>{c.back.th}<small lang="en">{c.back.en}</small></span></button>
        <button type="button" className="tour-do" disabled={p.busy} onClick={click(p.act)} title={c.doIt.en + " (.)"}><Play /><span>{c.doIt.th}<small lang="en">{c.doIt.en}</small></span></button>
        <button type="button" className="tour-next" disabled={p.busy} onClick={click(p.next)}>
          <span>{p.receipt ? c.finish.th : c.next.th}<small lang="en">{p.receipt ? c.finish.en : c.next.en}</small></span>{p.receipt ? <Check /> : <ArrowRight />}</button></>}
    </div>
    {p.step === 1 && !p.host && <button type="button" className="text-action tour-case-choice" disabled={p.busy} onClick={p.chooseCase}>
      {caseCopy.all.th}<ArrowRight aria-hidden size={15} /></button>}
    {p.host && p.notes && <Notes step={p.step} since={p.since} inline />}
  </section>;
  const region = document.getElementById("desk-announcements");
  return <>
    {region && createPortal(<p>{c.name.th} {p.step}/8 {title.th} {p.error?.th ?? p.body.th}</p>, region)}
    {p.host ? createPortal(part, p.host) : createPortal(<>
      {geo && <div className="tour-spotlight" aria-hidden style={{ left: geo.left, top: geo.top, width: geo.width, height: geo.height }} />}
      {part}{p.notes && <Notes step={p.step} since={p.since} inline={false} />}
    </>, document.body)}
  </>;
}
