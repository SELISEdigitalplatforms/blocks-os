import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  GUIDE_SECTIONS,
  GUIDE_TEXT,
  IOS_FAILURES,
  type IGuideSection,
} from "../constants/push-guide.constant";

function Section({ section }: Readonly<{ section: IGuideSection }>) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby={`guide-${section.id}`}>
      {section.group && (
        <span className="text-xs font-semibold uppercase text-medium-emphasis">
          {section.group}
        </span>
      )}
      <h3 id={`guide-${section.id}`} className="text-sm font-semibold">
        {section.heading}
      </h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        {section.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </section>
  );
}

interface PushGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

/** "How to find these?": where each Firebase value comes from, and what an iOS test failure means. */
export function PushGuideDialog({ open, onClose }: Readonly<PushGuideDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[720px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{GUIDE_TEXT.title}</DialogTitle>
          <DialogDescription>{GUIDE_TEXT.intro}</DialogDescription>
        </DialogHeader>
        {GUIDE_SECTIONS.map((section) => (
          <Section key={section.id} section={section} />
        ))}
        <section className="flex flex-col gap-2" aria-labelledby="guide-ios-failed">
          <h3 id="guide-ios-failed" className="text-sm font-semibold">
            {GUIDE_TEXT.failHeading}
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            {IOS_FAILURES.map((failure) => (
              <div
                key={failure.title}
                className="grid grid-cols-1 gap-1 sm:grid-cols-[190px_minmax(0,1fr)]"
              >
                <dt className="font-medium">{failure.title}</dt>
                <dd className="text-medium-emphasis">{failure.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </DialogContent>
    </Dialog>
  );
}
