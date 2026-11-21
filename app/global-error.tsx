"use client";

import { StatusPage } from "@/components/status-page";
import { copy } from "@/lib/copy";
import "./globals.css";

export default function GlobalError({ error }: { error: unknown }) {
  return <html lang="th"><body><main><StatusPage label={copy.error} error={error} /></main></body></html>;
}
