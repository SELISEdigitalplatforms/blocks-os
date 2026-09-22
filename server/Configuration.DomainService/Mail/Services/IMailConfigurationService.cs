using Blocks.Genesis;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;

namespace Configuration.DomainService.Mail.Services
{
    /// <summary>
    /// Orchestrates mail configuration: shared validation, provider selection, persistence and
    /// credential lifecycle.
    /// </summary>
    /// <remarks>
    /// Split out of <c>IConfigurationService</c> and registered <b>scoped</b>. Provider
    /// definitions that own a secret depend on the scoped <c>ISecretService</c>, which reads the
    /// request-scoped <c>BlocksContext</c>; a singleton holding one would either fail scope
    /// validation or serve the first request's identity to everyone after it. The notification
    /// and storage configuration methods stay on the singleton service, which does not touch
    /// secrets.
    /// </remarks>
    public interface IMailConfigurationService
    {
        Task<MailConfigurationMutationResult> SaveAsync(MailConfiguration configuration, CancellationToken cancellationToken = default);

        Task<MailConfigurationResponse?> GetAsync(GetMailConfigurationRequest request, CancellationToken cancellationToken = default);

        Task<List<MailConfigurationResponse>> GetAllAsync(CancellationToken cancellationToken = default);

        Task<MailConfigurationMutationResult> DeleteAsync(DeleteMailConfigurationRequest request, CancellationToken cancellationToken = default);

        Task<MailConfigurationMutationResult> DuplicateAsync(DuplicateMailConfigurationRequest request, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Why an operation ended, so the controller can pick a status code without inspecting the
    /// error dictionary.
    /// </summary>
    public enum MailConfigurationOutcome
    {
        Success = 0,

        /// <summary>A field error. HTTP 400.</summary>
        Invalid = 1,

        /// <summary>
        /// The secret store could not be reached. HTTP 503 — retryable, and distinct from the
        /// vault's own 502 so a caller can tell "try again" from "this endpoint is broken".
        /// </summary>
        SecretStoreUnavailable = 2,
    }

    /// <summary>The mutation envelope plus the outcome that classifies it.</summary>
    public sealed class MailConfigurationMutationResult
    {
        public required BaseMutationResponse Response { get; init; }

        public MailConfigurationOutcome Outcome { get; init; }

        public static MailConfigurationMutationResult Success(string itemId) => new()
        {
            Response = new BaseMutationResponse { IsSuccess = true, ItemId = itemId },
            Outcome = MailConfigurationOutcome.Success
        };

        public static MailConfigurationMutationResult Invalid(IDictionary<string, string> errors) => new()
        {
            Response = new BaseMutationResponse { IsSuccess = false, Errors = new Dictionary<string, string>(errors) },
            Outcome = MailConfigurationOutcome.Invalid
        };

        public static MailConfigurationMutationResult Invalid(string field, string message) =>
            Invalid(new Dictionary<string, string> { [field] = message });

        public static MailConfigurationMutationResult SecretStoreUnavailable() => new()
        {
            Response = new BaseMutationResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string>
                {
                    ["ClientSecret"] = "The client secret could not be stored. Try again."
                }
            },
            Outcome = MailConfigurationOutcome.SecretStoreUnavailable
        };
    }
}
