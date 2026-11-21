import { StatusPage } from "@/components/status-page";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return <StatusPage label={copy.notFound} />;
}
