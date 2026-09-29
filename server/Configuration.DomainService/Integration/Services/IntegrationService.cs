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

        public async Task<BaseQueryResponse<IntegrationSetup>> GetSetupAsync()
        {
            if (!IsInProject())
                return new BaseQueryResponse<IntegrationSetup> { Errors = NotInProjectErrors() };

            return new BaseQueryResponse<IntegrationSetup> { Data = await _integrationRepository.GetSetupAsync() };
        }

        public async Task<BaseMutationResponse> SaveSetupAsync(SaveIntegrationSetupRequest request)
        {
            if (!IsInProject())
                return new BaseMutationResponse { IsSuccess = false, Errors = NotInProjectErrors() };

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
                ItemId = Guid.NewGuid().ToString(),
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

        // The setup lives in the tenant's own database, resolved from the request token. Outside
        // impersonation that token names the root tenant, whose database is the shared
        // BlocksConfiguration, so the record would land next to the templates instead.
        private static bool IsInProject() => BlocksContext.GetContext()?.Impersonated == true;

        private static Dictionary<string, string> NotInProjectErrors() =>
            new() { { "project", "Open a project environment to manage its integrations." } };

        private static BaseMutationResponse Failure(string key, string message) =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };
    }
}
