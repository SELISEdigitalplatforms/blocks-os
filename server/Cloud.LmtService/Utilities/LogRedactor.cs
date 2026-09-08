using System.Text.RegularExpressions;

namespace Cloud.LmtService.Utilities
{
    /// <summary>
    /// Masks sensitive substrings (emails, tokens, passwords, connection-string
    /// credentials, credit-card-like numbers) in log text before it leaves the
    /// backend. Applied at read time only -- stored log documents are never modified.
    /// </summary>
    public static class LogRedactor
    {
        /// <summary>
        /// The masking placeholder written in place of sensitive content. Shared so other
        /// read-path redactors (e.g. <see cref="TraceRedactor"/>) present the same marker.
        /// </summary>
        public const string Placeholder = "***REDACTED***";

        private static readonly Regex BearerTokenRegex = new(
            @"\bBearer\s+[A-Za-z0-9\-._~+/]+=*",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // Three base64url segments separated by dots (a JWT not preceded by "Bearer"),
        // anchored on the "eyJ" header prefix. A JWT's first segment is base64url of a JSON
        // object, which always begins '{"' and therefore always encodes to "eyJ". Anchoring
        // there is what keeps real .NET type names -- which also have three long dotted
        // segments, e.g. "Api.Controllers.AuthenticationController.ImpersonationStatus" --
        // out of the match; a segment-length minimum alone does not.
        private static readonly Regex JwtRegex = new(
            @"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+",
            RegexOptions.Compiled);

        private static readonly Regex EmailRegex = new(
            @"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
            RegexOptions.Compiled);

        // JSON-style "password": "value" (any casing / pwd / passwd), value redacted, key kept.
        private static readonly Regex JsonPasswordRegex = new(
            @"(""(?:password|pwd|passwd)""\s*:\s*"")[^""]*("")",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // key=value style, terminated by '&', ';', whitespace, or end of string. Covers both
        // query-string/form-encoded passwords and semicolon-delimited connection-string
        // Password=/Pwd= segments.
        private static readonly Regex KeyValuePasswordRegex = new(
            @"\b(pwd|password|passwd)\s*=\s*[^&;\s]+",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // Candidate matcher only: 13-19 digit sequences, optionally grouped in 4s with spaces
        // or hyphens. A bare \d{13,19} run also matches ordinary log content -- a Unix
        // epoch-millisecond timestamp is exactly 13 digits -- so every candidate is validated
        // against the Luhn checksum before it is replaced (see PassesLuhn).
        private static readonly Regex CreditCardRegex = new(
            @"\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b|\b\d{13,19}\b",
            RegexOptions.Compiled);

        public static string Redact(string? text)
        {
            if (string.IsNullOrEmpty(text))
                return text!;

            var result = text;
            result = BearerTokenRegex.Replace(result, Placeholder);
            result = JwtRegex.Replace(result, Placeholder);
            result = EmailRegex.Replace(result, Placeholder);
            result = JsonPasswordRegex.Replace(result, $"$1{Placeholder}$2");
            result = KeyValuePasswordRegex.Replace(result, m => $"{m.Groups[1].Value}={Placeholder}");
            result = CreditCardRegex.Replace(result, RedactIfCreditCard);

            return result;
        }

        // Only a candidate that satisfies the Luhn checksum is masked; anything else (an epoch
        // millisecond timestamp, a correlation id, a byte count) is returned exactly as matched.
        private static string RedactIfCreditCard(Match match)
        {
            var digits = match.Value.Replace(" ", string.Empty).Replace("-", string.Empty);
            return PassesLuhn(digits) ? Placeholder : match.Value;
        }

        private static bool PassesLuhn(string digits)
        {
            if (digits.Length == 0)
                return false;

            var sum = 0;
            var doubleIt = false;

            for (var i = digits.Length - 1; i >= 0; i--)
            {
                var c = digits[i];
                if (c < '0' || c > '9')
                    return false;

                var digit = c - '0';
                if (doubleIt)
                {
                    digit *= 2;
                    if (digit > 9)
                        digit -= 9;
                }

                sum += digit;
                doubleIt = !doubleIt;
            }

            return sum % 10 == 0;
        }
    }
}
