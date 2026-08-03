using System;
using System.Threading;
using System.Threading.Tasks;
using DomainService.Projects;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Worker;

namespace XUnitTest.Worker
{
    public class RestoreUnfinishedProjectBackgroundServiceTests
    {
        private readonly Mock<IProjectManagementService> _service = new();
        private readonly IConfiguration _configuration = new ConfigurationBuilder().Build();

        private RestoreUnfinishedProjectBackgroundService NewService() => new(
            _service.Object,
            _configuration,
            NullLogger<RestoreUnfinishedProjectBackgroundService>.Instance);

        [Fact]
        public async Task ExecuteAsync_RunsImmediatelyThenStopsOnCancellation()
        {
            var called = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            _service.Setup(s => s.RestoreUnfinishedProjectAsync())
                    .Callback(() => called.TrySetResult(true))
                    .Returns(Task.CompletedTask);

            var sut = NewService();
            await sut.StartAsync(CancellationToken.None);

            // The first execution happens immediately, before the periodic loop.
            (await Task.WhenAny(called.Task, Task.Delay(TimeSpan.FromSeconds(5)))).Should().Be(called.Task);

            await sut.StopAsync(CancellationToken.None);

            _service.Verify(s => s.RestoreUnfinishedProjectAsync(), Times.AtLeastOnce);
        }

        [Fact]
        public async Task ExecuteAsync_WhenRestoreThrows_SwallowsAndKeepsRunning()
        {
            var called = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            _service.Setup(s => s.RestoreUnfinishedProjectAsync())
                    .Callback(() => called.TrySetResult(true))
                    .ThrowsAsync(new InvalidOperationException("boom"));

            var sut = NewService();
            await sut.StartAsync(CancellationToken.None);

            (await Task.WhenAny(called.Task, Task.Delay(TimeSpan.FromSeconds(5)))).Should().Be(called.Task);

            // The exception is caught inside RunOnceAsync, so stopping is still clean.
            var stop = async () => await sut.StopAsync(CancellationToken.None);
            await stop.Should().NotThrowAsync();
        }
    }
}
