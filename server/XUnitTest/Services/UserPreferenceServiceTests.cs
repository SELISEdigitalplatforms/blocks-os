using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Preference;
using DomainService.Preference.Services;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class UserPreferenceServiceTests
    {
        private const string Layout = "{\"favorites\":[\"separator-os/logs\"],\"appOrder\":[]}";
        private const string SidebarKeyForUser7 = "user-preference::user-7::sidebar-layout";

        private readonly Mock<IKeyValueStore> _store = new();
        private UserPreferenceService Service() => new(_store.Object, new SaveUserPreferenceRequestValidator());

        [Fact]
        public void StoreKey_NamesTheUserAndTheSetting()
        {
            UserPreferenceService.StoreKey("user-7", UserPreferenceKeys.SidebarLayout).Should().Be(SidebarKeyForUser7);
        }

        [Fact]
        public async Task GetAsync_ReadsTheCallersEntryFromTheRootStore()
        {
            using var _ = new BlocksTestContext(userId: "user-7", impersonated: true);
            _store.Setup(s => s.GetAsync<string>(SidebarKeyForUser7, false, It.IsAny<CancellationToken>())).ReturnsAsync(Layout);

            var response = await Service().GetAsync(new GetUserPreferenceRequest { Key = UserPreferenceKeys.SidebarLayout });

            response.IsSuccess.Should().BeTrue();
            response.Key.Should().Be(UserPreferenceKeys.SidebarLayout);
            response.Value.Should().Be(Layout);
            // Root (impersonated: false), even while the console is inside a project.
            _store.Verify(s => s.GetAsync<string>(It.IsAny<string>(), true, It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetAsync_WhenNeverSaved_SucceedsWithNoValue()
        {
            using var _ = new BlocksTestContext();
            _store.Setup(s => s.GetAsync<string>(It.IsAny<string>(), false, It.IsAny<CancellationToken>())).ReturnsAsync((string?)null);

            var response = await Service().GetAsync(new GetUserPreferenceRequest { Key = UserPreferenceKeys.SidebarLayout });

            response.IsSuccess.Should().BeTrue();
            response.Value.Should().BeNull();
        }

        [Fact]
        public async Task GetAsync_RejectsAnUnknownKeyWithoutReading()
        {
            using var _ = new BlocksTestContext();

            var response = await Service().GetAsync(new GetUserPreferenceRequest { Key = "project-access-catalog" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Key");
            _store.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task GetAsync_WithoutASignedInUser_ReadsNothing()
        {
            var response = await Service().GetAsync(new GetUserPreferenceRequest { Key = UserPreferenceKeys.SidebarLayout });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("user");
            _store.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task SaveAsync_SetsTheCallersEntryInTheRootStore()
        {
            using var _ = new BlocksTestContext(userId: "user-7", impersonated: true);

            var response = await Service().SaveAsync(new SaveUserPreferenceRequest { Key = UserPreferenceKeys.SidebarLayout, Value = Layout });

            response.IsSuccess.Should().BeTrue();
            _store.Verify(s => s.SetAsync(SidebarKeyForUser7, Layout, false, It.IsAny<CancellationToken>()), Times.Once);
            _store.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData("", Layout, "Key")]
        [InlineData("not-a-preference", Layout, "Key")]
        [InlineData(UserPreferenceKeys.SidebarLayout, "", "Value")]
        [InlineData(UserPreferenceKeys.SidebarLayout, "{not json", "Value")]
        public async Task SaveAsync_RejectsAnInvalidRequestWithoutWriting(string key, string value, string field)
        {
            using var _ = new BlocksTestContext();

            var response = await Service().SaveAsync(new SaveUserPreferenceRequest { Key = key, Value = value });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey(field);
            _store.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task SaveAsync_RejectsAValueOverTheSizeLimit()
        {
            using var _ = new BlocksTestContext();
            var tooLong = "\"" + new string('a', UserPreferenceKeys.MaxValueLength) + "\"";

            var response = await Service().SaveAsync(new SaveUserPreferenceRequest { Key = UserPreferenceKeys.SidebarLayout, Value = tooLong });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Value");
            _store.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task SaveAsync_WithoutASignedInUser_WritesNothing()
        {
            var response = await Service().SaveAsync(new SaveUserPreferenceRequest { Key = UserPreferenceKeys.SidebarLayout, Value = Layout });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("user");
            _store.VerifyNoOtherCalls();
        }
    }
}
