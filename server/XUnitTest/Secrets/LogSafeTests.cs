using System;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Secrets;
using Configuration.DomainService.Shared.Secrets;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.TestSupport;
using Xunit;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// <see cref="LogSafe"/>: request-derived ids written to a log lose their line breaks, so they
    /// cannot forge log entries.
    /// </summary>
    public class LogSafeTests
    {
        [Theory]
        [InlineData("cfg-1", "cfg-1")]
        [InlineData("cfg-1\r\nFAKE entry", "cfg-1FAKE entry")]
        [InlineData("\ncfg\r-1\n", "cfg-1")]
        [InlineData("\r\n", "")]
        [InlineData("", "")]
        public void Value_RemovesCarriageReturnsAndLineFeeds(string input, string expected) =>
            LogSafe.Value(input).Should().Be(expected);

        [Fact]
        public void Value_KeepsNull() =>
            LogSafe.Value(null).Should().BeNull();

        [Fact]
        public void Value_LeavesOtherCharactersUntouched() =>
            LogSafe.Value("a\tb c-ü").Should().Be("a\tb c-ü");

        [Fact]
        public async Task ResolveAsync_LogsTheConfigurationIdWithoutLineBreaks()
        {
            var secrets = new Mock<ISecretService>();
            secrets.Setup(s => s.GetAsync("ref-1", It.IsAny<CancellationToken>()))
                   .ThrowsAsync(new InvalidOperationException("ref-1 failed"));
            var logger = new RecordingLogger<LogSafeTests>();

            var status = await LinkedSecretStatus.ResolveAsync(secrets.Object, "ref-1", logger, "mail", "cfg-1\r\nFAKE");

            status.Should().Be(LinkedSecretStatus.Unavailable);
            logger.Entries.Should().ContainSingle();
            var entry = logger.Entries[0];
            entry.Level.Should().Be(LogLevel.Warning);
            entry.Message.Should().Be("Could not check the linked secret of mail configuration cfg-1FAKE (InvalidOperationException).");
            entry.Exception.Should().BeNull();
            entry.Message.Should().NotContain("ref-1");
        }
    }
}
