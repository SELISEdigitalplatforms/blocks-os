using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Services;
using FluentValidation;

namespace Configuration.DomainService.DataGateway.Validators
{
    public class DataGatewayConfigurationValidator : AbstractValidator<SaveDataGatewayConfigurationRequest>
    {
        public DataGatewayConfigurationValidator()
        {
            When(config => config.UpdateRequest, () =>
            {
                RuleFor(config => config.ItemId)
                    .NotEmpty()
                    .WithMessage("ItemId must not be empty.");
            });

            // Never echoes the value.
            RuleFor(config => config.ConnectionString)
                .Must(DataGatewayConfigurationService.IsValidOrDefault)
                .WithMessage("ConnectionString_Is_Invalid.");

            // Blocks DB keeps the stored name; only an own database needs one.
            RuleFor(config => config.DatabaseName)
                .NotEmpty()
                .When(config => DataGatewayConfigurationService.IsCustom(config.ConnectionString))
                .WithMessage("DatabaseName must not be empty.");
        }
    }
}
