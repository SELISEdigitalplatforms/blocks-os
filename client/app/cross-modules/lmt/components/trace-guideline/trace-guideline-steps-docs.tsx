import { ReactNode } from "react";
import type { TFunction } from "@seliseblocks/genesis-os";
import { TRACE_PROVIDERS } from "../../constants/trace.constant";
export type Step = {
  id: string;
  description: ReactNode;
};
export const getTraceGuideSteps = (t: TFunction): Record<TRACE_PROVIDERS, Step[]> => ({
  hot: [
    {
      id: "0",
      description: (
        <div>
          <h4 className="text-lg text-high-emphasis">
            {t("TRACE_GUIDELINE_STEPS_DOCS.HOT_TIER_REAL_TIME")}
          </h4>
          <p>{t("TRACE_GUIDELINE_STEPS_DOCS.HOT_TRACES_ARE_STORED_IN")}</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.OPTIMIZED_FOR_WRITE_THROUGHPUT")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.RETENTION_TARGET_FIRST_60_DAYS")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.AUTOMATIC_ROLL_OFF_BEGINS_AFTER")}</li>
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("TRACE_GUIDELINE_STEPS_DOCS.YOU_CAN_BROWSE_FILTER_THESE")}
          </p>
        </div>
      ),
    },
    {
      id: "1",
      description: (
        <div>
          <h4 className="text-lg text-high-emphasis">
            {t("TRACE_GUIDELINE_STEPS_DOCS.WHAT_HAPPENS_AFTER_60_DAYS")}
          </h4>
          <p className="text-sm">
            {t("TRACE_GUIDELINE_STEPS_DOCS.A_BACKGROUND_PROCESS_BATCHES_OLDER")}
          </p>
          <ul className="mt-2 list-inside list-disc text-sm">
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.EXPORT_CADENCE_EVERY_6_HOURS")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.COMPRESSION_SNAPPY_PARQUET_IN")}</li>
            <li>
              {t("TRACE_GUIDELINE_STEPS_DOCS.PARTITIONING_YEAR_YYYY_MONTH_MM", { code: "name" })}
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "2",
      description: (
        <div>
          <h4 className="text-lg text-high-emphasis">
            {t("TRACE_GUIDELINE_STEPS_DOCS.QUERY_TIPS")}
          </h4>
          <ul className="list-inside list-disc text-sm">
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.USE_TIME_RANGE_FILTERS_TO")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.AVOID_REGEX_ON_HIGH_CARDINALITY")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.PREFER_AGGREGATIONS_WITH_MATCH")}</li>
          </ul>
        </div>
      ),
    },
  ],
  cold: [
    {
      id: "0",
      description: (
        <div>
          <h4 className="text-lg text-high-emphasis">
            {t("TRACE_GUIDELINE_STEPS_DOCS.COLD_TIER_PARQUET")}
          </h4>
          <p>{t("TRACE_GUIDELINE_STEPS_DOCS.COLD_TRACES_APPROX_4_12")}</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.OPTIMIZED_FOR_COST_ANALYTICAL")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.ACCESSIBLE_VIA_ON_DEMAND_QUERY")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.SCHEMA_EVOLUTION_HANDLED_VIA")}</li>
          </ul>
        </div>
      ),
    },
    {
      id: "1",
      description: (
        <div>
          <h4 className="text-lg text-high-emphasis">
            {t("TRACE_GUIDELINE_STEPS_DOCS.ACCESSING_COLD_DATA")}
          </h4>
          <p className="text-sm">{t("TRACE_GUIDELINE_STEPS_DOCS.YOU_CAN_RUN_BATCH_QUERIES")}</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.EXPECT_HIGHER_LATENCY_SECONDS_FOR")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.FILTERS_PUSH_DOWN_ON_PARTITION")}</li>
          </ul>
        </div>
      ),
    },
    {
      id: "2",
      description: (
        <div>
          <h4 className="text-lg text-high-emphasis">
            {t("TRACE_GUIDELINE_STEPS_DOCS.LIFECYCLE")}
          </h4>
          <ul className="list-inside list-disc text-sm">
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.FILES_SEALED_AFTER_24H_INGESTION")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.COMPACTION_GROUPS_SMALL_HOURLY")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.AFTER_12_MONTHS_SEGMENTS")}</li>
          </ul>
        </div>
      ),
    },
  ],
  archive: [
    {
      id: "0",
      description: (
        <div>
          <h4 className="text-lg text-high-emphasis">
            {t("TRACE_GUIDELINE_STEPS_DOCS.ARCHIVE_TIER_COMPLIANCE")}
          </h4>
          <p>{t("TRACE_GUIDELINE_STEPS_DOCS.ARCHIVE_SPANS_1_3_YEARS")}</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.NOT_DIRECTLY_QUERYABLE_FROM_THE")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.INTENDED_FOR_AUDITS_INCIDENT")}</li>
          </ul>
        </div>
      ),
    },
    {
      id: "1",
      description: (
        <div>
          <h4 className="text-lg text-high-emphasis">
            {t("TRACE_GUIDELINE_STEPS_DOCS.HOW_TO_REQUEST_ARCHIVE_DATA")}
          </h4>
          <ol className="mt-2 list-inside list-decimal text-sm">
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.OPEN_AN_ADMIN_REQUEST_TICKET")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.ADMIN_VALIDATES_PURPOSE_COMPLIANCE")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.ON_APPROVAL_DATA_IS_TEMPORARILY")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.YOU_RECEIVE_A_SIGNED_URL")}</li>
            <li>{t("TRACE_GUIDELINE_STEPS_DOCS.AFTER_EXPIRY_THE_REHYDRATED")}</li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("TRACE_GUIDELINE_STEPS_DOCS.CONTACT_YOUR_PLATFORM")}
          </p>
        </div>
      ),
    },
    // {
    //   id: "2",
    //   description: (
    //     <div>
    //       <h4 className="text-lg text-high-emphasis">Retention & Deletion</h4>
    //       <ul className="list-inside list-disc text-sm">
    //         <li>Default retention: 3 years (configurable per environment).</li>
    //         <li>Early deletion requires dual approval (security + compliance).</li>
    //         <li>Legal hold suspends deletion timers for matched partitions.</li>
    //       </ul>
    //     </div>
    //   ),
    // },
  ],
});
