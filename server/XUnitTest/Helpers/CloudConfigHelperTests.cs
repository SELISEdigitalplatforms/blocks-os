using Blocks.Genesis;
using CloudConfiguration.DomainService.Shared.Utilities;
using FluentAssertions;

namespace XUnitTest.Helpers
{
    public class CloudConfigHelperTests
    {
        [Theory]
        [InlineData("", "")]
        [InlineData("a", "*")]
        [InlineData("ab", "**")]
        [InlineData("abc", "a*c")]
        [InlineData("region-endpoint", "r*************t")]
        public void GetMaskedCloudStorageRegionEndPoint_MasksMiddle(string input, string expected)
        {
            Helper.GetMaskedCloudStorageRegionEndPoint(input).Should().Be(expected);
        }

        [Fact]
        public void GenerateAesKey_Returns256BitBase64Key()
        {
            var key = Helper.GenerateAesKey();

            var bytes = System.Convert.FromBase64String(key);
            bytes.Should().HaveCount(32);
        }

        [Fact]
        public void GenerateAesKey_ReturnsUniqueKeys()
        {
            Helper.GenerateAesKey().Should().NotBe(Helper.GenerateAesKey());
        }

        [Fact]
        public void EncryptThenTryDecrypt_RoundTrips()
        {
            var key = Helper.GenerateAesKey();
            var cipher = Helper.Encrypt("secret-value", key);

            cipher.Should().NotBe("secret-value");

            var ok = Helper.TryDecrypt(cipher, key, out var result);

            ok.Should().BeTrue();
            result.Should().Be("secret-value");
        }

        [Fact]
        public void TryDecrypt_WithWrongKey_ReturnsFalse()
        {
            var key = Helper.GenerateAesKey();
            var wrongKey = Helper.GenerateAesKey();
            var cipher = Helper.Encrypt("secret-value", key);

            var ok = Helper.TryDecrypt(cipher, wrongKey, out var result);

            ok.Should().BeFalse();
            result.Should().BeEmpty();
        }

        [Fact]
        public void TryDecrypt_WithGarbage_ReturnsFalse()
        {
            var ok = Helper.TryDecrypt("not-base64!!!", Helper.GenerateAesKey(), out var result);

            ok.Should().BeFalse();
            result.Should().BeEmpty();
        }

        [Theory]
        [InlineData("amqp://guest:guest@localhost:5672")]
        [InlineData("amqps://guest:guest@localhost:5671")]
        public void GetMessageConfiguration_ForRabbitMq_ReturnsRabbitMqConfig(string connectionString)
        {
            var config = Constants.GetMessageConfiguration(connectionString);

            config.RabbitMqConfiguration.Should().NotBeNull();
            config.AzureServiceBusConfiguration.Should().BeNull();
        }

        [Theory]
        [InlineData("Endpoint=sb://ns.servicebus.windows.net/;SharedAccessKeyName=x;SharedAccessKey=y")]
        [InlineData("some-non-amqp-string")]
        public void GetMessageConfiguration_ForNonRabbitMq_ReturnsAzureConfig(string connectionString)
        {
            var config = Constants.GetMessageConfiguration(connectionString);

            config.AzureServiceBusConfiguration.Should().NotBeNull();
            config.RabbitMqConfiguration.Should().BeNull();
        }
    }
}
