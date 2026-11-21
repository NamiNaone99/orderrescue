import type { InterpretResponse } from "@/lib/domain/contracts";
import { bangkokTimestamp } from "@/lib/domain/time";
import type { EvalRow } from "./eval-data";

type RowInfo = Pick<EvalRow, "id" | "split" | "scenario" | "category" | "expected">;
export type Skipped = RowInfo & { status: "skipped"; reason: string };
export type Scored = RowInfo & {
  status: "scored"; actual: InterpretResponse; checks: ReturnType<typeof checkAnswer>; passed: boolean;
};
export type RunRow = Skipped | Scored;
const fields = ["kind", "warehouse", "skus", "window", "evidence", "incident_fields", "clarify_about"] as const;

export function checkAnswer(row: EvalRow, actual: InterpretResponse, date: string) {
  const { expected } = row;
  const incident = expected.kind === "incident";
  const answer = actual.incident;
  const expectedSkus = new Set(expected.skus);
  const actualSkus = new Set(answer?.sku_ids);
  const warehouse = incident ? answer?.warehouse_id === expected.warehouse : null;
  const skus = incident ? !!answer && actualSkus.size === expectedSkus.size && [...expectedSkus].every(sku => actualSkus.has(sku)) : null;
  const window = incident ? !!answer && !!expected.start && !!expected.end
    && Date.parse(answer.window_start) === Date.parse(bangkokTimestamp(date, expected.start))
    && Date.parse(answer.window_end) === Date.parse(bangkokTimestamp(date, expected.end)) : null;
  const evidence = incident ? !!answer?.evidence_quote && row.text.includes(answer.evidence_quote) : null;
  return {
    kind: actual.outcome === expected.kind, warehouse, skus, window, evidence,
    incident_fields: incident ? !!(warehouse && skus && window && evidence) : null,
    clarify_about: expected.kind === "clarification" ? !!actual.clarification && actual.clarification.about === expected.clarify_about : null,
    false_incident: !incident && actual.outcome === "incident",
  };
}

export function score(row: EvalRow, actual: InterpretResponse, date: string): Scored {
  const { id, split, scenario, category, expected } = row;
  const checks = checkAnswer(row, actual, date);
  return { id, split, scenario, category, expected, status: "scored", actual, checks, passed: fields.every(field => checks[field] !== false) };
}

export function summarize(rows: RunRow[]) {
  const scored = rows.filter((row): row is Scored => row.status === "scored");
  const times = scored.map(row => row.actual.interpreter.latency_ms).sort((a, b) => a - b);
  const nearestRank = (fraction: number) => times[Math.ceil(times.length * fraction) - 1] ?? null;
  const answered: Record<string, number> = {};
  for (const { actual } of scored) {
    const name = actual.interpreter.used;
    answered[name] = (answered[name] ?? 0) + 1;
  }
  function count(field: typeof fields[number]) {
    const applicable = scored.filter(row => row.checks[field] !== null);
    return { correct: applicable.filter(row => row.checks[field]).length, total: applicable.length };
  }
  return {
    selected: rows.length, scored: scored.length, skipped: rows.length - scored.length,
    kind: count("kind"), warehouse: count("warehouse"), skus: count("skus"), window: count("window"),
    evidence: count("evidence"), incident_fields: count("incident_fields"), clarify_about: count("clarify_about"),
    false_incidents: scored.filter(row => row.checks.false_incident).length,
    latency_ms: { p50: nearestRank(0.5), p95: nearestRank(0.95) }, answered,
  };
}

export function meetsThresholds(counts: ReturnType<typeof summarize>) {
  return counts.false_incidents === 0
    && counts.kind.correct * 100 >= counts.kind.total * 90
    && counts.incident_fields.correct * 100 >= counts.incident_fields.total * 80;
}
