using DomainService.Projects;

namespace Worker
{
    public class RestoreUnfinishedProjectConfiguration
    {
        public bool Enabled { get; set; }
        public int IntervalSeconds { get; set; }
    }

    public class RestoreUnfinishedProjectBackgroundService : BackgroundService
    {
        private readonly IProjectManagementService _projectManagementService;
        private readonly ILogger<RestoreUnfinishedProjectBackgroundService> _logger;
        private readonly RestoreUnfinishedProjectConfiguration _config;

        public RestoreUnfinishedProjectBackgroundService(
            IProjectManagementService projectManagementService,
            IConfiguration configuration,
            ILogger<RestoreUnfinishedProjectBackgroundService> logger)
        {
            _projectManagementService = projectManagementService;
            _logger = logger;

            _config = new RestoreUnfinishedProjectConfiguration
            {
                Enabled = true,
                IntervalSeconds = 30
            };
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
           

            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_config.IntervalSeconds));

            _logger.LogInformation(
                "RestoreUnfinishedProject background service started. Interval: {Seconds}s",
                _config.IntervalSeconds);

            // Immediate first execution
            await RunOnceAsync(stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    if (!await timer.WaitForNextTickAsync(stoppingToken))
                    {
                        break;
                    }

                    await RunOnceAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "RestoreUnfinishedProject execution failed");
                }
            }

            _logger.LogInformation("RestoreUnfinishedProject background service stopped.");
        }

        private async Task RunOnceAsync(CancellationToken stoppingToken)
        {
            try
            {
                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                await _projectManagementService.RestoreUnfinishedProjectAsync();
                stopwatch.Stop();

                _logger.LogInformation(
                    "RestoreUnfinishedProject completed in {ElapsedMs} ms",
                    stopwatch.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RestoreUnfinishedProjectAsync threw");
            }
        }
    }
}
