using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Actions;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Webhooks;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Webhooks
{
    public class WebhookServiceTests
    {
        private const string Secret = "a-very-long-signing-secret-of-40-chars!!";
        private const string KnownAction = "iam.user.created";

        private readonly Mock<IWebhookRepository> _webhooks = new();
        private readonly Mock<IActionsRepository> _actions = new();
        private readonly InMemoryWebhookSecretStore _secrets = new();
        private readonly TableDnsResolver _dns = new();

        public WebhookServiceTests()
        {
            _actions.Setup(a => a.GetAllAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<ActionDefinition> { new() { Name = KnownAction, Webhook = true } });
            _webhooks.Setup(w => w.InsertAsync(It.IsAny<WebhookEntry>(), It.IsAny<CancellationToken>()))
                .Callback(() => _secrets.Calls.Add("kv.insert"))
                .ReturnsAsync(WebhookWriteResult.Written);
        }

        private WebhookService Service() => new(
            _webhooks.Object, _actions.Object, _secrets, new WebhookAddressGuard(_dns), new FixedTimeProvider(), NullLogger<WebhookService>.Instance);

        private static SaveWebhookRequest Create(string? secret = Secret, string url = "https://hooks.example.com/in") => new()
        {
            Name = "CRM sync",
            Url = url,
            Secret = secret,
            Actions = [KnownAction]
        };

        private static WebhookEntry Stored(string id = "w1") => new()
        {
            Id = id, Name = "CRM sync", NameKey = "CRM SYNC", Url = "https://hooks.example.com/in",
            SecretRef = "old-secret", IsActive = true, Actions = [KnownAction]
        };

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("short-secret")]
        public async Task Create_WithoutALongEnoughSecret_SavesNothing(string? secret)
        {
            var outcome = await Service().SaveAsync(Create(secret), CancellationToken.None);

            outcome.ErrorCode.Should().Be(WebhookErrorCodes.SecretRequired);
            _secrets.Values.Should().BeEmpty();
            _webhooks.Verify(w => w.InsertAsync(It.IsAny<WebhookEntry>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Create_StoresTheSecretFirst_AndKvKeepsOnlyItsId()
        {
            WebhookEntry? saved = null;
            _webhooks.Setup(w => w.InsertAsync(It.IsAny<WebhookEntry>(), It.IsAny<CancellationToken>()))
                .Callback<WebhookEntry, CancellationToken>((e, _) => { saved = e; _secrets.Calls.Add("kv.insert"); })
                .ReturnsAsync(WebhookWriteResult.Written);

            var outcome = await Service().SaveAsync(Create(), CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            _secrets.Calls.Should().Equal("secret.create", "kv.insert");
            saved!.SecretRef.Should().Be("sec-1");
            JsonSerializer.Serialize(saved).Should().NotContain(Secret);
        }

        [Fact]
        public async Task Create_KvWriteFails_DeletesTheNewSecret()
        {
            _webhooks.Setup(w => w.InsertAsync(It.IsAny<WebhookEntry>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new TimeoutException("mongo"));

            var act = () => Service().SaveAsync(Create(), CancellationToken.None);

            await act.Should().ThrowAsync<TimeoutException>();
            _secrets.Retired.Should().Equal("sec-1");
        }

        [Fact]
        public async Task Create_NameTaken_RefusesAndDeletesTheNewSecret()
        {
            _webhooks.Setup(w => w.InsertAsync(It.IsAny<WebhookEntry>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(WebhookWriteResult.NameTaken);

            var outcome = await Service().SaveAsync(Create(), CancellationToken.None);

            outcome.ErrorCode.Should().Be(WebhookErrorCodes.NameTaken);
            _secrets.Retired.Should().Equal("sec-1");
        }

        [Fact]
        public async Task Create_SecretStoreFails_SavesNothing()
        {
            _secrets.FailOnCreate = true;

            var act = () => Service().SaveAsync(Create(), CancellationToken.None);

            await act.Should().ThrowAsync<InvalidOperationException>();
            _webhooks.Verify(w => w.InsertAsync(It.IsAny<WebhookEntry>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Theory]
        [InlineData("http://hooks.example.com/in")]
        [InlineData("https://user:pass@hooks.example.com/in")]
        [InlineData("https://127.0.0.1/in")]
        [InlineData("https://169.254.169.254/latest/meta-data")]
        [InlineData("https://[::ffff:10.0.0.1]/in")]
        [InlineData("https://internal.example.com/in")]
        [InlineData("https://unknown-host.example.com/in")]
        public async Task Create_RefusesAUrlThatIsNotHttpsOrNotPublic(string url)
        {
            _dns.Hosts["internal.example.com"] = [IPAddress.Parse("93.184.216.34"), IPAddress.Parse("10.1.2.3")];

            var outcome = await Service().SaveAsync(Create(url: url), CancellationToken.None);

            outcome.ErrorCode.Should().Be(WebhookErrorCodes.UrlNotAllowed);
            _secrets.Values.Should().BeEmpty();
        }

        [Fact]
        public async Task Create_RefusesAnActionTheTenantDoesNotHave()
        {
            var request = Create();
            request.Actions.Add("iam.user.removed");

            var outcome = await Service().SaveAsync(request, CancellationToken.None);

            outcome.ErrorCode.Should().Be(WebhookErrorCodes.ActionNotFound);
        }

        [Fact]
        public async Task Create_RefusesAnActionWhoseWebhookFlagIsOff_ButUpdateKeepsOneTheWebhookAlreadyHas()
        {
            _actions.Setup(a => a.GetAllAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<ActionDefinition> { new() { Name = KnownAction, Webhook = false, Workflow = true } });
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync(Stored());
            _webhooks.Setup(w => w.UpdateAsync(It.IsAny<WebhookUpdate>(), It.IsAny<CancellationToken>())).ReturnsAsync(WebhookWriteResult.Written);

            var created = await Service().SaveAsync(Create(), CancellationToken.None);
            var updateRequest = Create(secret: null);
            updateRequest.Id = "w1";
            var updated = await Service().SaveAsync(updateRequest, CancellationToken.None);

            created.ErrorCode.Should().Be(WebhookErrorCodes.ActionNotFound);
            updated.ErrorCode.Should().NotBe(WebhookErrorCodes.ActionNotFound);
        }

        [Fact]
        public async Task Update_WithoutASecret_KeepsTheStoredOne()
        {
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync(Stored());
            _webhooks.Setup(w => w.UpdateAsync(It.IsAny<WebhookUpdate>(), It.IsAny<CancellationToken>())).ReturnsAsync(WebhookWriteResult.Written);
            var request = Create(secret: null);
            request.Id = "w1";

            var outcome = await Service().SaveAsync(request, CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            _webhooks.Verify(w => w.UpdateAsync(It.Is<WebhookUpdate>(u => u.SecretRef == null), It.IsAny<CancellationToken>()));
            _secrets.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task Update_WithANewSecret_ReplacesTheOldOneAtOnce()
        {
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync(Stored());
            _webhooks.Setup(w => w.UpdateAsync(It.IsAny<WebhookUpdate>(), It.IsAny<CancellationToken>())).ReturnsAsync(WebhookWriteResult.Written);
            var request = Create();
            request.Id = "w1";

            var outcome = await Service().SaveAsync(request, CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            _webhooks.Verify(w => w.UpdateAsync(It.Is<WebhookUpdate>(u => u.SecretRef == "sec-1" && u.SecretChangedDate != null), It.IsAny<CancellationToken>()));
            _secrets.Retired.Should().Equal("old-secret");
        }

        [Fact]
        public async Task Update_WithAShortNewSecret_IsRefused()
        {
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync(Stored());
            var request = Create(secret: "too-short");
            request.Id = "w1";

            var outcome = await Service().SaveAsync(request, CancellationToken.None);

            outcome.ErrorCode.Should().Be(WebhookErrorCodes.SecretRequired);
            _webhooks.Verify(w => w.UpdateAsync(It.IsAny<WebhookUpdate>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Update_OfAMissingWebhook_IsNotFound()
        {
            var request = Create();
            request.Id = "gone";

            var outcome = await Service().SaveAsync(request, CancellationToken.None);

            outcome.Status.Should().Be(OutcomeStatus.NotFound);
            _secrets.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task Gets_NeverReturnsTheSecret()
        {
            _webhooks.Setup(w => w.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new List<WebhookEntry> { Stored() });

            var views = await Service().GetsAsync(CancellationToken.None);

            var json = JsonSerializer.Serialize(views);
            json.Should().NotContain("old-secret").And.NotContain("SecretRef");
            views.Single().SecretSet.Should().BeTrue();
        }

        [Fact]
        public async Task Delete_RemovesTheEntryThenRetiresItsSecret()
        {
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync(Stored());
            _webhooks.Setup(w => w.DeleteAsync("w1", It.IsAny<CancellationToken>())).Callback(() => _secrets.Calls.Add("kv.delete")).ReturnsAsync(true);

            var outcome = await Service().DeleteAsync("w1", CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            _secrets.Calls.Should().Equal("kv.delete", "secret.retire");
            _secrets.Retired.Should().Equal("old-secret");
        }
    }
}
