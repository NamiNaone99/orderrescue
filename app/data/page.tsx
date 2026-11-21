import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.data.th };
export default function DataPage() {
  return <StatusPage label={copy.data} detail={copy.dataPlaceholder} />;
}
