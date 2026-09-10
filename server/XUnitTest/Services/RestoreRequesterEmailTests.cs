using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.MailDriver;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Shared;
using Cloud.LmtService.Repositories.ColdRestore;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Services
{
    /// <summary>
    /// Where the completion email address comes from.
    ///
    /// It used to be <c>request.UserMail ?? BlocksContext.GetContext().UserName</c>. No caller
    /// sends UserMail, and the deployed token populates neither UserName nor Email — so UserEmail
    /// was persisted as null on every request and the send was skipped every time. The identity
    /// the context does carry is the user id, so the address is resolved from that, and only from
    /// that: the cold path no longer consults the caller-supplied UserMail at all.
    /// </summary>
    public class RestoreRequesterEmailTests : IDisposable
    {
        private const string Tenant = "tenant-a";

        private readonly Mock<ILogger<LogTraceRestoreService>> _logger = new();
        private readonly Mock<ILogger<ArchiveRestoreService>> _archiveLogger = new();
        private readonly Mock<ILogTraceRestoreRepository> _restoreRepository = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ILogTraceRestoreResultRepository> _resultRepository = new();
        private readonly Mock<ILogTraceRestoreParquetReader> _parquetReader = new();
        private readonly Mock<IBlobStorage> _blobStorage = new();
        private readonly Mock<IConfiguration> _configuration = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _configRepository = new();
        private readonly Mock<IMailDriverService> _mailDriverService = new();
        private readonly Mock<IHttpService> _httpService = new();
        private readonly Mock<ICryptoService> _cryptoService = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IArchiveRestoreRepository> _archiveRepository = new();
        private readonly Mock<IRestoreUserRepository> _userRepository = new();

        public RestoreRequesterEmailTests()
        {
            // Mirrors the deployed token: a user id, but no email and no user name.
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId: Tenant,
                roles: [],
                userId: "user-1",
                isAuthenticated: true,
                requestUri: "/",
                organizationId: "org-1",
                expireOn: DateTime.UtcNow.AddHours(1),
                email: string.Empty,
                permissions: [],
                userName: string.Empty,
                phoneNumber: null,
                displayName: string.Empty,
                oauthToken: null,
                originalTenantId: Tenant));

            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations
                {
                    HotDataRetentionPeriodInDays = 30,
                    ColdToArchiveLifeCycleInDays = 90,
                    MaxRestoreRangeInDays = 7,
                    RetentionDay = 1
                });
        }

        public void Dispose()
        {
            BlocksContext.ClearContext();
            GC.SuppressFinalize(this);
        }

        private LogTraceRestoreService ColdService() => new(
            _logger.Object,
            _restoreRepository.Object,
            _messageClient.Object,
            _resultRepository.Object,
            _parquetReader.Object,
            _blobStorage.Object,
            _configuration.Object,
            _configRepository.Object,
            _mailDriverService.Object,
            _httpService.Object,
            _cryptoService.Object,
            _tenants.Object,
            _archiveRepository.Object,
            _userRepository.Object);

        private ArchiveRestoreService ArchiveService() => new(
            _archiveLogger.Object,
            _blobStorage.Object,
            _archiveRepository.Object,
            _restoreRepository.Object,
            _configRepository.Object,
            _messageClient.Object,
            ColdService(),
            _userRepository.Object);

        private List<RestoreRequestRecord> CaptureCreatedRequests()
        {
            var created = new List<RestoreRequestRecord>();

            _restoreRepository
                .Setup(r => r.CreateRequestAsync(It.IsAny<RestoreRequestRecord>(), It.IsAny<CancellationToken>()))
                .Callback<RestoreRequestRecord, CancellationToken>((record, _) => created.Add(record))
                .Returns(Task.CompletedTask);

            return created;
        }

        private static DateTime DaysAgo(int days) => DateTime.UtcNow.Date.AddDays(-days);

        [Fact]
        public async Task StartRestoreAsync_ResolvesTheRequestersEmailFromTheirUserId()
        {
            _userRepository
                .Setup(r => r.GetEmailByUserIdAsync("user-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync("requester@example.com");

            var created = CaptureCreatedRequests();

            await ColdService().StartRestoreAsync(new StartColdRestoreRequest
            {
                ServiceName = "svc",
                StartDate = DaysAgo(50),
                EndDate = DaysAgo(48)
            });

            created.Should().HaveCount(1);
            created[0].UserEmail.Should().Be("requester@example.com");
        }

        /// <summary>
        /// The address is always the one on the user record, never the one on the request.
        /// UserMail is caller-supplied and no caller populates it, so honouring it would only
        /// serve to let a hand-rolled request name any recipient for the completion mail.
        /// </summary>
        [Fact]
        public async Task StartRestoreAsync_IgnoresAnAddressSuppliedOnTheRequest()
        {
            _userRepository
                .Setup(r => r.GetEmailByUserIdAsync("user-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync("requester@example.com");

            var created = CaptureCreatedRequests();

            await ColdService().StartRestoreAsync(new StartColdRestoreRequest
            {
                ServiceName = "svc",
                UserMail = "someone-else@example.com",
                StartDate = DaysAgo(50),
                EndDate = DaysAgo(48)
            });

            created[0].UserEmail.Should().Be("requester@example.com");
        }

        /// <summary>
        /// The address is a courtesy on top of the restore. A user row that cannot be read must not
        /// cost the requester their restore.
        /// </summary>
        [Fact]
        public async Task StartRestoreAsync_StillCreatesTheRequest_WhenNoAddressCanBeResolved()
        {
            _userRepository
                .Setup(r => r.GetEmailByUserIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((string?)null);

            var created = CaptureCreatedRequests();

            var response = await ColdService().StartRestoreAsync(new StartColdRestoreRequest
            {
                ServiceName = "svc",
                StartDate = DaysAgo(50),
                EndDate = DaysAgo(48)
            });

            response.RequestId.Should().NotBeNullOrWhiteSpace();
            created[0].UserEmail.Should().BeNull();
        }

        [Fact]
        public async Task StartArchiveRestoreAsync_ResolvesTheRequestersEmailFromTheirUserId()
        {
            _userRepository
                .Setup(r => r.GetEmailByUserIdAsync("user-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync("requester@example.com");

            var created = CaptureCreatedRequests();

            await ArchiveService().StartArchiveRestoreAsync(new StartArchiveRestoreRequest
            {
                ServiceName = "svc",
                StartDate = DaysAgo(200),
                EndDate = DaysAgo(198)
            });

            created.Should().HaveCount(1);
            created[0].UserEmail.Should().Be("requester@example.com");
        }
    }
}
