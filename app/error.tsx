"use client";

import { StatusPage } from "@/components/status-page";
import { copy } from "@/lib/copy";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <StatusPage label={copy.error} error={error} retry={retry} />;
}
