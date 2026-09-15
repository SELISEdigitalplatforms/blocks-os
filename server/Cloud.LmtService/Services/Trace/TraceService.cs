using Blocks.Genesis;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Repositories.Trace;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Cloud.LmtService.Services.Trace
{
    public class TraceService : ITraceService
    {
        private readonly ILogger<TraceService> _logger;
        private readonly ITraceRepository _traceRepository;

        public TraceService(ILogger<TraceService> logger, ITraceRepository traceRepository)
        {
            _logger = logger;
            _traceRepository = traceRepository;
        }

        // IQueryable<T>.Select binds to Queryable.Select (Expression<Func<...>>), which cannot
        // hold a statement-bodied lambda with assignments. Materializing first keeps the
        // mutation as plain, compilable code and still returns an IQueryable for the response.
        private static IQueryable<SingleTraceProjection> RedactSpans(IQueryable<SingleTraceProjection> spans)
        {
            var materialized = spans.ToList();
            foreach (var span in materialized)
            {
                TraceRedactor.RedactAttributes(span.Attributes);
                TraceRedactor.RedactBaggage(span.Baggage);
            }

            return materialized.AsQueryable();
        }

        private static IQueryable<TraceProjection> RedactTraces(IQueryable<TraceProjection> traces)
        {
            var materialized = traces.ToList();
            foreach (var trace in materialized)
            {
                TraceRedactor.RedactAttributes(trace.Attributes);
            }

            return materialized.AsQueryable();
        }

        public async Task<BaseQueryListResponse<IQueryable<SingleTraceProjection>>> GetTraceAsync(GetTraceRequest request)
        {
            _logger.LogInformation("Start of GetTraceAsync");
            if (string.IsNullOrWhiteSpace(request.TraceId))
            {
                return new BaseQueryListResponse<IQueryable<SingleTraceProjection>>
                {
                    Errors = new Dictionary<string, string>
                    {
                        { "Error", "Trace id is missing"}
                    }
                };
            }

            var result = await _traceRepository.GetTraces(request);

            return new BaseQueryListResponse<IQueryable<SingleTraceProjection>>
            {
                Data = RedactSpans(result)
            };
        }

        public async Task<BaseQueryListResponse<IQueryable<TraceProjection>>> GetTracesAsync(GetTracesRequest request)
        {
            _logger.LogInformation("Start of GetTracesAsync");
            var (result, total) = await _traceRepository.GetTraces(request);

            return new BaseQueryListResponse<IQueryable<TraceProjection>>
            {
                Data = RedactTraces(result),
                TotalCount = total
            };
        }

        public async Task<object> GetOperationalAnalytics(GetApiAnalyticsRequest request)
        {
            _logger.LogInformation("Start of GetTracesAsync");
            var result = await _traceRepository.GetOperationalAnalytics(request.StartTime, request.EndTime, request.ServiceName, request.OperationName);

            return result;
        }

        public async Task<object> GetServiceAnalytics(GetHttpStatusAnalyticsRequest request)
        {
            _logger.LogInformation("Start of GetTracesAsync");
            var result = await _traceRepository.GetServiceAnalytics(request.StartTime, request.EndTime, request.ServiceName);

            return result;
        }

    }
}
