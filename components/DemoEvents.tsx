import { Check, TimerReset } from "lucide-react";
import { copy } from "@/lib/copy";
import type { StateResponse } from "@/lib/domain/contracts";

export function DemoEvents({ events, disabled, apply }: {
  events: StateResponse["scenario"]["demo_events"]; disabled: boolean; apply: (id: string) => void;
}) {
  if (!events.length) return null;
  return <section className="demo-events" aria-labelledby="demo-events-heading">
    <h3 id="demo-events-heading"><TimerReset aria-hidden />{copy.demoEvents.th}</h3>
    {events.map(event => <button type="button" className="outline-action" key={event.id} data-event-id={event.id} disabled={disabled || event.applied}
      onClick={() => apply(event.id)}>{event.applied && <Check aria-hidden />}<span>{event.label_th}{event.applied && <small> · {copy.eventApplied.th}</small>}</span></button>)}
  </section>;
}
