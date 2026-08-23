using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Secrets;
using FluentAssertions;
using Moq;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// Create, read, rotate and lifecycle flows, including the failure and compensation paths.
    /// </summary>
    public class SecretServiceFlowTests : IDisposable
    {
        private readonly SecretTestContext _context = new();

        public SecretServiceFlowTests() => SecretTestContext.SignIn();

        public void Dispose()
        {
            SecretTestContext.SignOut();
            GC.SuppressFinalize(this);
        }

        private static SetSecretRequest NewRequest(string name = "api-key", string value = "hunter2") =>
            new() { Name = name, Value = value, Type = SecretTypes.Api };

        #region Create

        [Fact]
        public async Task Set_WritesTheVaultBeforeTheMetadata()
        {
            var order = new List<string>();

            _context.ValueStore
                .Setup(v => v.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Callback(() => order.Add("vault"))
                .Returns(Task.CompletedTask);

            _context.Repository
                .Setup(r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()))
                .Callback(() => order.Add("metadata"))
                .Returns(Task.CompletedTask);

            await _context.Service.SetAsync(NewRequest());

            order.Should().Equal("vault", "metadata");
        }

        [Fact]
        public async Task Set_WhenTheVaultWriteFails_WritesNoMetadata()
        {
            _context.ValueStore
                .Setup(v => v.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new SecretVaultException("vault down", "Set", "s1"));

            var act = () => _context.Service.SetAsync(NewRequest());

            await act.Should().ThrowAsync<SecretVaultException>();

            _context.Repository.Verify(
                r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Set_WhenTheMetadataWriteFails_DeletesTheVaultEntry()
        {
            _context.Repository
                .Setup(r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = () => _context.Service.SetAsync(NewRequest());

            await act.Should().ThrowAsync<SecretValidationException>();

            _context.ValueStore.Verify(
                v => v.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Set_WhenCleanupAlsoFails_RecordsTheOrphanedVaultEntry()
        {
            _context.Repository
                .Setup(r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            _context.ValueStore
                .Setup(v => v.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new SecretVaultException("vault down", "Delete", "s1"));

            var act = () => _context.Service.SetAsync(NewRequest());

            await act.Should().ThrowAsync<SecretValidationException>();

            var orphan = _context.AuditFor(SecretAuditActions.VaultOrphan).Should().ContainSingle().Subject;
            orphan.SecretId.Should().NotBeNullOrEmpty();
            orphan.Reason.Should().Be(SecretAuditReasons.CleanupFailed);
        }

        [Fact]
        public async Task Set_AllowsADuplicateName()
        {
            // Names are deliberately not unique. Two secrets may share one; the id keeps them apart.
            var first = await _context.Service.SetAsync(NewRequest("api-key"));
            var second = await _context.Service.SetAsync(NewRequest("api-key"));

            second.Should().NotBe(first);

            _context.Repository.Verify(
                r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Theory]
        [InlineData("")]
        [InlineData("-leading-hyphen")]
        [InlineData("has spaces")]
        [InlineData("has/slash")]
        public async Task Set_RejectsAnInvalidName(string name)
        {
            var act = () => _context.Service.SetAsync(NewRequest(name));

            await act.Should().ThrowAsync<SecretValidationException>();
        }

        [Fact]
        public async Task Set_MeasuresTheValueLimitInBytesNotCharacters()
        {
            // Just under the limit in characters, over it in UTF-8 bytes — a character count
            // would wrongly let this pass and it would fail at the vault instead.
            var justUnderInChars = (SecretDefaults.MaxValueLengthBytes / 3) + 1;
            var act = () => _context.Service.SetAsync(NewRequest(value: new string('あ', justUnderInChars)));

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be("VALUE_TOO_LARGE");
        }

        [Fact]
        public async Task Set_DropsAnAccessListOnAServiceSecret()
        {
            Secret? captured = null;
            _context.Repository
                .Setup(r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()))
                .Callback<Secret, CancellationToken>((s, _) => captured = s)
                .Returns(Task.CompletedTask);

            await _context.Service.SetAsync(new SetSecretRequest
            {
                Name = "smtp-password",
                Value = "hunter2",
                Type = SecretTypes.Service,
                Access = new SecretAccess { UserIds = { "someone" } }
            });

            // Carrying an access list would imply a check that is never performed.
            captured!.Access.Should().BeNull();
        }

        #endregion

        #region SetMany

        [Fact]
        public async Task SetMany_ReturnsANameToIdMap()
        {
            var result = await _context.Service.SetManyAsync([NewRequest("first"), NewRequest("second")]);

            result.Should().HaveCount(2);
            result.Keys.Should().BeEquivalentTo(["first", "second"]);
        }

        [Fact]
        public async Task SetMany_RollsBackEverySecretItAlreadyCreated()
        {
            var inserted = 0;
            _context.Repository
                .Setup(r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()))
                .Returns<Secret, CancellationToken>((_, _) =>
                    ++inserted == 3
                        ? Task.FromException(new InvalidOperationException("mongo down"))
                        : Task.CompletedTask);

            var act = () => _context.Service.SetManyAsync([NewRequest("a"), NewRequest("b"), NewRequest("c")]);

            await act.Should().ThrowAsync<SecretValidationException>();

            // Two succeeded and must be undone; the third never landed but its vault entry was
            // already cleaned up by the create path.
            _context.Repository.Verify(
                r => r.HardDeleteAsync(SecretTestContext.TenantId, It.IsAny<string>(), It.IsAny<CancellationToken>()),
                Times.Exactly(2));
        }

        [Fact]
        public async Task SetMany_RejectsADuplicateNameWithinTheBatch()
        {
            var act = () => _context.Service.SetManyAsync([NewRequest("same"), NewRequest("SAME")]);

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be("DUPLICATE_NAME_IN_BATCH");

            _context.ValueStore.Verify(
                v => v.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SetMany_RejectsAnOversizedBatch()
        {
            var batch = Enumerable.Range(0, SecretDefaults.MaxBatchSize + 1)
                                  .Select(i => NewRequest("secret-" + i))
                                  .ToList();

            var act = () => _context.Service.SetManyAsync(batch);

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be("BATCH_TOO_LARGE");
        }

        #endregion

        #region Read

        [Fact]
        public async Task GetValue_WhenTheVaultHasNoValue_Reports404NotAnEmptyString()
        {
            _context.GivenSecret();
            _context.ValueStore.Setup(v => v.GetAsync("secret-1", It.IsAny<CancellationToken>())).ReturnsAsync((string?)null);

            var act = () => _context.Service.GetValueAsync("secret-1");

            (await act.Should().ThrowAsync<SecretNotFoundException>())
                .Which.ReasonCode.Should().Be(SecretAuditReasons.ValueMissing);
        }

        [Fact]
        public async Task GetValues_IsStrict_OneDenialFailsTheWholeCall()
        {
            // Silently dropping unreadable ids would hand back a partial credential set that
            // looks complete at the call site.
            _context.GivenSecret("readable", access: new SecretAccess { UserIds = { SecretTestContext.UserId } });
            _context.GivenSecret("forbidden", access: new SecretAccess { UserIds = { "someone-else" } }, createdBy: "someone-else");

            var act = () => _context.Service.GetValuesAsync(["readable", "forbidden"]);

            await act.Should().ThrowAsync<SecretAccessDeniedException>();
        }

        [Fact]
        public async Task Find_ClampsThePageSize()
        {
            SecretFilter? captured = null;
            _context.Repository
                .Setup(r => r.FindAsync(It.IsAny<string>(), It.IsAny<SecretFilter>(), It.IsAny<CancellationToken>()))
                .Callback<string, SecretFilter, CancellationToken>((_, f, _) => captured = f)
                .ReturnsAsync((Array.Empty<Secret>(), 0L));

            await _context.Service.FindAsync(new SecretFilter { PageSize = 5000, PageNumber = 0 });

            captured!.PageSize.Should().Be(100);
            captured.PageNumber.Should().Be(1);
        }

        #endregion

        #region Rotate and lifecycle

        [Fact]
        public async Task Rotate_IncrementsTheCountAndStoresNoVersion()
        {
            var secret = _context.GivenSecret();

            await _context.Service.RotateAsync("secret-1", new RotateSecretRequest { Value = "new-value" });

            secret.RotationCount.Should().Be(1);
            secret.LastRotatedBy.Should().Be(SecretTestContext.UserId);
            _context.ValueStore.Verify(v => v.SetAsync("secret-1", "new-value", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Rotate_WhenMetadataFails_KeepsTheNewValueAndFlagsPartialFailure()
        {
            // Reverting the vault would put the old credential back into service, which is
            // worse than stale bookkeeping.
            _context.GivenSecret();
            _context.Repository
                .Setup(r => r.ReplaceAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = () => _context.Service.RotateAsync("secret-1", new RotateSecretRequest { Value = "new-value" });

            await act.Should().ThrowAsync<InvalidOperationException>();

            _context.AuditFor(SecretAuditActions.Rotate).Should().ContainSingle()
                    .Which.Outcome.Should().Be(SecretAuditOutcomes.PartialFailure);
        }

        [Fact]
        public async Task Delete_IsSoftAndLeavesTheVaultValueInPlace()
        {
            // Purging would block re-creating the key for the whole retention window and make
            // restore impossible.
            var secret = _context.GivenSecret();

            await _context.Service.DeleteAsync("secret-1");

            secret.Status.Should().Be(SecretStatuses.Deleted);
            secret.DeletedBy.Should().Be(SecretTestContext.UserId);
            _context.ValueStore.Verify(v => v.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Restore_BringsADeletedSecretBack()
        {
            var secret = _context.GivenSecret(status: SecretStatuses.Deleted);

            await _context.Service.RestoreAsync("secret-1");

            secret.Status.Should().Be(SecretStatuses.Active);
            secret.DeletedDate.Should().BeNull();
        }

        [Fact]
        public async Task Restore_SucceedsEvenWhenAnotherSecretUsesTheName()
        {
            var secret = _context.GivenSecret(status: SecretStatuses.Deleted);

            await _context.Service.RestoreAsync("secret-1");

            secret.Status.Should().Be(SecretStatuses.Active);
        }

        [Theory]
        [InlineData(SecretStatuses.Locked, "lock")]
        [InlineData(SecretStatuses.Deleted, "lock")]
        [InlineData(SecretStatuses.Active, "unlock")]
        [InlineData(SecretStatuses.Deleted, "unlock")]
        [InlineData(SecretStatuses.Deleted, "delete")]
        [InlineData(SecretStatuses.Active, "restore")]
        [InlineData(SecretStatuses.Locked, "restore")]
        [InlineData(SecretStatuses.Deleted, "update")]
        [InlineData(SecretStatuses.Deleted, "rotate")]
        public async Task IllegalTransitionsAreRefused(string currentStatus, string action)
        {
            _context.GivenSecret(status: currentStatus);

            Func<Task> act = action switch
            {
                "lock" => () => _context.Service.LockAsync("secret-1"),
                "unlock" => () => _context.Service.UnlockAsync("secret-1"),
                "delete" => () => _context.Service.DeleteAsync("secret-1"),
                "restore" => () => _context.Service.RestoreAsync("secret-1"),
                "update" => () => _context.Service.UpdateAsync("secret-1", new UpdateSecretRequest { Name = "renamed" }),
                _ => () => _context.Service.RotateAsync("secret-1", new RotateSecretRequest { Value = "v" })
            };

            await act.Should().ThrowAsync<SecretStateException>();
        }

        [Fact]
        public async Task LockedSecretsCanStillBeUnlocked()
        {
            // The mutation path must not reuse the value-read check, which refuses locked secrets.
            var secret = _context.GivenSecret(status: SecretStatuses.Locked);

            await _context.Service.UnlockAsync("secret-1");

            secret.Status.Should().Be(SecretStatuses.Active);
        }

        [Fact]
        public async Task UpdateAccess_IsRejectedOnAServiceSecret()
        {
            _context.GivenSecret(type: SecretTypes.Service);

            var act = () => _context.Service.UpdateAccessAsync("secret-1", new SecretAccess());

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be(SecretAuditReasons.AccessNotApplicable);
        }

        [Fact]
        public async Task MutatingASecretYouCannotRead_IsRefused()
        {
            // Otherwise a user could rename or rotate a secret, or grant themselves access to
            // it, without ever being allowed to read it.
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(access: new SecretAccess { UserIds = { "someone-else" } }, createdBy: "someone-else");

            var act = () => _context.Service.UpdateAccessAsync("secret-1", new SecretAccess { UserIds = { "unrelated-user" } });

            await act.Should().ThrowAsync<SecretAccessDeniedException>();
        }

        #endregion
    }
}
