"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageSquareText, Send } from "lucide-react";
import { api, DeskApiError } from "@/lib/client/api";
import type { ChatApply, ChatContext, InterpretResponse, WarehouseEvent } from "@/lib/domain/contracts";
import type { ScenarioId } from "@/lib/domain/types";
import { heroFollowups } from "@/lib/domain/chat-samples";
import { chatCopy as c, copy } from "@/lib/copy";
import { formatBangkokTime } from "@/lib/domain/time";
import "./warehouse-chat.css";

type Outage = Extract<InterpretResponse, { outcome: "incident" }>;
type Line = {
  key: string;
  message: string;
  receivedAt: string;
  sender: string | null;
  context: ChatContext;
  answer: Exclude<InterpretResponse, Outage>;
  applied: boolean;
};
type Opening = { receivedAt: string; warehouse: string | null; message: string };
const sampleNames = { delay: c.sampleDelay, stock_found: c.sampleFound, resumed: c.sampleResumed };
const receivedTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function description(event: WarehouseEvent) {
  const label = event.type === "stock_found" ? c.found : c[event.type];
  const value = event.type === "stock_found" ? String(event.quantity) : formatBangkokTime(event.at);
  return label.th.replace("{wh}", event.warehouse_id).replace("{sku}", event.sku_id).replace("{value}", value);
}

