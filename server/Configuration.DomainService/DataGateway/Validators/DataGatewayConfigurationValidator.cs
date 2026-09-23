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

            // There is at most one DataGateway configuration - a create is only valid when none
            // exists yet; any further change must go through an update instead.
            When(config => !config.UpdateRequest, () =>
            {
                RuleFor(config => config)
                    .MustAsync(NotAlreadyExistAsync)
                    .WithMessage("A DataGateway configuration already exists. Use update instead.")
                    .OverridePropertyName("ItemId");
            });

            RuleFor(config => config.ConnectionString)
                .NotEmpty()
                .WithMessage("ConnectionString must not be empty.");

            RuleFor(config => config.DatabaseName)
                .NotEmpty()
                .WithMessage("DatabaseName must not be empty.");
        }

        private async Task<bool> NotAlreadyExistAsync(
            SaveDataGatewayConfigurationRequest request,
            CancellationToken cancellationToken)
        {
            var configuration = await _configurationRepository.GetDataGatewayConfigurationAsync();
            return configuration == null;
        }
    }
}
