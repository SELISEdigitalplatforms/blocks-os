import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import { Badge } from "@/components/ui-kits/badge/badge";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Separator } from "@/components/ui-kits/separator/separator";
import { formatDate, parseDateString } from "@/lib/utils";
import { formatDurationMs } from "@blocks-lmt/utils";
import { getTraceStatus, getTypeColor } from "@blocks-lmt/models/trace.model";
import { useContext } from "react";
import AnnotationBar from "../annotation-bar/annotation-bar";
import { timelineContext } from "../trace-details";
/** Label above a value, so every field in the panel keeps the same vertical rhythm. */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <h3 className="text-xs font-medium uppercase tracking-wide text-low-emphasis">{label}</h3>
    <div className="break-all text-sm font-normal text-high-emphasis">{children}</div>
  </div>
);

/** Identifiers are compared character by character, so they get a monospace face and a copy
 *  affordance rather than being read as prose. */
const IdField = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <Field label={label}>
      <CopyToClipboardButton textToCopy={value} label={`Copy ${label.toLowerCase()}`} isHoverable>
        <span className="text-xs">{value}</span>
      </CopyToClipboardButton>
    </Field>
  ) : (
    <Field label={label}>
      <span className="text-low-emphasis">None</span>
    </Field>
  );

export const TracingInfo = () => {
  const { selectedTrace: trace } = useContext(timelineContext);
  if (!trace) return null;
  const status = getTraceStatus(trace);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge variant={status.variant} className="py-0 tabular-nums">
          {status.label}
        </Badge>
        <span className="text-sm tabular-nums text-medium-emphasis">
          {formatDurationMs(trace.duration)}
        </span>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-2 break-all text-lg font-normal text-high-emphasis md:text-xl">
        <span className={`font-semibold uppercase ${getTypeColor(trace?.entryPoint?.method)}`}>
          {trace?.entryPoint?.method}
        </span>
        <span className="text-base md:text-lg">{trace?.entryPoint?.actionName}</span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="Kind">{trace?.kind}</Field>
        <Field label="Service">{trace?.serviceName}</Field>
        <IdField label="Span ID" value={trace?.spanId} />
        <IdField label="Parent ID" value={trace?.parentId} />
        <div className="col-span-2">
          <Field label="Span name">
            <span className="text-xs">{trace?.entryPoint?.actionName}</span>
          </Field>
        </div>
      </div>
      <Separator className="my-5" />
      <Accordion type="multiple">
        <AccordionItem value="annotation" className="last:border-none">
          <AccordionTrigger className="font-medium hover:no-underline">Annotation</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col py-[12px]">
              <div className="mb-[12px]">
                <AnnotationBar annotationDuration={trace?.duration} />
              </div>
              <div className="mb-[12px] grid grid-cols-2 gap-2">
                <div className="flex items-center">0ms</div>
                <div className="flex flex-col">
                  <div className="mb-[8px]">
                    <h3 className="text-sm font-medium text-low-emphasis">Start time</h3>
                    <p className="text-base font-normal text-high-emphasis">
                      {formatDate(parseDateString(trace?.startTime?.toString()))}
                    </p>
                  </div>
                  <div className="mb-[8px]">
                    <h3 className="text-sm font-medium text-low-emphasis">Value</h3>
                    <p className="text-base font-normal text-high-emphasis">Server Start</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-low-emphasis">Address</h3>
                    <p className="text-base font-normal text-high-emphasis">
                      {trace?.entryPoint?.method}
                    </p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="mt-[12px] grid grid-cols-2 gap-2">
                <div className="flex items-center tabular-nums">{formatDurationMs(trace.duration)}</div>
                <div className="flex flex-col">
                  <div className="mb-[8px]">
                    <h3 className="text-sm font-medium text-low-emphasis">Start time</h3>
                    <p className="text-base font-normal text-high-emphasis">
                      {formatDate(parseDateString(trace?.endTime?.toString()))}
                    </p>
                  </div>
                  <div className="mb-[8px]">
                    <h3 className="text-sm font-medium text-low-emphasis">Value</h3>
                    <p className="text-base font-normal text-high-emphasis">Server Finish</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-low-emphasis">Address</h3>
                    <p className="text-base font-normal text-high-emphasis">
                      {trace?.entryPoint?.method}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        {Object.keys(trace.attributes).length > 0 && (
          <AccordionItem value="attributes" className="last:border-none">
            <AccordionTrigger className="font-medium hover:no-underline">
              Attributes
            </AccordionTrigger>
            <AccordionContent className="flex flex-col">
              <div className="flex flex-col gap-3">
                {Object.keys(trace.attributes)
                  .filter((item) => item.toLowerCase() !== "dbname")
                  .map((item) => (
                    <div key={item} className="flex flex-col gap-1">
                      <h3 className="text-xs font-medium capitalize tracking-wide text-low-emphasis">
                        {item.split(".").join(" ")}
                      </h3>
                      {/* Attribute values include serialised headers and security context, which
                          run to hundreds of characters. They wrap and scroll inside their own box
                          instead of stretching the panel. */}
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/40 px-2 py-1.5 font-sans text-xs text-high-emphasis">
                        {String(trace?.attributes[item] ?? "-")}
                      </pre>
                    </div>
                  ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </>
  );
};
