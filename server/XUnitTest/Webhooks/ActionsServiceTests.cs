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

        [Fact]
        public async Task Update_SetsOnlyTheFlagOfTheNamedTarget()
        {
            _repository.Setup(r => r.SetFlagAsync("iam.user.created", "Webhook", true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(ActionFlagUpdate.Updated);

            var outcome = await Service().UpdateAsync(new UpdateActionRequest { Name = "iam.user.created", Target = "WebHook", Enabled = true }, CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            _repository.Verify(r => r.SetFlagAsync("iam.user.created", "Webhook", true, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(ActionFlagUpdate.ActionNotFound, ActionErrorCodes.ActionNotFound)]
        [InlineData(ActionFlagUpdate.NotSeeded, ActionErrorCodes.ActionsNotSeeded)]
        public async Task Update_RefusesAnUnknownActionOrAMissingList(ActionFlagUpdate stored, string expectedCode)
        {
            _repository.Setup(r => r.SetFlagAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(stored);

            var outcome = await Service().UpdateAsync(new UpdateActionRequest { Name = "nope", Target = "workflow", Enabled = true }, CancellationToken.None);

            outcome.Status.Should().Be(OutcomeStatus.BadRequest);
            outcome.ErrorCode.Should().Be(expectedCode);
        }

        [Fact]
        public async Task Update_RefusesAnUnknownTarget_WithoutWriting()
        {
            var outcome = await Service().UpdateAsync(new UpdateActionRequest { Name = "iam.user.created", Target = "email", Enabled = true }, CancellationToken.None);

            outcome.ErrorCode.Should().Be(ActionErrorCodes.InvalidTarget);
            _repository.VerifyNoOtherCalls();
        }
    }
}
