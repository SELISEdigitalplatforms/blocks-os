namespace Configuration.DomainService.DataGateway.ResponseModel
{
    public enum PlatformDataAccessOutcome
    {
        /// <summary>Done; <see cref="PlatformDataAccessResult.Data"/> holds the answer.</summary>
        Ok,
        /// <summary>The schema, property or policy isn't on this page, or rules are switched off.</summary>
        NotFound,
        /// <summary>A malformed request, refused without a reason.</summary>
        Invalid,
        /// <summary>Refused with a reason per property in <see cref="PlatformDataAccessResult.Errors"/>.</summary>
        Refused,
    }

    /// <summary>What a platform data-access call did; the controller turns it into the HTTP answer.</summary>
    public sealed record PlatformDataAccessResult(PlatformDataAccessOutcome Outcome, object? Data = null, Dictionary<string, string>? Errors = null)
    {
        public static PlatformDataAccessResult Ok(object? data) => new(PlatformDataAccessOutcome.Ok, data);
        public static PlatformDataAccessResult NotFound() => new(PlatformDataAccessOutcome.NotFound);
        public static PlatformDataAccessResult Invalid() => new(PlatformDataAccessOutcome.Invalid);
        public static PlatformDataAccessResult Refused(Dictionary<string, string> errors) => new(PlatformDataAccessOutcome.Refused, Errors: errors);

        public static PlatformDataAccessResult Refused(string fieldName, string message) =>
            Refused(new Dictionary<string, string> { [string.IsNullOrEmpty(fieldName) ? "fieldName" : fieldName] = message });
    }
}
