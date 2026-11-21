// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { publicState } from "@/lib/api/state";
import { api } from "@/lib/client/api";
import { useDesk } from "@/lib/client/use-desk";
import { realDay } from "@/lib/scenarios/realDay";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("polls the displayed receipt SKU once at a time, only while visible, and preserves the original lines", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const seed = publicState({ ...realDay.snapshot, state_version: "initial" });
  const order = seed.orders[0];
  const lines = order.lines.slice(0, 2).map(line => {
    const stock = seed.stock.find(row => row.sku_id === line.sku_id && row.warehouse_id === order.home_warehouse_id)!;
    return { ...line, order_id: order.id, warehouse_id: stock.warehouse_id, expected_revision: stock.revision, unit_cost_thb: stock.extra_cost_per_unit_thb };
  });
  const receipt = { id: crypto.randomUUID(), created_at: seed.scenario.now_at, lines,
    total_extra_cost_thb: lines.reduce((total, line) => total + line.qty * line.unit_cost_thb, 0) };
  expect(lines[0].sku_id).not.toBe(seed.scenario.default_sku_id);
  expect(lines[1].sku_id).not.toBe(lines[0].sku_id);
  const read = vi.spyOn(api, "state").mockResolvedValueOnce({ ...seed, reservations: [receipt] });
  const { result, rerender, unmount } = renderHook(({ id }: { id: string | null }) =>
    useDesk("real-day", seed.scenario, id), { initialProps: { id: null } as { id: string | null } });
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(read).toHaveBeenCalledTimes(1);

  read.mockImplementationOnce(() => new Promise(() => {}));
  rerender({ id: receipt.id });
  expect(read).toHaveBeenLastCalledWith({ scenario: "real-day", sku: lines[0].sku_id }, expect.any(AbortSignal));
  const pending = read.mock.lastCall?.[1];
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(read).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue(true);
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(pending?.aborted).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(read).toHaveBeenCalledTimes(2);

  // Later inventory may omit historical reservations entirely.
  read.mockResolvedValue({ ...seed, state_version: "latest", reservations: [] });
  visibility.mockReturnValue(false);
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(read).toHaveBeenCalledTimes(3);
  expect(result.current.s.stock?.state_version).toBe("latest");
  expect(result.current.restored).toEqual(receipt);
  expect(result.current.s.stale).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(read).toHaveBeenCalledTimes(4);
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(read).toHaveBeenCalledTimes(4);
});
