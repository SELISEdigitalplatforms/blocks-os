using Cloud.LmtService.Utilities;
using FluentAssertions;

namespace XUnitTest.Utilities
{
    public class LogRedactorTests
    {
        [Fact]
        public void Redact_EmailAddress_IsMasked()
        {
            var input = "User login failed for jane.doe@example.com on attempt 3";

            var result = LogRedactor.Redact(input);

            result.Should().Be("User login failed for ***REDACTED*** on attempt 3");
        }

        [Fact]
        public void Redact_BearerToken_IsMasked()
        {
            var input = "Authorization header: Bearer abc123.def456-ghi_789";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Authorization header: ***REDACTED***");
        }

        [Fact]
        public void Redact_StandaloneJwt_IsMasked()
        {
            var input = "Token received: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c and stored";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Token received: ***REDACTED*** and stored");
        }

        [Fact]
        public void Redact_JsonPassword_MasksValueButKeepsKey()
        {
            var input = "Payload: {\"username\": \"bob\", \"password\": \"secret123\"}";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Payload: {\"username\": \"bob\", \"password\": \"***REDACTED***\"}");
        }

        [Fact]
        public void Redact_JsonPasswordNoSpaceAfterColon_MasksValueButKeepsKey()
        {
            var input = "{\"pwd\":\"secret123\"}";

            var result = LogRedactor.Redact(input);

            result.Should().Be("{\"pwd\":\"***REDACTED***\"}");
        }

        [Fact]
        public void Redact_QueryStringPassword_MasksValueButKeepsKey()
        {
            var input = "Request to /login?user=bob&password=secret123&remember=true failed";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Request to /login?user=bob&password=***REDACTED***&remember=true failed");
        }

        [Fact]
        public void Redact_ConnectionStringPassword_MasksPasswordSegment()
        {
            var input = "Server=myServer;Database=myDb;Password=SuperSecret1;Trusted_Connection=False;";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Server=myServer;Database=myDb;Password=***REDACTED***;Trusted_Connection=False;");
        }

        [Theory]
        [InlineData("Card on file: 4111 1111 1111 1111 expires soon", "Card on file: ***REDACTED*** expires soon")]
        [InlineData("Card on file: 4111-1111-1111-1111 expires soon", "Card on file: ***REDACTED*** expires soon")]
        [InlineData("Card on file: 4111111111111111 expires soon", "Card on file: ***REDACTED*** expires soon")]
        public void Redact_CreditCardNumber_IsMasked(string input, string expected)
        {
            var result = LogRedactor.Redact(input);

            result.Should().Be(expected);
        }

        [Fact]
        public void Redact_NonSensitiveText_IsUnchanged()
        {
            var input = "Executed action \"Api.Controllers.FooController.Bar\" in 42ms";

            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        [Fact]
        public void Redact_DottedTypeNameWithThreeLongSegments_IsUnchanged()
        {
            var input = "Executing endpoint \"Api.Controllers.AuthenticationController.ImpersonationStatus (Api)\"";

            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        [Fact]
        public void Redact_RealisticJwtWithEyJHeader_IsMasked()
        {
            var input = "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk end";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Token: ***REDACTED*** end");
        }

        // 1735689600000 is 2025-01-01T00:00:00Z in epoch milliseconds and fails the Luhn
        // checksum, so the credit-card matcher must leave it alone.
        [Fact]
        public void Redact_EpochMillisecondTimestamp_IsUnchanged()
        {
            var input = "Job scheduled at 1735689600000 for tenant acme";

            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        [Fact]
        public void Redact_ThirteenDigitNumberFailingLuhn_IsUnchanged()
        {
            var input = "Correlation window 1699999999999 closed";

            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void Redact_NullOrEmpty_ReturnsUnchanged(string? input)
        {
            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }
    }
}
