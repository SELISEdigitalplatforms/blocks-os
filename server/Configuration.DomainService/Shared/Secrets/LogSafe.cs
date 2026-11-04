namespace Configuration.DomainService.Shared.Secrets
{
    /// <summary>Log-safe forms of request-derived values written by the secret-linked configuration code.</summary>
    public static class LogSafe
    {
        /// <summary>
        /// The value with carriage returns and line feeds removed, so a configuration id or name
        /// taken from a request cannot forge log entries. Null stays null.
        /// </summary>
        public static string? Value(string? value) =>
            value?.Replace("\r", string.Empty, StringComparison.Ordinal).Replace("\n", string.Empty, StringComparison.Ordinal);
    }
}
