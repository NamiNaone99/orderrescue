"use client";

import { useState, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import { copy, bilingual } from "@/lib/copy";
import { demoResetResponseSchema, errorResponseSchema } from "@/lib/domain/contracts";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { ShellScenario } from "./scenario-shell";

export function ResetControl({ scenario, onReset }: { scenario: ShellScenario; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) setToken("");
    setNotice("");
  }
  async function reset() {
    if (pending) return;
    setPending(true);
    setNotice("");
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (scenario.id !== "hero") headers["x-demo-token"] = token;
      const response = await fetch("/api/demo/reset", {
        method: "POST", headers, body: JSON.stringify({ scenario: scenario.id }), signal: AbortSignal.timeout(10_000),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !demoResetResponseSchema.safeParse(data).success) {
        const result = errorResponseSchema.safeParse(data);
        const label = response.status === 401 ? copy.unauthorized : response.status === 429 ? copy.limited : copy.resetFailed;
        setNotice(label.th + (result.success ? " · " + copy.requestId.th + " " + result.data.error.request_id : ""));
        return;
      }
      changeOpen(false);
      setNotice(copy.resetDone.th);
      onReset();
    } catch {
      setNotice(copy.resetFailed.th);
    } finally {
      setPending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void reset();
  }
  return <div className="reset-control">
    <button type="button" className="toolbar-button" disabled={pending} aria-busy={pending}
      onClick={() => scenario.id === "hero" ? void reset() : changeOpen(true)}>
      <RotateCcw size={16} aria-hidden />{pending ? copy.resetting.th : copy.reset.th}
    </button>
    <span role="status" className="reset-notice">{open ? "" : notice}</span>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader><DialogTitle>{copy.reset.th}</DialogTitle>
          <DialogDescription>{copy.tokenHint.th}<br /><span lang="en">{copy.tokenHint.en}</span></DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="reset-form">
          <Label htmlFor="reset-token">{bilingual(copy.resetToken)}</Label>
          <Input id="reset-token" type="password" value={token} autoComplete="off" required onChange={e => setToken(e.target.value)} />
          <span role="status">{notice}</span>
          <div className="dialog-actions">
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>{copy.cancel.th}</Button>
            <Button type="submit" disabled={pending || !token}>{copy.reset.th}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
