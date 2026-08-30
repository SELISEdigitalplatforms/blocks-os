import { http } from "@/lib/http/http-client";
import {
  IGetTraceByTraceIdPayload,
  IGetTracesPayload,
  IGetTracesResponse,
  Trace,
  TraceTree,
  ITags,
  ISecurityContext,
  IRequest,
  IResponse,
  ITraceRequestPayload,
  IGetRequestIdPayload,
  IGetTraceStatusPayload,
  IGetRequestIdResponse,
  IGetTraceStatusResponse,
  IGetRestoredDataRetentionDaysResponse,
} from "../models/trace.model";
import { IBlocksServiceItem } from "../models/log.model";
import { IAPIResponse } from "@/models/api-response";
import { RESTORE_ENDPOINTS, TRACE_ENDPOINTS } from "../constants/endpoint.constant";
import { buildTraceTreeFromSpans, parseTraceEntryPoint } from "../utils/trace-tree.util";

export class TraceService {
  async getTraces(payload: IGetTracesPayload): Promise<IGetTracesResponse> {
    try {
      const response = await http.post<IAPIResponse<Trace[]>>(TRACE_ENDPOINTS.GET_TRACES, payload);

      const parsedData: TraceTree[] = response.data.map((trace) => ({
        ...trace,
        id: trace.traceId,
        entryPoint: parseTraceEntryPoint(trace.operationName),
        issues: [],
        service: trace.serviceName,
        tags: {} as ITags,
        securityContext: {} as ISecurityContext,
        request: {} as IRequest,
        response: {} as IResponse,
        logs: [],
        subEntries: [],
      }));

      return {
        data: parsedData,
        errors: response.errors ?? [],
        totalCount: response.totalCount ?? 0,
      };
    } catch (error) {
      console.error("Failed to fetch traces:", error);
      throw error;
    }
  }

  async getTraceByTraceId({
    traceId,
  }: IGetTraceByTraceIdPayload): Promise<IAPIResponse<TraceTree>> {
    try {
      const response = await http.get<Trace[] | IAPIResponse<Trace[]>>(
        `${TRACE_ENDPOINTS.GET_TRACE}?TraceId=${traceId}`,
      );

      // Determine if response is directly an array or wrapped in IAPIResponse
      let spans: Trace[];
      if (Array.isArray(response)) {
        spans = response;
      } else if ("data" in response && Array.isArray(response.data)) {
        spans = response.data;
      } else {
        spans = [];
      }

      const parsedData = buildTraceTreeFromSpans(spans);

      return {
        data: parsedData as TraceTree,
        errors: [],
        totalCount: 0,
      };
    } catch (error) {
      console.error("Failed to fetch trace:", error);
      throw error;
    }
  }

  async getBlocksServices(): Promise<IBlocksServiceItem[]> {
    return http.get<IBlocksServiceItem[]>(TRACE_ENDPOINTS.GET_BLOCKS_SERVICES);
  }

  async startColdTrace(payload: ITraceRequestPayload): Promise<unknown> {
    try {
      return await http.post<unknown>(RESTORE_ENDPOINTS.START_COLD_TRACE, payload);
    } catch (error) {
      console.error("Failed to start cold trace:", error);
      throw error;
    }
  }

  async startArchiveTrace(payload: ITraceRequestPayload): Promise<unknown> {
    try {
      return await http.post<unknown>(RESTORE_ENDPOINTS.START_ARCHIVE_TRACE, payload);
    } catch (error) {
      console.error("Failed to start archive trace:", error);
      throw error;
    }
  }

  async getTraceStatus({
    RequestId,
    SourceType,
  }: IGetTraceStatusPayload): Promise<IGetTraceStatusResponse> {
    try {
      return await http.get<IGetTraceStatusResponse>(
        `${RESTORE_ENDPOINTS.GET_TRACE_STATUS}?RequestId=${RequestId}&SourceType=${SourceType}`,
      );
    } catch (error) {
      console.error("Failed to get trace status:", error);
      throw error;
    }
  }

  async getRequestId({ SourceType, ProjectKey }: IGetRequestIdPayload): Promise<IGetRequestIdResponse> {
    try {
      return await http.get<IGetRequestIdResponse>(
        `${RESTORE_ENDPOINTS.GET_REQUEST_ID}?SourceType=${SourceType}&ProjectKey=${ProjectKey}`,
      );
    } catch (error) {
      console.error("Failed to get request id:", error);
      throw error;
    }
  }

  async getRestoredTraces(payload: IGetTracesPayload): Promise<IGetTracesResponse> {
    try {
      const response = await http.post<IAPIResponse<Trace[]>>(
        RESTORE_ENDPOINTS.GET_RESTORED_TRACES,
        payload,
      );

      const parsedData: TraceTree[] = (response.data || []).map((trace) => ({
        ...trace,
        id: trace.traceId,
        entryPoint: parseTraceEntryPoint(trace.operationName || ""),
        issues: [],
        service: trace.serviceName,
        tags: {} as ITags,
        securityContext: {} as ISecurityContext,
        request: {} as IRequest,
        response: {} as IResponse,
        logs: [],
        subEntries: [],
      }));

      return {
        data: parsedData,
        errors: response.errors ?? [],
        totalCount: response.totalCount ?? 0,
      };
    } catch (error) {
      console.error("Failed to get restored traces:", error);
      throw error;
    }
  }

  async getRestoredTraceByTraceId({
    traceId,
    requestId,
  }: IGetTraceByTraceIdPayload): Promise<IAPIResponse<TraceTree>> {
    try {
      const response = await http.get<IAPIResponse<Trace[]>>(
        `${RESTORE_ENDPOINTS.GET_RESTORED_TRACE}?RequestId=${requestId}&TraceId=${traceId}`,
      );

      return {
        data: buildTraceTreeFromSpans(response.data || []) as TraceTree,
        errors: [],
        totalCount: 0,
      };
    } catch (error) {
      console.error("Failed to fetch restored trace:", error);
      throw error;
    }
  }

  async getRestoredDataRetentionDays(): Promise<IGetRestoredDataRetentionDaysResponse> {
    try {
      return await http.get<IGetRestoredDataRetentionDaysResponse>(
        RESTORE_ENDPOINTS.GET_RESTORED_DATA_RETENTION_DAYS,
      );
    } catch (error) {
      console.error("Failed to get restored data retention days:", error);
      throw error;
    }
  }
}
