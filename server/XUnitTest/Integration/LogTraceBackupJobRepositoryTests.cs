using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Cloud.LmtService.Models.LogTraceBackup;
using Cloud.LmtService.Repositories.LogTraceBackup;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Integration
{
    /// <summary>
    /// The job history the catch-up reads and the Skipped jobs it writes, against a real MongoDB.
    /// Each test uses its own far-past days, because the collection fixture is shared.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class LogTraceBackupJobRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public LogTraceBackupJobRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private LogTraceBackupRepository Repository()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.TraceConnectionString).Returns(MongoIntegrationFixture.ConnectionString);
            return new LogTraceBackupRepository(secret.Object, _fixture.DbContextProvider, NullLogger<LogTraceBackupRepository>.Instance);
        }

        private IMongoCollection<LogTraceBackupJob> Jobs() =>
            _fixture.DbContextProvider.GetDatabase(MongoIntegrationFixture.ConnectionString, "LogTraceBackupTrack")
                .GetCollection<LogTraceBackupJob>("LogTraceBackupJobs");

        private static DateTime Day(int year, int month, int day) => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);

        [Fact]
        public async Task GetJobsForDays_ReturnsTheJobsOfEveryDayInTheRange_BothEndsIncluded()
        {
            var repository = Repository();
            var runIds = new List<string>();
            foreach (var day in new[] { 1, 3, 4, 5 })
                runIds.Add(await repository.CreateJobAsync(Day(2001, 3, day), Day(2001, 3, day + 1)));

            try
            {
                var jobs = await repository.GetJobsForDaysAsync(Day(2001, 3, 2), Day(2001, 3, 4));

                jobs.Select(j => j.DataDateFrom).Should().BeEquivalentTo([Day(2001, 3, 3), Day(2001, 3, 4)]);
                jobs.Should().OnlyContain(j => j.Status == LogTraceBackupJobStatus.Running);
            }
            finally
            {
                // The fixture is shared: a Running job left behind would hold the run lock for later tests.
                foreach (var runId in runIds)
                    await repository.CompleteJobAsync(runId);
            }
        }

        [Fact]
        public async Task CreateSkippedJob_RecordsAFinishedJobWithTheReason()
        {
            var repository = Repository();

            await repository.CreateSkippedJobAsync(Day(2002, 5, 1), Day(2002, 5, 2), "Skipped after 3 failed attempts");

            var job = (await Jobs().Find(j => j.DataDateFrom == Day(2002, 5, 1)).ToListAsync()).Should().ContainSingle().Subject;
            job.Status.Should().Be(LogTraceBackupJobStatus.Skipped);
            job.ErrorReason.Should().Be("Skipped after 3 failed attempts");
            job.DataDateTo.Should().Be(Day(2002, 5, 2));
            job.EndTime.Should().NotBeNull();
            job.RunId.Should().NotBeNullOrWhiteSpace();
            job.LastHeartbeatAt.Should().Be(job.EndTime!.Value, "a Skipped job is finished, so it never holds the run lock");
        }
    }
}
