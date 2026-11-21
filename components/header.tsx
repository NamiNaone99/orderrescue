"use client";

import Link from "next/link";
import { useState } from "react";
import { Boxes, ChevronDown, Clock3, Code2, Database, FlaskConical, Layers3, LayoutDashboard } from "lucide-react";
import { copy } from "@/lib/copy";
import { formatBangkokTime } from "@/lib/domain/time";
import { ModeBadges } from "./mode-badges";
import { ResetControl } from "./reset-control";
import type { ShellScenario } from "./scenario-shell";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const nav = [
  { path: "/", label: copy.desk, Icon: LayoutDashboard },
  { path: "/data", label: copy.data, Icon: Database },
  { path: "/built-with-codex", label: copy.built, Icon: Code2 },
];

export function DataBadge({ scenario }: { scenario: ShellScenario }) {
  const label = scenario.kind === "synthetic" ? copy.synthetic : copy.realDerived;
  const Icon = scenario.kind === "synthetic" ? FlaskConical : Layers3;
  return <Link className="data-badge" href={"/data?scenario=" + scenario.id}>
    <Icon size={15} aria-hidden /><span>{label.th} <span lang="en">{label.en}</span></span>
  </Link>;
}

type HeaderProps = {
  scenarios: ShellScenario[]; scenario: ShellScenario; pathname: string;
  href: (path: string) => string;
  onSelect: (id: ShellScenario["id"]) => void; onReset: () => void;
};

export function Header({ scenarios, scenario, pathname, href, onSelect, onReset }: HeaderProps) {
  const [clockOpen, setClockOpen] = useState(false);
  return <header>
    <div className="masthead"><div className="shell-width masthead-inner">
      <Link className="wordmark" href={href("/")} aria-label="OrderRescue">
        <span className="brand-icon"><Boxes size={25} strokeWidth={1.8} aria-hidden /></span>
        <span lang="en">Order<span>Rescue</span></span>
      </Link>
      <nav className="main-nav" aria-label={copy.nav.th}>{nav.map(({ path, label, Icon }) => (
        <Link key={path} href={href(path)} aria-current={pathname === path ? "page" : undefined}>
          <Icon size={17} aria-hidden />{label.th}
        </Link>
      ))}</nav>
    </div></div>
    <div className="toolbar"><div className="shell-width toolbar-inner">
      <div className="scenario-tools">
        <label className="scenario-label" htmlFor="scenario-choice">{copy.scenario.th}</label>
        <div className="scenario-choice"><select id="scenario-choice" value={scenario.id}
          onChange={event => {
            const selected = scenarios.find(item => item.id === event.target.value);
            if (selected) onSelect(selected.id);
          }}>
          {scenarios.map(item => <option key={item.id} value={item.id}>{item.name_th}</option>)}
        </select><ChevronDown size={14} aria-hidden /></div>
        <Tooltip open={clockOpen} onOpenChange={setClockOpen}><TooltipTrigger className="clock" closeOnClick={false} aria-describedby={clockOpen ? "scenario-clock-hint" : undefined} onClick={() => setClockOpen(true)} aria-label={copy.scenarioTime.th + " " + formatBangkokTime(scenario.now_at) + " / " + copy.scenarioTime.en}>
          <Clock3 size={16} aria-hidden /><span>{copy.scenarioTime.th} <b>{formatBangkokTime(scenario.now_at)}</b></span>
        </TooltipTrigger><TooltipContent role="tooltip" id="scenario-clock-hint" className="text-sm">{copy.scenarioHint.th}</TooltipContent></Tooltip>
      </div>
      <div className="system-tools"><ModeBadges /><ResetControl key={scenario.id} scenario={scenario} onReset={onReset} /></div>
    </div></div>
  </header>;
}
