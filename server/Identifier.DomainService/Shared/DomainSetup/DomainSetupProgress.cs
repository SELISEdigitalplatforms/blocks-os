namespace DomainService.Shared
{
    /// <summary>
    /// The steps the guided domain setup reports, in the order they run. nginx and both
    /// certbot runs are one "ssl" step: to the customer they are a single wait, and the
    /// finer split would only surface proxy internals they can do nothing about.
    /// </summary>
    public static class DomainSetupSteps
    {
        public const string AppDns = "app_dns";
        public const string ApiDns = "api_dns";
        public const string Ssl = "ssl";
    }

    public static class DomainSetupStepStatus
    {
        public const string Running = "running";
        public const string Done = "done";
        public const string Failed = "failed";
    }

    /// <summary>
    /// One progress update of a guided domain setup run, streamed to the console as it happens.
    /// </summary>
    /// <param name="Step">One of <see cref="DomainSetupSteps"/>.</param>
    /// <param name="Status">One of <see cref="DomainSetupStepStatus"/>.</param>
    /// <param name="Host">The host the step checks, when it is about a single one.</param>
    /// <param name="Message">Why the step failed; only set on a failure.</param>
    public sealed record DomainSetupProgress(string Step, string Status, string? Host = null, string? Message = null);
}
