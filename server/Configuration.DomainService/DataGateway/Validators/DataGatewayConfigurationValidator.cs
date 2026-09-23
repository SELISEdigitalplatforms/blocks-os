using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.Shared.Services;
using FluentValidation;

namespace Configuration.DomainService.DataGateway.Validators
{
    public class DataGatewayConfigurationValidator : AbstractValidator<SaveDataGatewayConfigurationRequest>
    {
        private readonly IConfigurationRepository _configurationRepository;

        public DataGatewayConfigurationValidator(IConfigurationRepository configurationRepository)
        {
            _configurationRepository = configurationRepository;

            When(config => config.UpdateRequest, () =>
            {
                RuleFor(config => config.ItemId)
                    .Cascade(CascadeMode.Stop)
                    .NotEmpty()
                    .NotNull()
                    .WithMessage("ItemId must not be empty.");
            });

            When(config => !config.UpdateRequest, () =>
            {
                RuleFor(config => config.ProjectKey)
                    .Cascade(CascadeMode.Stop)
                    .NotEmpty()
                    .WithMessage("ProjectKey must not be empty.")
                    .MustAsync(BeAUniqueProjectKeyAsync)
                    .WithMessage("A DataGateway configuration for this ProjectKey already exists.");
            });

            RuleFor(config => config.ConnectionString)
                .NotEmpty()
                .WithMessage("ConnectionString must not be empty.");

            RuleFor(config => config.DatabaseName)
                .NotEmpty()
                .WithMessage("DatabaseName must not be empty.");
        }

        private async Task<bool> BeAUniqueProjectKeyAsync(string? projectKey, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(projectKey))
            {
                return true;
            }

            var configuration = await _configurationRepository.GetDataGatewayConfigurationByProjectKeyAsync(projectKey);
            return configuration == null;
        }
    }
}
