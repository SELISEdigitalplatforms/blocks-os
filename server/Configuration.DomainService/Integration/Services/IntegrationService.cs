using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using Configuration.DomainService.Integration.RequestModel;
using FluentValidation;

namespace Configuration.DomainService.Integration.Services
{
    public class IntegrationService : IIntegrationService
    {
        private readonly IIntegrationRepository _integrationRepository;
        private readonly IValidator<SaveIntegrationSetupRequest> _validator;

        public IntegrationService(IIntegrationRepository integrationRepository, IValidator<SaveIntegrationSetupRequest> validator)
        {
            _integrationRepository = integrationRepository;
            _validator = validator;
        }

        public Task<List<IntegrationTemplate>> GetTemplatesAsync() => _integrationRepository.GetActiveTemplatesAsync();

        public Task<IntegrationSetup?> GetSetupAsync() => _integrationRepository.GetSetupAsync();

        public async Task<BaseMutationResponse> SaveSetupAsync(SaveIntegrationSetupRequest request)
        {
            var validationResult = await _validator.ValidateAsync(request);
            if (!validationResult.IsValid)
            {
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.First().ErrorMessage)
                };
            }

            var template = await _integrationRepository.GetActiveTemplateByKeyAsync(request.TemplateKey);
            if (template == null)
                return Failure("TemplateKey", "No active Integration template exists for this key.");

            var context = BlocksContext.GetContext();
            var setup = new IntegrationSetup
            {
                ItemId = IntegrationSetup.SingletonId,
                TemplateKey = template.Key,
                TemplateDisplayName = template.DisplayName,
                RoleId = request.RoleId,
                RoleSlug = request.RoleSlug,
                ClientCredentialId = request.ClientCredentialId,
                CreatedBy = context?.UserId,
                LastUpdatedBy = context?.UserId,
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow
            };

            if (!await _integrationRepository.TryInsertSetupAsync(setup))
                return Failure("already_configured", "Integration is already set up for this project.");

            return new BaseMutationResponse { IsSuccess = true, ItemId = setup.ItemId };
        }

        private static BaseMutationResponse Failure(string key, string message) =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };
    }
}
