import type { Metadata } from "next";
import { sarabun } from "./fonts/sarabun";
import { copy } from "@/lib/copy";
import { scenarioRegistry } from "@/lib/scenarios";
import { ScenarioShell } from "@/components/scenario-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import "./desk.css";
import "./desk-states.css";
import "./polish.css";

const title = "OrderRescue · " + copy.desk.th;
export const metadata: Metadata = {
  title: { template: "OrderRescue · %s", default: title },
  description: copy.tagline.th,
  openGraph: { title, description: copy.tagline.th },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const scenarios = Object.values(scenarioRegistry).map(entry => entry.snapshot.scenario)
    .filter(scenario => !scenario.id.endsWith("-test"))
    .map(({ id, name_th, name_en, kind, now_at, default_sku_id, sample_messages, default_budget_thb, demo_events }) => ({
      id, name_th, name_en, kind, now_at, default_sku_id, sample_messages, default_budget_thb, demo_events,
    }));
  return <html lang="th" className={sarabun.variable}>
    <body><a className="skip-link" href="#desk-main">{copy.skip.th}</a>
      <TooltipProvider><ScenarioShell scenarios={scenarios}>{children}</ScenarioShell></TooltipProvider>
      <footer><div className="shell-width footer-inner">
        <div><b lang="en">OrderRescue</b><span>{copy.footerNote.th} <span lang="en">{copy.footerNote.en}</span></span></div>
        <p lang="en">Chen, D. (2012). Online Retail II. UCI Machine Learning Repository. CC BY 4.0.</p>
      </div></footer>
    </body>
  </html>;
}
