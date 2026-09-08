using System;
using System.Collections.Generic;
using System.Linq;

namespace Cloud.LmtService.Utilities
{
    /// <summary>
    /// Masks sensitive content in a span's free-form carriers -- the Attributes map and the
    /// Baggage map -- before they leave the backend. The trace read path projects the whole
    /// stored span document with no field whitelist, so every attribute key an instrumented
    /// service happened to set (serialised request headers, the security context, cookies)
    /// otherwise reaches the trace detail page's "Attributes" accordion verbatim.
    /// Applied at read time only -- stored trace documents are never modified.
    /// </summary>
    public static class TraceRedactor
    {
        // Substrings tested against a *normalised* key (see NormalizeKey): lower-cased with
        // '.', '-' and '_' stripped. Normalising is what makes
        // "http.request.header.Authorization", "api-key", "Api_Key" and "SecurityContext" all
        // match a single entry here.
        private static readonly string[] SensitiveKeyFragments =
        {
            "securitycontext",
            "security",
            "authorization",
            "auth",
            "cookie",
            "token",
            "apikey",
            "secret",
            "password",
            "passwd",
            "pwd",
            "credential",
            "bearer"
        };

        /// <summary>
        /// Redacts a span's Attributes map in place. A sensitive key has its whole value
        /// replaced with <see cref="LogRedactor.Placeholder"/> -- the key itself stays visible
        /// so a reader can still see that, say, a security context was attached. Any other
        /// string value goes through <see cref="LogRedactor.Redact"/>, so a token embedded in
        /// a serialised header blob is masked too. Non-string values under non-sensitive keys
        /// (numbers, booleans, nested documents) are left alone -- that is what keeps the
        /// traces list's status column, which reads "response.status.code" and
        /// "http.response.status_code", intact.
        /// </summary>
        public static void RedactAttributes(Dictionary<string, object?>? attributes)
        {
            if (attributes is null || attributes.Count == 0)
                return;

            // Snapshot the keys: the indexer assignments below mutate the dictionary, which
            // would invalidate a live enumerator.
            foreach (var key in attributes.Keys.ToArray())
            {
                if (IsSensitiveKey(key))
                {
                    attributes[key] = LogRedactor.Placeholder;
                    continue;
                }

                if (attributes[key] is string value && !string.IsNullOrEmpty(value))
                    attributes[key] = LogRedactor.Redact(value);
            }
        }

        /// <summary>
        /// Redacts a span's Baggage map in place, using the same key and value rules as
        /// <see cref="RedactAttributes"/>.
        /// </summary>
        public static void RedactBaggage(Dictionary<string, string>? baggage)
        {
            if (baggage is null || baggage.Count == 0)
                return;

            foreach (var key in baggage.Keys.ToArray())
            {
                if (IsSensitiveKey(key))
                {
                    baggage[key] = LogRedactor.Placeholder;
                    continue;
                }

                var value = baggage[key];
                if (!string.IsNullOrEmpty(value))
                    baggage[key] = LogRedactor.Redact(value);
            }
        }

        private static bool IsSensitiveKey(string? key)
        {
            if (string.IsNullOrEmpty(key))
                return false;

            var normalized = NormalizeKey(key);

            return SensitiveKeyFragments.Any(fragment =>
                normalized.Contains(fragment, StringComparison.Ordinal));
        }

        // Lower-case and drop the separators callers use interchangeably ('.', '-', '_') so a
        // single fragment list covers every spelling of the same key.
        private static string NormalizeKey(string key)
        {
            var buffer = new char[key.Length];
            var length = 0;

            foreach (var c in key)
            {
                if (c is '.' or '-' or '_')
                    continue;

                buffer[length++] = char.ToLowerInvariant(c);
            }

            return new string(buffer, 0, length);
        }
    }
}
