namespace Configuration.DomainService.Shared.Services
{
    /// <summary>How a service call ended; the controller maps it to an HTTP status.</summary>
    public enum OutcomeStatus
    {
        Ok,
        BadRequest,
        NotFound,
        Conflict
    }

    /// <summary>A service result: the value on success, or a status plus a machine-readable error code.</summary>
    public sealed record ServiceOutcome<T>(OutcomeStatus Status, T? Value, string? ErrorCode)
    {
        public bool IsOk => Status == OutcomeStatus.Ok;

        public static ServiceOutcome<T> Ok(T value) => new(OutcomeStatus.Ok, value, null);

        public static ServiceOutcome<T> BadRequest(string errorCode) => new(OutcomeStatus.BadRequest, default, errorCode);

        public static ServiceOutcome<T> NotFound(string errorCode) => new(OutcomeStatus.NotFound, default, errorCode);

        public static ServiceOutcome<T> Conflict(string errorCode) => new(OutcomeStatus.Conflict, default, errorCode);
    }
}
