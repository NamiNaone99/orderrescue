// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResetControl } from "@/components/reset-control";
import { copy } from "@/lib/copy";
import { heroSnapshot } from "@/lib/scenarios/hero";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("requests a token before resetting a non-hero scenario and sends it in the header", async () => {
  const fetchReset = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchReset);
  const onReset = vi.fn();
  render(<ResetControl scenario={{ ...heroSnapshot.scenario, id: "real-day" }} onReset={onReset} />);
  fireEvent.click(screen.getByRole("button", { name: copy.reset.th }));
  const dialog = await screen.findByRole("dialog");
  expect(fetchReset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(new RegExp(copy.resetToken.th)), { target: { value: "local-test-token" } });
  const submit = dialog.querySelector("form");
  if (!submit) throw new Error("Missing reset form");
  fireEvent.submit(submit);
  await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
  expect(fetchReset).toHaveBeenCalledWith("/api/demo/reset", expect.objectContaining({
    method: "POST", headers: { "content-type": "application/json", "x-demo-token": "local-test-token" },
    body: JSON.stringify({ scenario: "real-day" }),
  }));
});
