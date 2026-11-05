using Blocks.Genesis;
using System.Threading;
using System.Threading.Tasks;
using Configuration.DomainService.Actions;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Webhooks
{
    public class ActionsServiceTests
    {
        private readonly Mock<IActionsRepository> _repository = new();

        private ActionsService Service() => new(_repository.Object, NullLogger<ActionsService>.Instance);

        private static readonly ActionDefinition Catalog = new() { Name = "iam.user.created", Label = "Created", Service = "iam" };

        [Fact]
        public async Task Update_Enable_SendsTheCatalogEntryAndOnlyTheNamedFlag()
        {
            _repository.Setup(r => r.GetCatalogAsync(It.IsAny<CancellationToken>())).ReturnsAsync([Catalog]);
            _repository.Setup(r => r.EnableAsync(Catalog, "Webhook", It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var outcome = await Service().UpdateAsync(new UpdateActionRequest { Name = "iam.user.created", Target = "WebHook", Enabled = true }, CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            _repository.Verify(r => r.EnableAsync(Catalog, "Webhook", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Update_Enable_WhenConcurrentRemovalsKeepWinning_IsAConflict()
        {
            _repository.Setup(r => r.GetCatalogAsync(It.IsAny<CancellationToken>())).ReturnsAsync([Catalog]);
            _repository.Setup(r => r.EnableAsync(It.IsAny<ActionDefinition>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

            var outcome = await Service().UpdateAsync(new UpdateActionRequest { Name = "iam.user.created", Target = "workflow", Enabled = true }, CancellationToken.None);

            outcome.Status.Should().Be(OutcomeStatus.Conflict);
            outcome.ErrorCode.Should().Be(ActionErrorCodes.UpdateConflict);
        }

        [Fact]
        public async Task Update_Disable_CallsDisableOnly()
        {
            _repository.Setup(r => r.GetCatalogAsync(It.IsAny<CancellationToken>())).ReturnsAsync([Catalog]);

            var outcome = await Service().UpdateAsync(new UpdateActionRequest { Name = "iam.user.created", Target = "function", Enabled = false }, CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            _repository.Verify(r => r.DisableAsync("iam.user.created", "Function", It.IsAny<CancellationToken>()), Times.Once);
            _repository.Verify(r => r.EnableAsync(It.IsAny<ActionDefinition>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Update_RefusesAMissingCatalog_AndANameNotInIt()
        {
            var service = Service();
            var request = new UpdateActionRequest { Name = "iam.user.created", Target = "workflow", Enabled = true };

            (await service.UpdateAsync(request, CancellationToken.None)).ErrorCode.Should().Be(ActionErrorCodes.ActionsNotSeeded);

            _repository.Setup(r => r.GetCatalogAsync(It.IsAny<CancellationToken>())).ReturnsAsync([new ActionDefinition { Name = "other" }]);
            (await service.UpdateAsync(request, CancellationToken.None)).ErrorCode.Should().Be(ActionErrorCodes.ActionNotFound);
            _repository.Verify(r => r.EnableAsync(It.IsAny<ActionDefinition>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Update_RefusesAnUnknownTarget_WithoutWriting()
        {
            var outcome = await Service().UpdateAsync(new UpdateActionRequest { Name = "iam.user.created", Target = "email", Enabled = true }, CancellationToken.None);

            outcome.ErrorCode.Should().Be(ActionErrorCodes.InvalidTarget);
            _repository.Verify(r => r.GetCatalogAsync(It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
