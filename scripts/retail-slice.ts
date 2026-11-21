import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import { z } from "zod";

export const sliceDate = "2011-11-22";
export const demoDate = "2026-11-21";
const columns = ["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "Customer ID", "Country"];
const retailRow = z.object({
  Invoice: z.string().min(1), StockCode: z.string(), Description: z.string().trim(),
  Quantity: z.coerce.number().int(), InvoiceDate: z.string().regex(/^\d{4}-\d\d-\d\d \d\d:\d\d:00$/),
  Price: z.coerce.number(), "Customer ID": z.string().trim(), Country: z.string().min(1),
});

export function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function readSlice(path: string) {
  const source = createReadStream(path);
  const hash = createHash("sha256");
  source.on("data", chunk => hash.update(chunk));
  const rows: z.infer<typeof retailRow>[] = [];
  let rawCount = 0;
  const parser = parse({
    bom: true,
    columns(header: string[]) {
      if (header.length !== columns.length || !columns.every(name => header.includes(name))) {
        throw new Error("Unexpected UCI mirror CSV columns");
      }
      return header;
    },
    skip_empty_lines: true,
  });

  await pipeline(source, parser, async records => {
    for await (const record of records) {
      if (!record.InvoiceDate.startsWith(sliceDate + " ")) continue;
      rawCount++;
      const row = retailRow.parse(record);
      if (row.Invoice.startsWith("C") || row.Quantity <= 0 || row.Price <= 0 || !row["Customer ID"]
        || !/^\d{5}[A-Za-z]{0,2}$/.test(row.StockCode)) continue;
      rows.push(row);
    }
  });
  if (!rows.length) throw new Error("No usable rows for the selected date");

  rows.sort((a, b) => compare(a.InvoiceDate, b.InvoiceDate) || compare(a.Invoice, b.Invoice) || compare(a.StockCode, b.StockCode));
  const names = new Map<string, Map<string, number>>();
  const refs = new Map<string, string>();
  type Line = { sku_id: string; qty: number; unit_price_gbp: number };
  type Invoice = { id: string; time: string; country: string; customer_ref: string; lines: Map<string, Line> };
  const invoices = new Map<string, Invoice>();
  for (const row of rows) {
    const customer = row["Customer ID"];
    const ref = refs.get(customer) ?? "C" + String(refs.size + 1).padStart(3, "0");
    refs.set(customer, ref);
    const time = row.InvoiceDate.slice(11, 16);
    const invoice = invoices.get(row.Invoice) ?? { id: row.Invoice, time, country: row.Country, customer_ref: ref, lines: new Map<string, Line>() };
    if (invoice.country !== row.Country || invoice.time !== time || invoice.customer_ref !== ref) {
      throw new Error("Conflicting invoice metadata in source");
    }
    const line = invoice.lines.get(row.StockCode) ?? { sku_id: row.StockCode, qty: 0, unit_price_gbp: row.Price };
    if (line.unit_price_gbp !== row.Price) throw new Error("Conflicting GBP prices on a merged line");
    line.qty += row.Quantity;
    invoice.lines.set(row.StockCode, line);
    invoices.set(invoice.id, invoice);
    const frequencies = names.get(row.StockCode) ?? new Map<string, number>();
    frequencies.set(row.Description, (frequencies.get(row.Description) ?? 0) + 1);
    names.set(row.StockCode, frequencies);
  }
  const skus = [...names].sort(([a], [b]) => compare(a, b)).map(([id, counts]) => ({
    id, name: [...counts].sort(([a, x], [b, y]) => y - x || compare(a, b))[0][0],
  }));
  const orders = [...invoices.values()].sort((a, b) => compare(a.id, b.id)).map(invoice => ({
    ...invoice, lines: [...invoice.lines.values()].sort((a, b) => compare(a.sku_id, b.sku_id)),
  }));
  return {
    skus, orders, sourceHash: hash.digest("hex"),
    counts: { raw_rows_on_date: rawCount, filtered_rows: rows.length, orders: orders.length,
      lines: orders.reduce((n, o) => n + o.lines.length, 0), skus: skus.length },
  };
}

export type RetailSlice = Awaited<ReturnType<typeof readSlice>>;
