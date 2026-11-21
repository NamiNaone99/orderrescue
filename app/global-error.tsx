"use client";

import { StatusPage } from "@/components/status-page";
import { copy } from "@/lib/copy";
import "./fonts/plex";
import "./globals.css";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return <html lang="th"><head><title>{copy.error.th + " · OrderRescue"}</title></head><body><main><StatusPage label={copy.error} error={error} retry={retry} /></main></body></html>;
}
