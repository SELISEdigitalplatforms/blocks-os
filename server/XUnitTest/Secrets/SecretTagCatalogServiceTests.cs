using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// The tag catalogue held in the tenant's <c>keyValueStores</c> collection under
    /// <c>my-secret-tags</c>.
    /// </summary>
    public class SecretTagCatalogServiceTests
    {
        private readonly Mock<IKeyValueStore> _store = new();
        private readonly List<List<SecretTagEntry>> _written = [];
        private readonly SecretTagCatalogService _catalogue;

        public SecretTagCatalogServiceTests()
        {
            _store
                .Setup(s => s.SetAsync(
                    ISecretTagCatalogService.StoreKey,
                    Capture.In(_written),
                    It.IsAny<bool>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _catalogue = new SecretTagCatalogService(_store.Object, NullLogger<SecretTagCatalogService>.Instance);
        }

        #region Read

        [Fact]
        public async Task AMissingDocumentMeansNoSuggestionsRatherThanAnError()
        {
            // The document is seed data a tenant may simply not have yet. A tag picker with no
            // suggestions still works, because the field is free text.
            GivenCatalogue(null);

            var tags = await _catalogue.GetAsync();

            tags.Should().BeEmpty();
        }

        [Fact]
        public async Task AStoreFailureAlsoMeansNoSuggestions()
        {
            // Failing here would take the whole secret list down with it.
            _store
                .Setup(s => s.GetAsync<List<SecretTagEntry>>(
                    ISecretTagCatalogService.StoreKey, It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var tags = await _catalogue.GetAsync();

            tags.Should().BeEmpty();
        }

        [Fact]
        public async Task EntriesComeBackOrderedByLabel()
        {
            GivenCatalogue([Entry("os", "Blocks Logic"), Entry("iam", "Blocks Iam")]);

            var tags = await _catalogue.GetAsync();

            tags.Select(t => t.Label).Should().Equal("Blocks Iam", "Blocks Logic");
        }

        [Fact]
        public async Task AnEntryWithNoKeyIsIgnored()
        {
            GivenCatalogue([Entry("iam", "Blocks Iam"), Entry("", "Broken")]);

            var tags = await _catalogue.GetAsync();

            tags.Should().ContainSingle().Which.Key.Should().Be("iam");
        }

        #endregion

        #region Register

        [Fact]
        public async Task AnUnknownTagIsAddedToTheCatalogue()
        {
            GivenCatalogue([Entry("iam", "Blocks Iam")]);

            await _catalogue.RegisterAsync(["payments"]);

            _written.Should().ContainSingle();
            _written[0].Select(e => e.Key).Should().Equal("iam", "payments");
        }

        [Fact]
        public async Task AKnownTagIsNotWrittenAgain()
        {
            GivenCatalogue([Entry("iam", "Blocks Iam")]);

            await _catalogue.RegisterAsync(["iam", "IAM", " iam "]);

            _written.Should().BeEmpty();
        }

        [Fact]
        public async Task ASeededLabelSurvivesARegistration()
        {
            // An existing key is never rewritten, so a hand-written label is never clobbered by
            // a derived one.
            GivenCatalogue([Entry("iam", "Blocks Iam")]);

            await _catalogue.RegisterAsync(["iam", "payments"]);

            _written[0].Single(e => e.Key == "iam").Label.Should().Be("Blocks Iam");
        }

        [Fact]
        public async Task ANewTagGetsALabelDerivedFromItsKey()
        {
            GivenCatalogue([]);

            await _catalogue.RegisterAsync(["payments-team", "env:prod", "iam"]);

            _written[0].Select(e => e.Label).Should().BeEquivalentTo(["Payments Team", "Env Prod", "Iam"]);
        }

        [Fact]
        public async Task RegisteringNothingDoesNotTouchTheStore()
        {
            await _catalogue.RegisterAsync([]);

            _store.Verify(s => s.GetAsync<List<SecretTagEntry>>(
                It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
            _written.Should().BeEmpty();
        }

        [Fact]
        public async Task BlankTagsAreDroppedRatherThanStored()
        {
            GivenCatalogue([]);

            await _catalogue.RegisterAsync(["", "   ", "payments"]);

            _written[0].Select(e => e.Key).Should().Equal("payments");
        }

        [Fact]
        public async Task AFailedCatalogueWriteIsSwallowed()
        {
            // This runs after the secret is already saved. The tag is on the secret either way,
            // and the next write of it adds the entry — not worth failing a completed create.
            GivenCatalogue([]);
            _store
                .Setup(s => s.SetAsync(
                    It.IsAny<string>(), It.IsAny<List<SecretTagEntry>>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = () => _catalogue.RegisterAsync(["payments"]);

            await act.Should().NotThrowAsync();
        }

        #endregion

        private static SecretTagEntry Entry(string key, string label) => new() { Key = key, Label = label };

        private void GivenCatalogue(List<SecretTagEntry>? entries) =>
            _store
                .Setup(s => s.GetAsync<List<SecretTagEntry>>(
                    ISecretTagCatalogService.StoreKey, It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(entries);
    }
}
