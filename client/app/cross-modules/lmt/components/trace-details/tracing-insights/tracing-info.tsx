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
import { useT } from "@seliseblocks/genesis-os";
/**
 * Label above a value, so every field in the panel keeps the same vertical rhythm. The panel
 * runs on two sizes and only two: 14px names the thing, 12px carries the data. Field is the
 * single place that pairing is stated, so no row can drift off it.
 */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <h3 className="text-sm font-medium uppercase tracking-wide text-low-emphasis">{label}</h3>
    <div className="break-all text-[12px] font-normal text-high-emphasis">{children}</div>
  </div>
);

/** Identifiers are compared character by character, so they get a monospace face and a copy
 *  affordance rather than being read as prose. */
const IdField = ({ label, value }: { label: string; value?: string }) => {
  const { t } = useT("os.lmt");
  return value ? (
    <Field label={label}>
      <CopyToClipboardButton
        textToCopy={value}
        label={t("TRACING_INFO.COPY", { value1: label.toLowerCase() })}
        isHoverable
      >
        <span>{value}</span>
      </CopyToClipboardButton>
    </Field>
  ) : (
    <Field label={label}>
      <span className="text-low-emphasis">{t("TRACING_INFO.NONE")}</span>
    </Field>
  );
};

export const TracingInfo = () => {
  const { t } = useT("os.lmt");
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
      {/* A side-panel heading, so emphasis comes from weight and the method's colour rather
          than from size: at the previous text-lg/xl it outsized the page title next to it,
          and a long path then broke across three lines. */}
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 break-all text-sm text-high-emphasis">
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${getTypeColor(trace?.entryPoint?.method)}`}
        >
          {trace?.entryPoint?.method}
        </span>
        <span className="font-semibold">{trace?.entryPoint?.actionName}</span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label={t("TRACING_INFO.KIND")}>{trace?.kind}</Field>
        <Field label={t("TRACING_INFO.SERVICE")}>{trace?.serviceName}</Field>
        <IdField label={t("TRACING_INFO.SPAN_ID")} value={trace?.spanId} />
        <IdField label={t("TRACING_INFO.PARENT_ID")} value={trace?.parentId} />
        <div className="col-span-2">
          <Field label={t("TRACING_INFO.SPAN_NAME")}>{trace?.entryPoint?.actionName}</Field>
        </div>
      </div>
      <Separator className="my-5" />
      <Accordion type="multiple">
        <AccordionItem value="annotation" className="last:border-none">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            {t("TRACING_INFO.ANNOTATION")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col py-[12px]">
              <div className="mb-[12px]">
                <AnnotationBar annotationDuration={trace?.duration} />
              </div>
              {/* Plain Field: the 14px/12px pairing it already applies is exactly what these
                  rows want, so they need no sizing of their own. */}
              <div className="mb-[12px] grid grid-cols-2 gap-2">
                <div className="flex items-center text-[12px] tabular-nums text-medium-emphasis">
                  {t("TRACING_INFO.N_0_MS")}
                </div>
                <div className="flex flex-col gap-2">
                  <Field label={t("TRACING_INFO.START_TIME")}>
                    {formatDate(parseDateString(trace?.startTime?.toString()))}
                  </Field>
                  <Field label={t("TRACING_INFO.VALUE")}>{t("TRACING_INFO.SERVER_START")}</Field>
                  <Field label={t("TRACING_INFO.ADDRESS")}>{trace?.entryPoint?.method}</Field>
                </div>
              </div>
              <Separator />
              <div className="mt-[12px] grid grid-cols-2 gap-2">
                <div className="flex items-center text-[12px] tabular-nums text-medium-emphasis">
                  {formatDurationMs(trace.duration)}
                </div>
                <div className="flex flex-col gap-2">
                  <Field label={t("TRACING_INFO.END_TIME")}>
                    {formatDate(parseDateString(trace?.endTime?.toString()))}
                  </Field>
                  <Field label={t("TRACING_INFO.VALUE")}>{t("TRACING_INFO.SERVER_FINISH")}</Field>
                  <Field label={t("TRACING_INFO.ADDRESS")}>{trace?.entryPoint?.method}</Field>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        {Object.keys(trace.attributes).length > 0 && (
          <AccordionItem value="attributes" className="last:border-none">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              {t("TRACING_INFO.ATTRIBUTES")}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col">
              <div className="flex flex-col gap-3">
                {Object.keys(trace.attributes)
                  .filter((item) => item.toLowerCase() !== "dbname")
                  .map((item) => (
                    <div key={item} className="flex flex-col gap-1">
                      <h3 className="text-sm font-medium capitalize tracking-wide text-low-emphasis">
                        {item.split(".").join(" ")}
                      </h3>
                      {/* Attribute values include serialised headers and security context, which
                          run to hundreds of characters. They wrap and scroll inside their own box
                          instead of stretching the panel. */}
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/40 px-2 py-1.5 font-sans text-[12px] text-high-emphasis">
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
