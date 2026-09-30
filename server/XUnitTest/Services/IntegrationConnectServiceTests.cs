using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using Configuration.DomainService.Integration.RequestModel;
using Configuration.DomainService.Integration.Services;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services;

public class IntegrationConnectServiceTests : IDisposable
{
    private readonly Mock<IIntegrationRepository> _templates = new();
    private readonly Mock<IIntegrationRequestRepository> _requests = new();
    private readonly Mock<IIntegrationService> _integration = new();
    private readonly Mock<ICryptoService> _crypto = new();
    private readonly Mock<ITenants> _tenants = new();
    private readonly IntegrationConnectService _service;

    public IntegrationConnectServiceTests()
    {
        _service = new IntegrationConnectService(_templates.Object, _requests.Object, _integration.Object, _crypto.Object, _tenants.Object);
    }

    public void Dispose() => BlocksContext.SetContext(null);

    private static readonly IntegrationTemplate[] FamilyTemplates =
    [
        new() { Key = "localization-read", DisplayName = "Read", AccessLevel = "read", SortOrder = 1, Permissions = ["a", "b", "c"] },
    ];

    private void Templates(params IntegrationTemplate[] templates) =>
        _templates.Setup(r => r.GetActiveTemplatesAsync("localization")).ReturnsAsync(templates.ToList());

    private void DefaultTemplates() => Templates(FamilyTemplates);

    private static IntegrationRequest Pending(string userId = null!) =>
        new()
        {
            ItemId = "req-1",
            Status = "pending",
            Family = "localization",
            SiteName = "My Blog",
            RedirectHost = "site.example.com",
            RedirectUri = "https://site.example.com/callback",
            State = "state-1234567890",
            ClaimedByUserId = userId,
            ExpiresAt = DateTime.UtcNow.AddMinutes(50),
        };

    [Fact]
    public async Task GetRequest_FirstCall_ClaimsForTheCurrentUser()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        IntegrationRequest? claimed = null;
        _requests.Setup(r => r.TryClaimAsync("req-1", "u1", It.IsAny<CancellationToken>()))
            .Callback<string, string, CancellationToken>((id, user, _) => { claimed = Pending(user); })
            .ReturnsAsync((string id, string user, CancellationToken _) => { claimed = Pending(user); return claimed; });

        DefaultTemplates();
        var (response, errors) = await _service.GetRequestAsync("req-1");

