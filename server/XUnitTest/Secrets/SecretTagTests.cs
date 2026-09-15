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
    /// Tagging and tag-driven lookup.
    /// </summary>
    public class SecretTagTests : IDisposable
    {
        private readonly SecretTestContext _context = new();

        // Captured through Moq rather than read back off the fixture: the service mutates the
        // entity it loaded, so asserting on that instance would pass even if it never wrote.
        private readonly List<Secret> _replaced = [];
        private readonly List<SecretFilter> _filters = [];

        public SecretTagTests()
        {
            SecretTestContext.SignIn();

            _context.Repository
                .Setup(r => r.ReplaceAsync(Capture.In(_replaced), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _context.Repository
                .Setup(r => r.FindAsync(SecretTestContext.TenantId, Capture.In(_filters), It.IsAny<CancellationToken>()))
                .ReturnsAsync((Array.Empty<Secret>(), 0L));
        }

        public void Dispose()
        {
            SecretTestContext.SignOut();
            GC.SuppressFinalize(this);
        }

        #region Normalization

        [Theory]
        [InlineData("Prod", "prod")]
        [InlineData("  Payments  ", "payments")]
        [InlineData("ENV:PROD", "env:prod")]
        [InlineData(null, "")]
        [InlineData("   ", "")]
        public void ATagIsStoredInItsCanonicalForm(string? input, string expected) =>
            SecretTag.Normalize(input).Should().Be(expected);

        [Fact]
        public void NormalizingASetDropsBlanksAndDuplicatesAndOrdersTheRest()
        {
            var normalized = SecretTag.NormalizeAll(["Prod", " prod ", "", "  ", "payments", "PAYMENTS"]);

            normalized.Should().Equal("payments", "prod");
        }

        [Theory]
        [InlineData("prod", true)]
        [InlineData("env:prod", true)]
        [InlineData("team-payments_v2.1", true)]
        [InlineData("-leading-hyphen", false)]
        [InlineData(":leading-colon", false)]
        [InlineData("has space", false)]
        [InlineData("has/slash", false)]
        [InlineData("", false)]
        public void OnlyWellFormedTagsAreAccepted(string tag, bool expected) =>
            SecretTag.IsWellFormed(tag).Should().Be(expected);

        [Fact]
        public void ATagLongerThanTheLimitIsRejected() =>
            SecretTag.IsWellFormed(new string('a', SecretTag.MaxLength + 1)).Should().BeFalse();

        #endregion

        #region Write

        [Fact]
        public async Task TagsAreNormalizedOnCreate()
        {
            var captured = await CaptureCreatedAsync(new SetSecretRequest
            {
                Name = "stripe-key",
                Value = "sk_live_x",
                Tags = ["Payments", " payments ", "ENV:prod"]
            });

            captured.Tags.Should().Equal("env:prod", "payments");
        }

        [Fact]
        public async Task ASecretWithNoTagsGetsAnEmptyListRatherThanNull()
        {
            var captured = await CaptureCreatedAsync(new SetSecretRequest { Name = "stripe-key", Value = "sk_live_x" });

            captured.Tags.Should().NotBeNull().And.BeEmpty();
        }

        [Fact]
        public async Task AMalformedTagIsRejectedBeforeTheVaultIsTouched()
        {
            var request = new SetSecretRequest { Name = "stripe-key", Value = "sk_live_x", Tags = ["not a tag"] };

            var act = () => _context.Service.SetAsync(request);

            (await act.Should().ThrowAsync<SecretValidationException>()).Which.ReasonCode.Should().Be("TAG_INVALID");
            _context.ValueStore.Verify(v => v.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task MoreTagsThanTheLimitAreRejected()
        {
            var tags = Enumerable.Range(0, SecretTag.MaxPerSecret + 1).Select(i => "tag-" + i).ToArray();
            var request = new SetSecretRequest { Name = "stripe-key", Value = "sk_live_x", Tags = tags };

            var act = () => _context.Service.SetAsync(request);

            (await act.Should().ThrowAsync<SecretValidationException>()).Which.ReasonCode.Should().Be("TOO_MANY_TAGS");
        }

        [Fact]
        public async Task AnUpdateReplacesTheWholeTagSet()
        {
            _context.GivenSecret(tags: ["payments", "env:prod"]);

            await _context.Service.UpdateAsync("secret-1", new UpdateSecretRequest { Tags = ["Billing"] });

            CapturedUpdate().Tags.Should().Equal("billing");
        }

        [Fact]
        public async Task AnUpdateWithNoTagsLeavesTheExistingOnesAlone()
        {
            _context.GivenSecret(tags: ["payments"]);

            await _context.Service.UpdateAsync("secret-1", new UpdateSecretRequest { Description = "renamed" });

            CapturedUpdate().Tags.Should().Equal("payments");
        }

        [Fact]
        public async Task AnUpdateWithAnEmptyTagListClearsThem()
        {
            _context.GivenSecret(tags: ["payments"]);

            await _context.Service.UpdateAsync("secret-1", new UpdateSecretRequest { Tags = [] });

            CapturedUpdate().Tags.Should().BeEmpty();
        }

        [Fact]
        public async Task TagsAreReturnedOnTheMetadataResult()
        {
            _context.GivenSecret(tags: ["payments"]);

            var result = await _context.Service.GetAsync("secret-1");

            result!.Tags.Should().Equal("payments");
        }

        #endregion

        #region Filtering

        [Fact]
        public async Task AListFilterMatchesAnyOfTheGivenTags()
        {
            // Any-of, not all-of: picking a second chip in the filter bar widens the result.
            await _context.Service.FindAsync(new SecretFilter { Tags = ["payments", "mail"] });

            CapturedFilter().Tags.Should().Equal("mail", "payments");
        }

        [Fact]
        public async Task FilterTagsAreNormalizedSoCasingDoesNotMatter()
        {
            await _context.Service.FindAsync(new SecretFilter { Tags = ["Payments", " PAYMENTS ", "MAIL"] });

            CapturedFilter().Tags.Should().Equal("mail", "payments");
        }

        [Fact]
        public async Task AnEmptyTagFilterIsDroppedRatherThanMatchingNothing()
        {
            await _context.Service.FindAsync(new SecretFilter { Tags = [] });

            CapturedFilter().Tags.Should().BeNull();
        }

        [Fact]
        public async Task AMalformedFilterTagIsNotAnError()
        {
            // A filter value that cannot match anything is an empty result, not a bad request.
            // A filter bar that 400s because of what someone typed is worse than one that
            // shows nothing.
            var act = () => _context.Service.FindAsync(new SecretFilter { Tags = ["not a tag"] });

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task MoreFilterTagsThanTheLimitAreRejected()
        {
            var tags = Enumerable.Range(0, SecretTag.MaxPerFilter + 1).Select(i => "tag-" + i).ToArray();

            var act = () => _context.Service.FindAsync(new SecretFilter { Tags = tags });

            (await act.Should().ThrowAsync<SecretValidationException>()).Which.ReasonCode.Should().Be("TOO_MANY_TAGS");
        }

        #endregion

        #region Catalogue

        [Fact]
        public async Task CreatingASecretAddsItsTagsToTheCatalogue()
        {
            await CaptureCreatedAsync(new SetSecretRequest
            {
                Name = "stripe-key",
                Value = "sk_live_x",
                Tags = ["Payments", "env:prod"]
            });

            _context.RegisteredTags.Should().BeEquivalentTo(["env:prod", "payments"]);
        }

        [Fact]
        public async Task TheCatalogueIsOnlyToldAboutTagsOnceTheSecretExists()
        {
            // A tag someone invented should not appear in the tenant's catalogue if the secret
            // it was for failed to save.
            _context.Repository
                .Setup(r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = () => _context.Service.SetAsync(new SetSecretRequest
            {
                Name = "stripe-key",
                Value = "sk_live_x",
                Tags = ["payments"]
            });

            await act.Should().ThrowAsync<SecretValidationException>();
            _context.RegisteredTags.Should().BeEmpty();
        }

        [Fact]
        public async Task ABatchRegistersItsTagsInOneCall()
        {
            // One catalogue write for the batch, not one per secret — the document would
            // otherwise be read and rewritten once for every item.
            await _context.Service.SetManyAsync(
            [
                new SetSecretRequest { Name = "stripe-key", Value = "a", Tags = ["payments"] },
                new SetSecretRequest { Name = "smtp-key", Value = "b", Tags = ["mail"] },
            ]);

            _context.TagCatalog.Verify(
                c => c.RegisterAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()), Times.Once);
            _context.RegisteredTags.Should().BeEquivalentTo(["payments", "mail"]);
        }

        [Fact]
        public async Task UpdatingTagsAddsTheNewOnesToTheCatalogue()
        {
            _context.GivenSecret(tags: ["payments"]);

            await _context.Service.UpdateAsync("secret-1", new UpdateSecretRequest { Tags = ["billing"] });

            _context.RegisteredTags.Should().Equal("billing");
        }

        [Fact]
        public async Task AnUpdateThatDoesNotTouchTagsLeavesTheCatalogueAlone()
        {
            _context.GivenSecret(tags: ["payments"]);

            await _context.Service.UpdateAsync("secret-1", new UpdateSecretRequest { Description = "renamed" });

            _context.TagCatalog.Verify(
                c => c.RegisterAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task TheCatalogueIsServedThroughTheServiceEntryPoint()
        {
            _context.TagCatalog
                .Setup(c => c.GetAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync([new SecretTagEntry { Key = "iam", Label = "Blocks Iam" }]);

            var tags = await _context.Service.GetTagsAsync();

            tags.Should().ContainSingle().Which.Label.Should().Be("Blocks Iam");
        }

        #endregion

        #region Fixture helpers

        private async Task<Secret> CaptureCreatedAsync(SetSecretRequest request)
        {
            Secret? captured = null;
            _context.Repository
                .Setup(r => r.InsertAsync(It.IsAny<Secret>(), It.IsAny<CancellationToken>()))
                .Callback<Secret, CancellationToken>((secret, _) => captured = secret)
                .Returns(Task.CompletedTask);

            await _context.Service.SetAsync(request);

            captured.Should().NotBeNull();
            return captured!;
        }

        /// <summary>The entity as it was handed to <c>ReplaceAsync</c>.</summary>
        private Secret CapturedUpdate() => _replaced.Should().ContainSingle().Subject;

        /// <summary>The filter the service built for the repository.</summary>
        private SecretFilter CapturedFilter() => _filters.Should().ContainSingle().Subject;

        #endregion
    }
}