export function WarehouseChat({
  scenario,
  incident,
  openings,
  warehouses,
  disabled,
  degraded,
  setReading,
  setVisible,
  acceptOutage,
  applyReport,
}: {
  scenario: ScenarioId;
  incident: ChatContext["incident"];
  openings: Opening[];
  disabled: boolean;
  degraded: boolean;
  setReading: (busy: boolean) => void;
  setVisible: (visible: boolean) => void;
  warehouses: readonly { id: string; name_th: string }[];
  acceptOutage: (answer: Outage, message: string, receivedAt: string, sender: string | null) => void;
  applyReport: (input: ChatApply) => Promise<boolean>;
}) {
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const applying = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!panel.current || !("IntersectionObserver" in window)) return;
    // Keep the mobile confirmation in its original slot while an operator is reading or editing chat.
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "-10% 0px -15%" });
    observer.observe(panel.current);
    return () => { observer.disconnect(); setVisible(false); };
  }, [setVisible]);
  useEffect(
    () => () => {
      active.current?.abort();
      setReading(false);
    },
    [setReading],
  );
  const locked = disabled || pending;
  async function send() {
    if (locked || active.current || !message.trim()) return;
    const controller = new AbortController();
    active.current = controller;
    const text = message.trim();
    const receivedAt = new Date().toISOString();
    const context = { incident };
    setPending(true);
    setReading(true);
    setError("");
    try {
      const answer = await api.interpret({ scenario, message: text, chat: context }, controller.signal);
      if (controller.signal.aborted) return;
      if (answer.outcome === "incident") acceptOutage(answer, text, receivedAt, sender || null);
      else
        setLines((previous) => [
          ...previous,
          {
            key: crypto.randomUUID(),
            message: text,
            receivedAt,
            sender: sender || null,
            context,
            answer,
            applied: false,
          },
        ]);
      setMessage("");
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof DeskApiError && cause.status === 429 ? copy.limited.th : c.readError.th);
    } finally {
      if (!controller.signal.aborted) {
        setPending(false);
        setReading(false);
        active.current = null;
      }
    }
  }
  async function apply(line: Line) {
    if (locked || degraded || applying.current || line.applied || line.answer.outcome !== "event") return;
    applying.current = true;
    setError("");
    try {
      const ok = await applyReport({
        scenario,
        key: line.key,
        message: line.message,
        chat: line.context,
        evidence_quote: line.answer.evidence_quote,
        event: line.answer.event,
      });
      if (ok)
        setLines((previous) =>
          previous.map((item) => (item.key === line.key ? { ...item, applied: true } : item)),
        );
      else setError(c.applyError.th);
    } finally {
      applying.current = false;
    }
  }
  const messages = [
    ...openings.map((opening, index) => ({ ...opening, key: "outage-" + index, line: null })),
    ...lines.map((line) => ({
      key: line.key,
      receivedAt: line.receivedAt,
      message: line.message,
      warehouse: line.sender,
      line,
    })),
  ].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return (
    <section ref={panel} id="warehouse-chat" className="desk-panel warehouse-chat" aria-labelledby="chat-heading">
      <div className="panel-heading">
        <span className="panel-icon">
          <MessageSquareText aria-hidden />
        </span>
        <div>
          <h2 id="chat-heading">{c.title.th}</h2>
          <span lang="en">{c.title.en}</span>
        </div>
      </div>
      <div className="warehouse-chat-grid">
        <div className="chat-history" aria-live="polite" aria-relevant="additions text">
          <h3>
            {c.history.th} <small>{c.zone.th}</small>
          </h3>
          {messages.length === 0 ? (
            <p>{c.empty.th}</p>
          ) : (
            <ol aria-label={c.history.th}>
              {messages.map(({ key, receivedAt, warehouse, message: body, line }) => (
                <li key={key}>
                  <header>
                    <strong>{warehouse ? copy.warehouse.th + " " + warehouse : copy.desk.th}</strong>
                    <time dateTime={receivedAt}>{receivedTime.format(new Date(receivedAt))}</time>
                  </header>
                  <p>{body}</p>
                  {line?.answer.outcome === "event" && (
                    <div className="chat-proposal">
                      <strong>{description(line.answer.event)}</strong>
                      <p>
                        {copy.evidence.th} <q>{line.answer.evidence_quote}</q>
                      </p>
                      <small>{line.answer.interpreter.used}</small>
                      {line.applied ? (
                        <span className="chat-applied">
                          <Check size={16} aria-hidden />
                          {c.applied.th}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="outline-action chat-apply"
                          data-chat-apply={line.answer.event.type}
                          disabled={locked || degraded}
                          onClick={() => void apply(line)}
                        >
                          {c.apply.th}
                          <small lang="en">{c.apply.en}</small>
                        </button>
                      )}
                    </div>
                  )}
                  {line?.answer.outcome === "clarification" && (
                    <p className="chat-question">{line.answer.clarification.question_th}</p>
                  )}
                  {line?.answer.outcome === "ignore" && <p className="chat-question">{copy.notPicking.th}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="chat-sender">
            <label htmlFor="chat-sender">{c.sender.th}</label>
            <select id="chat-sender" value={sender} disabled={locked} onChange={(e) => setSender(e.target.value)}>
              <option value="">{copy.desk.th}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name_th}
                </option>
              ))}
            </select>
          </div>
          <label htmlFor="chat-message">
            {c.add.th} <small lang="en">{c.add.en}</small>
          </label>
          <textarea
            id="chat-message"
            ref={input}
            className="message-editor"
            maxLength={500}
            rows={3}
            disabled={locked}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-describedby="chat-privacy"
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
          />
          {scenario === "hero" && (
            <div className="sample-chips">
              {heroFollowups.map((sample) => (
                <button
                  key={sample.type}
                  type="button"
                  data-chat-sample={sample.type}
                  disabled={locked}
                  onClick={() => {
                    setSender(sample.sender);
                    setMessage(sample.text);
                    input.current?.focus();
                  }}
                >
                  {sampleNames[sample.type].th}
                </button>
              ))}
            </div>
          )}
          <p id="chat-privacy" className="privacy-note">
            {copy.privacy.th}
          </p>
          {error && (
            <p role="alert" className="chat-question">
              {error}
            </p>
          )}
          <button
            id="chat-read"
            type="submit"
            className="primary-action"
            disabled={locked || !message.trim()}
            aria-busy={pending}
          >
            <Send aria-hidden size={16} /> {pending ? c.reading.th : c.read.th}
            <small lang="en">{pending ? c.reading.en : c.read.en}</small>
          </button>
        </form>
      </div>
    </section>
  );
}
