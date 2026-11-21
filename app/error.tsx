"use client";

import { StatusPage } from "@/components/status-page";
import { copy } from "@/lib/copy";

export default function ErrorPage({ error }: { error: unknown }) {
  return <StatusPage label={copy.error} error={error} />;
}
