import { useRef } from "react";
import { BookOpen, Clock3, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { polishCopy } from "@/lib/copy";

export function DemoGuide() {
  const title = useRef<HTMLHeadingElement>(null);
  return <Dialog>
    <DialogTrigger className="outline-action guide-trigger"><BookOpen aria-hidden />{polishCopy.guide.th}</DialogTrigger>
    <DialogContent showCloseButton={false} className="guide-popup" initialFocus={title}>
      <DialogHeader>
        <div className="guide-heading"><BookOpen aria-hidden /><div><DialogTitle ref={title} tabIndex={-1}>{polishCopy.guide.th}</DialogTitle><span lang="en">{polishCopy.guide.en}</span></div>
          <DialogClose aria-label={polishCopy.closeGuide.th} className="guide-dismiss"><X aria-hidden /></DialogClose></div>
        <DialogDescription>{polishCopy.guideIntro.th}</DialogDescription>
      </DialogHeader>
      <div className="guide-body" tabIndex={0} role="region" aria-label={polishCopy.guide.th}>
        <ol className="guide-steps">{polishCopy.guideSteps.map(step => <li key={step.title.en}><div><h3>{step.title.th}</h3><p>{step.body.th}</p></div></li>)}</ol>
        <aside className="guide-change"><Clock3 aria-hidden /><div><h3>{polishCopy.guideChange.th}</h3><p>{polishCopy.guideChangeBody.th}</p></div></aside>
      </div>
    </DialogContent>
  </Dialog>;
}