        errors.Should().BeNull();
        _requests.Verify(r => r.TryClaimAsync("req-1", "u1", It.IsAny<CancellationToken>()), Times.Once);
        response!.RequestId.Should().Be("req-1");
        response.SiteName.Should().Be("My Blog");
        response.RedirectHost.Should().Be("site.example.com");
        response.Status.Should().Be("pending");
    }

    [Fact]
    public async Task GetRequest_AlreadyClaimedBySameUser_DoesNotReclaim()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        var mine = Pending("u1");
        _requests.Setup(r => r.TryClaimAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(mine);

        DefaultTemplates();
        var (response, errors) = await _service.GetRequestAsync("req-1");

        errors.Should().BeNull();
        response!.RequestId.Should().Be("req-1");
    }

    [Fact]
    public async Task GetRequest_ClaimedByAnotherUser_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u2", impersonated: false);
        _requests.Setup(r => r.TryClaimAsync("req-1", "u2", It.IsAny<CancellationToken>()))
            .ReturnsAsync((IntegrationRequest?)null);
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Pending("u1"));

        DefaultTemplates();
        var (response, errors) = await _service.GetRequestAsync("req-1");

        response.Should().BeNull();
        errors.Should().ContainKey("request_claimed_by_other_user");
    }

    [Fact]
    public async Task GetRequest_Expired_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        var expired = Pending("u1");
        expired.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
        _requests.Setup(r => r.TryClaimAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expired);

        DefaultTemplates();
        var (response, errors) = await _service.GetRequestAsync("req-1");

        response.Should().BeNull();
        errors.Should().ContainKey("request_not_found_or_expired");
    }

    [Fact]
    public async Task GetRequest_Missing_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        _requests.Setup(r => r.TryClaimAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IntegrationRequest?)null);
        _requests.Setup(r => r.GetByIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IntegrationRequest?)null);

        DefaultTemplates();
        var (response, errors) = await _service.GetRequestAsync("nope");

        response.Should().BeNull();
        errors.Should().ContainKey("request_not_found_or_expired");
    }

    [Fact]
    public async Task GetRequest_ServesTheFamilyTemplatesSortedWithCounts()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        _requests.Setup(r => r.TryClaimAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Pending("u1"));
        Templates(
            new IntegrationTemplate { Key = "localization-full", DisplayName = "Full", AccessLevel = "full", SortOrder = 2, Permissions = ["a", "b", "c", "d", "e", "f", "g"] },
            new IntegrationTemplate { Key = "localization-read", DisplayName = "Read", AccessLevel = "read", SortOrder = 1, Permissions = ["a", "b", "c"] });

        var (response, _) = await _service.GetRequestAsync("req-1");

        response!.Templates.Select(t => t.Key).Should().ContainInOrder("localization-read", "localization-full");
        response.Templates[0].PermissionCount.Should().Be(3);
        response.Templates[1].PermissionCount.Should().Be(7);
    }

    [Fact]
    public async Task Cancel_ByClaimer_MarksCancelledAndBuildsTheErrorRedirect()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        var pending = Pending("u1");
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(pending);
        _requests.Setup(r => r.TryTransitionFromPendingAsync("req-1", "u1", "cancelled", It.IsAny<CancellationToken>()))
            .ReturnsAsync(pending);

        var (response, errors) = await _service.CancelRequestAsync(new CancelIntegrationRequest { RequestId = "req-1" });

        errors.Should().BeNull();
        response!.RedirectUrl.Should().Be("https://site.example.com/callback?error=access_denied&state=state-1234567890");
        _requests.Verify(r => r.TryTransitionFromPendingAsync("req-1", "u1", "cancelled", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Cancel_ByAnotherUser_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u2", impersonated: false);
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(Pending("u1"));

        var (response, errors) = await _service.CancelRequestAsync(new CancelIntegrationRequest { RequestId = "req-1" });

        response.Should().BeNull();
        errors.Should().ContainKey("request_claimed_by_other_user");
        _requests.Verify(r => r.TryTransitionFromPendingAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Cancel_AlreadyApproved_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        var approved = Pending("u1");
        approved.Status = "approved";
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(approved);

        var (response, errors) = await _service.CancelRequestAsync(new CancelIntegrationRequest { RequestId = "req-1" });

        response.Should().BeNull();
        errors.Should().ContainKey("request_not_pending");
    }

    [Fact]
    public async Task Cancel_AppendsToAQueryCarryingRedirectUri()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        var pending = Pending("u1");
        pending.RedirectUri = "https://site.example.com/cb?foo=1";
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(pending);
        _requests.Setup(r => r.TryTransitionFromPendingAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pending);

        var (response, _) = await _service.CancelRequestAsync(new CancelIntegrationRequest { RequestId = "req-1" });

        response!.RedirectUrl.Should().Be("https://site.example.com/cb?foo=1&error=access_denied&state=state-1234567890");
    }

    [Fact]
    public async Task Cancel_Expired_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        var expired = Pending("u1");
        expired.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(expired);

        var (response, errors) = await _service.CancelRequestAsync(new CancelIntegrationRequest { RequestId = "req-1" });

        response.Should().BeNull();
        errors.Should().ContainKey("request_not_found_or_expired");
    }

    private static RunIntegrationSetupResponse SetupOk() =>
        new() { IsSuccess = true, ConnectionId = "conn-1", ClientId = "client-1", ClientSecret = "secret-1" };

    private void Approvable(out IntegrationRequest request)
    {
        request = Pending("u1");
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requests.Setup(r => r.TryStartApprovalAsync("req-1", "u1", It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requests.Setup(r => r.TryCompleteApprovalAsync(It.IsAny<IntegrationRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _integration.Setup(i => i.RunSetupAsync(It.IsAny<RunIntegrationSetupRequest>())).ReturnsAsync(SetupOk());
        _crypto.Setup(c => c.Encrypt("secret-1", It.IsAny<string>())).Returns("cipher-1");
        _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(new Tenant { TenantSalt = "salt", DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "p" } });
        DefaultTemplates();
    }

    [Fact]
    public async Task Approve_RunsSetup_StoresHashAndCipher_ReturnsCodeRedirect()
    {
        using var ctx = new BlocksTestContext(tenantId: "env-tenant", userId: "u1", impersonated: true);
        Approvable(out var request);
        IntegrationRequest? saved = null;
        _requests.Setup(r => r.TryCompleteApprovalAsync(It.IsAny<IntegrationRequest>(), It.IsAny<CancellationToken>()))
            .Callback<IntegrationRequest, CancellationToken>((r, _) => saved = r)
            .ReturnsAsync(true);

        var (response, errors) = await _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "localization-read" });

        errors.Should().BeNull();
        saved.Should().NotBeNull();
        saved!.Status.Should().Be("approved");
        saved.CodeHash.Should().NotBeNullOrEmpty();
        saved.SecretCipher.Should().Be("cipher-1");
        saved.EnvironmentTenantId.Should().Be("env-tenant");
        saved.ConnectionId.Should().Be("conn-1");
        saved.ExpiresAt.Should().BeAfter(DateTime.UtcNow.AddMinutes(4)).And.BeBefore(DateTime.UtcNow.AddMinutes(6));
        response!.RedirectUrl.Should().StartWith("https://site.example.com/callback?code=");
        response.RedirectUrl.Should().Contain("state=state-1234567890");
        response.RedirectUrl.Should().Contain("blocks_key=");
        // The redirect carries the raw code; only its hash may be stored.
        var code = System.Web.HttpUtility.ParseQueryString(new Uri(response.RedirectUrl).Query)["code"];
        code.Should().NotBeNullOrEmpty();
        saved.CodeHash.Should().Be(TestHash(code!));
    }

    [Fact]
    public void BuildConnectionName_TruncatesLongSiteNamesAndKeepsReconnectsUnique()
    {
        var first = Pending("u1");
        first.ItemId = "abcdef-first-request";
        first.SiteName = new string('a', 100);
        var second = Pending("u1");
        second.ItemId = "ghijkl-second-request";
        second.SiteName = first.SiteName;

        var firstName = IntegrationConnectService.BuildConnectionName(first);
        var secondName = IntegrationConnectService.BuildConnectionName(second);

        firstName.Length.Should().BeLessThanOrEqualTo(60);
        secondName.Length.Should().BeLessThanOrEqualTo(60);
        firstName.Should().EndWith(" · abcdef");
        secondName.Should().EndWith(" · ghijkl");
        firstName.Should().NotBe(secondName);
    }

    [Fact]
    public async Task Approve_ByAnotherUser_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u2", impersonated: true);
        var request = Pending("u1");
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requests.Setup(r => r.TryStartApprovalAsync("req-1", "u1", It.IsAny<CancellationToken>())).ReturnsAsync(request);

        var (response, errors) = await _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "localization-read" });

        response.Should().BeNull();
        errors.Should().ContainKey("request_claimed_by_other_user");
        _integration.Verify(i => i.RunSetupAsync(It.IsAny<RunIntegrationSetupRequest>()), Times.Never);
    }

    [Fact]
    public async Task Approve_OutsideAnEnvironment_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: false);
        Approvable(out var _unused);

        var (response, errors) = await _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "localization-read" });

        response.Should().BeNull();
        errors.Should().ContainKey("project");
    }

    [Fact]
    public async Task Approve_WrongFamilyTemplate_IsRefused()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: true);
        Approvable(out var _unused);

        var (response, errors) = await _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "other-template" });

        response.Should().BeNull();
        errors.Should().ContainKey("template_not_found");
    }

    [Fact]
    public async Task Approve_DoubleApprove_ReissuesAWorkingRawCodeWithoutRunningSetupAgain()
    {
        using var _ = new BlocksTestContext(tenantId: "env-tenant", userId: "u1", impersonated: true);
        Approvable(out var _unused);

        var first = await _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "localization-read" });
        var approved = Pending("u1");
        approved.Status = "approved";
        approved.TemplateKey = "localization-read";
        approved.CodeHash = "hash-1";
        approved.ExpiresAt = DateTime.UtcNow.AddMinutes(4);
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(approved);
        _requests.Setup(r => r.RotateApprovedCodeAsync("req-1", "u1", "localization-read", It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string _, string _, string _, string hash, CancellationToken _) => { approved.CodeHash = hash; return approved; });
        var second = await _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "localization-read" });

        second.Errors.Should().BeNull();
        _integration.Verify(i => i.RunSetupAsync(It.IsAny<RunIntegrationSetupRequest>()), Times.Once);
        var secondCode = System.Web.HttpUtility.ParseQueryString(new Uri(second.Response!.RedirectUrl).Query)["code"];
        secondCode.Should().NotBeNullOrEmpty();
        secondCode.Should().NotBe("hash-1");
        approved.CodeHash.Should().Be(TestHash(secondCode!));
    }

    [Fact]
    public async Task Approve_ConcurrentRequests_RunSetupOnlyOnce()
    {
        using var _ = new BlocksTestContext(tenantId: "env-tenant", userId: "u1", impersonated: true);
        var request = Pending("u1");
        var setupStarted = new TaskCompletionSource();
        var releaseSetup = new TaskCompletionSource();
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requests.SetupSequence(r => r.TryStartApprovalAsync("req-1", "u1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(request)
            .ReturnsAsync((IntegrationRequest?)null);
        _requests.Setup(r => r.TryCompleteApprovalAsync(It.IsAny<IntegrationRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _integration.Setup(i => i.RunSetupAsync(It.IsAny<RunIntegrationSetupRequest>())).Returns(async () =>
        {
            request.Status = "approving";
            setupStarted.SetResult();
            await releaseSetup.Task;
            return SetupOk();
        });
        _crypto.Setup(c => c.Encrypt("secret-1", It.IsAny<string>())).Returns("cipher-1");
        _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(new Tenant { TenantSalt = "salt", DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "p" } });
        DefaultTemplates();

        var first = _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "localization-read" });
        await setupStarted.Task;
        var second = await _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "localization-read" });
        releaseSetup.SetResult();
        await first;

        _integration.Verify(i => i.RunSetupAsync(It.IsAny<RunIntegrationSetupRequest>()), Times.Once);
        second.Errors.Should().ContainKey("request_not_pending");
    }

    [Fact]
    public async Task Approve_SetupFails_ReturnsTheSetupErrors()
    {
        using var _ = new BlocksTestContext(userId: "u1", impersonated: true);
        var request = Pending("u1");
        _requests.Setup(r => r.GetByIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requests.Setup(r => r.TryStartApprovalAsync("req-1", "u1", It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _integration.Setup(i => i.RunSetupAsync(It.IsAny<RunIntegrationSetupRequest>()))
            .ReturnsAsync(new RunIntegrationSetupResponse { IsSuccess = false, Errors = new Dictionary<string, string> { ["permissions_missing"] = "One or more template permissions do not exist in this project." } });
        DefaultTemplates();

        var (response, errors) = await _service.ApproveRequestAsync(new ApproveIntegrationRequest { RequestId = "req-1", TemplateKey = "localization-read" });

        response.Should().BeNull();
        errors.Should().ContainKey("permissions_missing");
        _requests.Verify(r => r.TryCompleteApprovalAsync(It.IsAny<IntegrationRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private IntegrationRequest ApprovedRecord(string code, string verifier)
    {
        var request = Pending("u1");
        request.Status = "approved";
        request.CodeHash = TestHash(code);
        request.CodeChallenge = TestBase64Url(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.ASCII.GetBytes(verifier)));
        request.EnvironmentTenantId = "env-tenant";
        request.TemplateKey = "localization-read";
        request.ClientId = "client-1";
        request.SecretCipher = "cipher-1";
        request.ExpiresAt = DateTime.UtcNow.AddMinutes(4);
        return request;
    }

    [Fact]
    public async Task Exchange_ValidCodeVerifierAndRedirect_ReturnsKeysAndConsumes()
    {
        using var _ = new BlocksTestContext(impersonated: false);
        var code = "the-code"; var verifier = "the-verifier";
        var record = ApprovedRecord(code, verifier);
        _requests.Setup(r => r.TryExchangeByCodeHashAsync(TestHash(code), "https://site.example.com/callback", TestBase64Url(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.ASCII.GetBytes(verifier))), It.IsAny<CancellationToken>()))
            .ReturnsAsync(record);
        _crypto.Setup(c => c.Decrypt("cipher-1", "salt")).Returns("secret-1");
        _tenants.Setup(t => t.GetTenantByID("env-tenant")).Returns(new Tenant { TenantSalt = "salt", DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "p" }, Applications = [new() { Domain = "https://app.example.com" }] });
        _templates.Setup(r => r.GetTemplateByKeyAsync("localization-read", true)).ReturnsAsync(FamilyTemplates[0]);

        var (response, errors) = await _service.ExchangeAsync(new ExchangeIntegrationRequest { Code = code, CodeVerifier = verifier, RedirectUri = "https://site.example.com/callback" });

        errors.Should().BeNull();
        response!.ClientId.Should().Be("client-1");
        response.ClientSecret.Should().Be("secret-1");
        response.XBlocksKey.Should().Be("env-tenant");
        response.BaseUrl.Should().Be(FamilyTemplates[0].BaseUrl);
        response.AccessLevel.Should().Be("read");
        _requests.Verify(r => r.MarkFailedByCodeHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Exchange_WrongVerifier_BurnsTheCode()
    {
        using var _ = new BlocksTestContext(impersonated: false);
        var record = ApprovedRecord("the-code", "the-verifier");
        record.ConnectionId = "connection-1";
        _requests.Setup(r => r.TryExchangeByCodeHashAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IntegrationRequest?)null);
        _requests.Setup(r => r.MarkFailedByCodeHashAsync(TestHash("the-code"), It.IsAny<CancellationToken>()))
            .ReturnsAsync(record);

        var (response, errors) = await _service.ExchangeAsync(new ExchangeIntegrationRequest { Code = "the-code", CodeVerifier = "wrong-verifier", RedirectUri = "https://site.example.com/callback" });

        response.Should().BeNull();
        errors.Should().ContainKey("invalid_code");
        _requests.Verify(r => r.MarkFailedByCodeHashAsync(TestHash("the-code"), It.IsAny<CancellationToken>()), Times.Once);
        _integration.Verify(i => i.RevokeUndeliveredConnectionAsync("env-tenant", "connection-1"), Times.Once);
    }

    [Fact]
    public async Task Exchange_UnknownCode_BurnsNothingButFails()
    {
        using var _ = new BlocksTestContext(impersonated: false);
        _requests.Setup(r => r.TryExchangeByCodeHashAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IntegrationRequest?)null);

        var (response, errors) = await _service.ExchangeAsync(new ExchangeIntegrationRequest { Code = "guessed", CodeVerifier = "whatever", RedirectUri = "https://site.example.com/callback" });

        response.Should().BeNull();
        errors.Should().ContainKey("invalid_code");
    }

    private static string TestHash(string value) => Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)));
    private static string TestBase64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
