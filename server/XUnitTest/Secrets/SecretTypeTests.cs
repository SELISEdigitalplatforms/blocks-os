using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Secrets;
using FluentAssertions;
using Moq;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// The three secret types and the four rules that branch on them.
    /// </summary>
    /// <remarks>
    /// Every rule goes through <see cref="SecretTypes.HasAccessList"/>, so these cases are what
    /// keeps the four from drifting apart: a create that stores an access list, an
    /// <c>UpdateAccessAsync</c> that is applicable, a value read that consults the list, and a
    /// metadata mutation that does.
    /// </remarks>
    public class SecretTypeTests : IDisposable
    {
        private readonly SecretTestContext _context = new();
        private readonly List<Secret> _inserted = [];

        public SecretTypeTests()
        {
            SecretTestContext.SignIn();

            _context.Repository
                .Setup(r => r.InsertAsync(Capture.In(_inserted), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        }

        public void Dispose()
        {
            SecretTestContext.SignOut();
            GC.SuppressFinalize(this);
        }

        #region The predicate

        [Theory]
        [InlineData(SecretTypes.Api, true)]
        [InlineData(SecretTypes.Service, false)]
        [InlineData(SecretTypes.Both, false)]
        public void OnlyAnApplicationSecretCarriesAnAccessList(string type, bool expected) =>
            SecretTypes.HasAccessList(type).Should().Be(expected);

        [Theory]
        [InlineData(SecretTypes.Api)]
        [InlineData(SecretTypes.Service)]
        [InlineData(SecretTypes.Both)]
        public void AllThreeTypesAreAccepted(string type) =>
            SecretTypes.IsValid(type).Should().BeTrue();

        [Theory]
        [InlineData("platform")]
        [InlineData("Both")]
        [InlineData("")]
        [InlineData(null)]
        public void AnythingElseIsNot(string? type) =>
            SecretTypes.IsValid(type).Should().BeFalse();

        [Fact]
        public async Task AnUnknownTypeIsRejectedOnCreate()
        {
            var act = () => _context.Service.SetAsync(new SetSecretRequest
            {
                Name = "stripe-key",
                Value = "sk_live_x",
                Type = "platform"
            });

            (await act.Should().ThrowAsync<SecretValidationException>()).Which.ReasonCode.Should().Be("INVALID_TYPE");
        }

        #endregion

        #region Create

        [Fact]
        public async Task ABothSecretIsNotStoredWithAnAccessList()
        {
            // A stored list would imply a check that is never performed for this type.
            await _context.Service.SetAsync(new SetSecretRequest
            {
                Name = "shared-key",
                Value = "sk_live_x",
                Type = SecretTypes.Both,
                Access = new SecretAccess { UserIds = { "user-1" }, Roles = { "admin" } }
            });

            _inserted.Should().ContainSingle().Which.Access.Should().BeNull();
        }

        [Fact]
        public async Task AnApplicationSecretKeepsTheAccessListItWasGiven()
        {
            await _context.Service.SetAsync(new SetSecretRequest
            {
                Name = "stripe-key",
                Value = "sk_live_x",
                Type = SecretTypes.Api,
                Access = new SecretAccess { UserIds = { "user-2" } }
            });

            _inserted.Should().ContainSingle().Which.Access!.UserIds.Should().Equal("user-2");
        }

        #endregion

        #region Value read

        [Fact]
        public async Task ABothSecretsValueIsReadableByAnyoneInTheTenant()
        {
            // The point of the type: a platform credential a person is also meant to see.
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(type: SecretTypes.Both, createdBy: "someone-else");

            var value = await _context.Service.GetValueAsync("secret-1");

            value.Should().Be("hunter2");
        }

        [Fact]
        public async Task AnApplicationSecretsValueStillNeedsTheAccessList()
        {
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(type: SecretTypes.Api, createdBy: "someone-else");

            var act = () => _context.Service.GetValueAsync("secret-1");

            (await act.Should().ThrowAsync<SecretAccessDeniedException>())
                .Which.ReasonCode.Should().Be(SecretAuditReasons.NotInAccessList);
        }

        [Fact]
        public async Task LockingStillBindsABothSecret()
        {
            // Status gates come before the type check, and bind every type and root alike.
            _context.GivenSecret(type: SecretTypes.Both, status: SecretStatuses.Locked);

            var act = () => _context.Service.GetValueAsync("secret-1");

            await act.Should().ThrowAsync<SecretStateException>();
        }

        [Fact]
        public async Task ReadingABothSecretIsStillAudited()
        {
            _context.GivenSecret(type: SecretTypes.Both);

            await _context.Service.GetValueAsync("secret-1");

            _context.AuditFor(SecretAuditActions.GetValue).Should().ContainSingle();
        }

        #endregion

        #region Mutation

        [Fact]
        public async Task ABothSecretCanBeEditedByAnyoneInTheTenant()
        {
            // Edit and rotate are offered in the UI for this type, so the domain has to allow
            // them without an access list to consult.
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(type: SecretTypes.Both, createdBy: "someone-else");

            var act = () => _context.Service.UpdateAsync("secret-1", new UpdateSecretRequest { Description = "shared" });

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task ABothSecretCanBeRotatedByAnyoneInTheTenant()
        {
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(type: SecretTypes.Both, createdBy: "someone-else");

            var act = () => _context.Service.RotateAsync("secret-1", new RotateSecretRequest { Value = "new-value" });

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task AnApplicationSecretStillRefusesAMutationFromOutsideTheAccessList()
        {
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(type: SecretTypes.Api, createdBy: "someone-else");

            var act = () => _context.Service.UpdateAsync("secret-1", new UpdateSecretRequest { Description = "mine now" });

            await act.Should().ThrowAsync<SecretAccessDeniedException>();
        }

        [Fact]
        public async Task ABothSecretHasNoAccessListToUpdate()
        {
            _context.GivenSecret(type: SecretTypes.Both);

            var act = () => _context.Service.UpdateAccessAsync("secret-1", new SecretAccess { UserIds = { "user-1" } });

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be(SecretAuditReasons.AccessNotApplicable);
        }

        [Fact]
        public async Task APlatformSecretHasNoAccessListToUpdateEither()
        {
            _context.GivenSecret(type: SecretTypes.Service);

            var act = () => _context.Service.UpdateAccessAsync("secret-1", new SecretAccess { UserIds = { "user-1" } });

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be(SecretAuditReasons.AccessNotApplicable);
        }

        #endregion
    }
}
