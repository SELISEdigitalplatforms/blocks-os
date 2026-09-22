using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Shared.Enums;
using Configuration.DomainService.Shared.Services;
using FluentValidation;

namespace Configuration.DomainService.Mail.Validators
{
    /// <summary>
    /// The rules every mail configuration shares, whoever the provider is.
    /// </summary>
    /// <remarks>
    /// Provider-specific rules live in the provider definitions, not here, and the orchestrator
    /// normalizes a request before running this validator. That ordering is what lets the host
    /// and port rules below stay unconditional: a provider with fixed transport settings has
    /// already overwritten them with values that pass.
    /// <para>
    /// Kept free of the provider registry on purpose — the registry is scoped, this validator is
    /// a singleton, and wiring one into the other is exactly the captured-dependency trap the
    /// secret services warn about.
    /// </para>
    /// </remarks>
    public class MailConfigurationValidator : AbstractValidator<MailConfiguration>
    {
        private readonly IConfigurationRepository _configurationRepository;

        public MailConfigurationValidator(IConfigurationRepository configurationRepository)
        {
            _configurationRepository = configurationRepository;

            // ConfigurationName is required and should not be empty
            RuleFor(x => x.ConfigurationName)
                .NotEmpty().WithMessage("Configuration name is required.")
                .MustAsync(async (configuration, name, cancellationToken) => await IsNameUniqueAsync(name, configuration.ConfigurationId))
                .WithMessage("The name must be unique.")
                .Length(3, 100).WithMessage("Configuration name must be between 3 and 100 characters.");

            // ConfigurationId is deliberately not required. An empty id is how a caller asks for
            // a create, and the orchestrator allocates the real one; requiring a value here would
            // reject every create. On edit the orchestrator checks that the id resolves to a
            // record, which this validator cannot do without re-reading it.

            // Host is required and should not be empty
            RuleFor(x => x.Host)
                .NotEmpty().WithMessage("Host is required.")
                .Matches(@"^([\w\-]+\.)*[\w\-]+\.[a-z]{2,}$").WithMessage("Invalid host format.");

            // Port should be in a valid range (assuming typical mail server port range)
            RuleFor(x => x.Port)
                .InclusiveBetween(1, 65535).WithMessage("Port must be between 1 and 65535.");

            // SenderName should not be empty (Only for Outbound)
            RuleFor(x => x.SenderName)
                .NotEmpty().When(x => !x.IsInbound).WithMessage("Sender name is required.")
                .Length(3, 100).When(x => !x.IsInbound).WithMessage("Sender name must be between 3 and 100 characters.");

            // SenderAddress should be a valid email (Only for Outbound)
            RuleFor(x => x.SenderAddress)
                .NotEmpty().When(x => !x.IsInbound).WithMessage("Sender email address is required.")
                .EmailAddress().When(x => !x.IsInbound).WithMessage("Sender email address must be a valid email.");

            // Username and password apply to password authentication only. The condition is the
            // authentication type rather than the provider id, so a later OAuth provider needs no
            // change here: normalization has already set the type by the time this runs.
            RuleFor(x => x.SenderUserName)
                .NotEmpty().When(UsesPasswordAuthentication).WithMessage("Username is required.");

            RuleFor(x => x.AccountPassword)
                .NotEmpty().When(UsesPasswordAuthentication).WithMessage("Password is required.")
                .MinimumLength(6).When(UsesPasswordAuthentication).WithMessage("Password must be at least 6 characters long.");
        }

        private static bool UsesPasswordAuthentication(MailConfiguration configuration) =>
            configuration.AuthenticationType == MailAuthenticationType.Password;

        /// <summary>
        /// Unique among the other records, not among all of them.
        /// </summary>
        /// <remarks>
        /// The current record is excluded, otherwise every edit that leaves the name alone would
        /// collide with itself and no Office 365 configuration could be edited without renaming it.
        /// </remarks>
        private async Task<bool> IsNameUniqueAsync(string name, string? configurationId)
        {
            var configuration = await _configurationRepository.GetMailConfigurationByNameAsync(name);

            return configuration is null
                || (!string.IsNullOrWhiteSpace(configurationId)
                    && string.Equals(configuration.ItemId, configurationId, StringComparison.Ordinal));
        }
    }
}
