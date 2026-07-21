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
} from "../models/trace.model";
import { IAPIResponse } from "@/models/api-response";
import { TRACE_ENDPOINTS } from "../constants/endpoint.constant";
import {
  buildTraceTreeFromSpans,
  parseTraceEntryPoint,
} from "../utils/trace-tree.util";

export class TraceService {
  async getTraces(payload: IGetTracesPayload): Promise<IGetTracesResponse> {
    try {
      const response = await http.post<IAPIResponse<Trace[]>>(
        TRACE_ENDPOINTS.GET_TRACES,
        payload,
      );

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
}
