import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.built.th };
export default function BuiltPage() {
  return <StatusPage label={copy.built} detail={copy.builtPlaceholder} />;
}
