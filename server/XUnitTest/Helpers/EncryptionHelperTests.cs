using DomainService.Shared;
using FluentAssertions;

namespace XUnitTest.Helpers
{
    public class EncryptionHelperTests
    {
        [Theory]
        [InlineData("hello world", "short-key")]
        [InlineData("some-connection-string;key=value", "this-is-a-longer-key-than-thirty-two-characters")]
        [InlineData("a", "k")]
        public void EncryptThenDecrypt_RoundTrips(string plainText, string key)
        {
            var cipher = EncryptionHelper.Encrypt(plainText, key);

            cipher.Should().NotBe(plainText);
            EncryptionHelper.Decrypt(cipher, key).Should().Be(plainText);
        }

        [Fact]
        public void Encrypt_ProducesDifferentCipherEachCall_DueToRandomIv()
        {
            var a = EncryptionHelper.Encrypt("payload", "key");
            var b = EncryptionHelper.Encrypt("payload", "key");

            a.Should().NotBe(b);
            EncryptionHelper.Decrypt(a, "key").Should().Be("payload");
            EncryptionHelper.Decrypt(b, "key").Should().Be("payload");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void Encrypt_WithNullOrEmpty_ReturnsInput(string? input)
        {
            EncryptionHelper.Encrypt(input!, "key").Should().Be(input);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void Decrypt_WithNullOrEmpty_ReturnsInput(string? input)
        {
            EncryptionHelper.Decrypt(input!, "key").Should().Be(input);
        }
    }
}
