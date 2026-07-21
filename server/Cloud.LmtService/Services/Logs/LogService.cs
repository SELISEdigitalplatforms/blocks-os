using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Repositories.Logs;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Cloud.LmtService.Services.Logs
{
    public class LogService : ILogService
    {
        private readonly ILogger<LogService> _logger;
        private readonly ILogRepository _logRepository;

        public LogService(
            ILogger<LogService> logger,
            ILogRepository logRepository
        )
        {
            _logger = logger;
            _logRepository = logRepository;
        }

        private static bool HasAnyServiceName(string? serviceName, IEnumerable<string>? serviceNames)
        {
            return !string.IsNullOrWhiteSpace(serviceName) ||
                   serviceNames?.Any(name => !string.IsNullOrWhiteSpace(name)) == true;
        }

        public async Task<GetLogsResponse> GetLiveLogsAsync(LiveLogRequest request)
        {
            _logger.LogInformation("Start of GetLiveLogsAsync");
            if (!HasAnyServiceName(request.Name, request.ServiceNames) || request.LastDate == DateTime.MinValue)
            {
                return new GetLogsResponse
                {
                    Errors = new Dictionary<string, string> { { "Error", "Name/Date is missing" } }
                };
            }

            var result = await _logRepository.GetLogs(request);

            return new GetLogsResponse { Data = result };
        }

        public async Task<GetLogsResponse> GetLogsAsync(GetLogsRequest request)
        {
            _logger.LogInformation("Start of GetLogsAsync");
            if (!HasAnyServiceName(request.ServiceName, request.ServiceNames))
            {
                return new GetLogsResponse
                {
                    Errors = new Dictionary<string, string> { { "Error", "ServiceName is missing" } }
                };
            }

            var (result, total) = await _logRepository.GetLogs(request);

            return new GetLogsResponse { Data = result, TotalCount = total };
        }

        public async Task<GetLogsResponse> GetLogsByDateAsync(LogsByDateRequest request)
        {
            _logger.LogInformation("Start of GetLogsAsync");
            if (!HasAnyServiceName(request.ServiceName, request.ServiceNames))
            {
                return new GetLogsResponse
                {
                    Errors = new Dictionary<string, string> { { "Error", "ServiceName is missing" } }
                };
            }

            var (result, total) = await _logRepository.GetLogs(request);

            return new GetLogsResponse { Data = result, TotalCount = total };
        }
    }
}
