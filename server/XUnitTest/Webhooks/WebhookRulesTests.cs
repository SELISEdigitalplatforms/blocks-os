using System;
using System.Net;
using System.Text.Json;
using Blocks.Genesis;
using Configuration.DomainService.Webhooks;
using FluentAssertions;

namespace XUnitTest.Webhooks
{
    public class WebhookRulesTests
    {
        [Theory]
        [InlineData("127.0.0.1")]
        [InlineData("10.0.0.1")]
        [InlineData("172.16.5.4")]
        [InlineData("192.168.1.1")]
        [InlineData("169.254.169.254")]
        [InlineData("100.64.0.1")]
        [InlineData("0.0.0.0")]
        [InlineData("224.0.0.1")]
        [InlineData("255.255.255.255")]
        [InlineData("::1")]
        [InlineData("::")]
        [InlineData("fd00::1")]
        [InlineData("fe80::1")]
        [InlineData("ff02::1")]
        [InlineData("::ffff:127.0.0.1")]
        [InlineData("::ffff:169.254.169.254")]
        [InlineData("64:ff9b::a00:1")]
        public void AddressPolicy_RefusesNonPublicAddresses(string address) =>
            WebhookAddressPolicy.IsPublic(IPAddress.Parse(address)).Should().BeFalse();

        [Theory]
        [InlineData("93.184.216.34")]
        [InlineData("8.8.8.8")]
        [InlineData("2606:4700:4700::1111")]
        [InlineData("::ffff:8.8.8.8")]
        public void AddressPolicy_AllowsPublicAddresses(string address) =>
            WebhookAddressPolicy.IsPublic(IPAddress.Parse(address)).Should().BeTrue();

        /// <summary>The test vector of the Standard Webhooks reference libraries (standard-webhooks/standard-webhooks).</summary>
        [Fact]
        public void Signature_MatchesTheStandardWebhooksVector_ForAWhsecSecret() =>
            WebhookSignature.Sign("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw", "msg_p5jXN8AQM9LWM0D4loKWxJek", 1614265330, "{\"test\": 2432232314}")
                .Should().Be("v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");

        /// <summary>A secret without the prefix is used as its UTF-8 bytes (value computed independently with Python hmac).</summary>
        [Fact]
        public void Signature_UsesThePlainSecretAsUtf8Bytes() =>
            WebhookSignature.Sign("plain-secret-value-that-is-long-enough-123", "evt_1", 1793606400, "{\"id\":\"evt_1\"}")
                .Should().Be("v1,TXLowVgguYqC2hQWUHZAXimliLxQBu0zfm6dlBs04XU=");

        [Theory]
        [InlineData("whsec_not base64 at all, but long enough!!", false)]
        [InlineData("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw", true)]
        [InlineData("31-characters-long-secret-value", false)]
        public void Signature_SecretIsUsableOnlyWhenLongAndWellFormed(string secret, bool usable) =>
            WebhookSignature.IsUsable(secret).Should().Be(usable);

        [Fact]
        public void EventBody_HasExactlyTheFivePublicFields_WithDataAsAnObject()
        {
            var body = WebhookEventBody.From(new BlocksAction
            {
                Id = "evt_01",
                Action = "iam.organization.created",
                Time = new DateTime(2026, 11, 4, 9, 20, 0, DateTimeKind.Utc),
                OrganizationId = null,
                DataJson = "{\"organizationId\":\"org_9e7\",\"createdFrom\":\"Cloud\"}"
            });

            body.Should().Be("{\"id\":\"evt_01\",\"action\":\"iam.organization.created\",\"time\":\"2026-11-04T09:20:00.000Z\","
                + "\"organizationId\":null,\"data\":{\"organizationId\":\"org_9e7\",\"createdFrom\":\"Cloud\"}}");
        }

        [Fact]
        public void EventBody_BrokenData_IsSentAsAnEmptyObject()
        {
            var body = WebhookEventBody.Build("evt_02", "x", DateTime.UtcNow, "org_1", "not json");

            JsonDocument.Parse(body).RootElement.GetProperty("data").GetRawText().Should().Be("{}");
        }
    }
}
