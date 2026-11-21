import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import BuiltPage from "@/app/built-with-codex/page";
import { buildCopy, copy } from "@/lib/copy";
import { correctionsHeading, parseBuildEvidence, readTimeline, summarize } from "@/lib/codex-log";

const columns = "| Time | Task | Who | Surface | Model | Prompt | Outcome | Minutes | Tokens | Tests | Human corrections | Chat id |";
const separator = "|" + " --- |".repeat(12);
function row(time: string, task: string, outcome: string) {
  return `| ${time} | ${task} | author | local | model | summary | ${outcome} | | | | | |`;
}

it("orders the task table by time, preserves escaped pipes and deduplicates source counts", () => {
  const pr = "[PR #1](https://github.com/NamiNaone99/orderrescue/pull/1)";
  const fix = "[Closed F1](codex-log/T22-F1.md)";
  const markdown = [columns, separator, row("11:00", "T22", fix + " " + fix), row("10:20", "T03", pr),
    row("10:25", "Contributor document", pr + " a \\| b"),
    row("11:30", "T14", "[Closed F6](codex-log/T14.md) and [F8 still open](codex-log/T22-review.md)"),
    "", "| Feature | Used |", "| -- | -- |"].join("\n");
  const rows = readTimeline(markdown);
  expect(rows.map(item => item.task)).toEqual(["T03", "Contributor document", "T22", "T14"]);
  expect(rows[1].outcome).toContain("a | b");
  expect(summarize(rows)).toEqual({ tasks: 3, pulls: 1, fixes: 2 });
});

it("renders the page with no ledger or prompts and omits unavailable counts", () => {
  const root = join(process.cwd(), "tests/fixtures/empty-t19-repository");
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
  try {
    const page = renderToStaticMarkup(<BuiltPage />);
    expect(page).toContain(copy.built.th);
    expect(page).toContain(buildCopy.noRows.en);
    expect(page).toContain(buildCopy.noCorrections.en);
    expect(page).not.toContain(buildCopy.numbered.en);
    expect(page).not.toContain(buildCopy.example.en);
  } finally { cwd.mockRestore(); }
});

it("reads the literal T03 prompt and only bullet entries inside the human corrections section", () => {
  const ledger = ["# Ledger", "- Outside", "## " + correctionsHeading, "Team, add a bullet here.",
    "- A reviewer's note.", "  Its evidence.", "## Other notes", "- Elsewhere"].join("\n");
  const literal = "Goal: verbatim\n\nKeep `inline code` and | punctuation.";
  const tasks = ["## T03 Planner", "Metadata", "```", literal, "```", "## T04 Store", "```", "Another goal", "```"].join("\r\n");
  expect(parseBuildEvidence(ledger, tasks)).toMatchObject({ prompt: literal, corrections: ["A reviewer's note. Its evidence."] });
});
