using Blocks.Genesis;
using Configuration.DomainService.Connect.Entities;
using Configuration.DomainService.Connect.RequestModel;
using FluentValidation;

namespace Configuration.DomainService.Connect.Services
{
    public class ConnectService : IConnectService
    {
        private readonly IConnectRepository _connectRepository;
        private readonly IValidator<SaveConnectSetupRequest> _validator;

        public ConnectService(IConnectRepository connectRepository, IValidator<SaveConnectSetupRequest> validator)
        {
            _connectRepository = connectRepository;
            _validator = validator;
        }

        public Task<List<ConnectTemplate>> GetTemplatesAsync() => _connectRepository.GetActiveTemplatesAsync();

        public Task<ConnectSetup?> GetSetupAsync() => _connectRepository.GetSetupAsync();

        public async Task<BaseMutationResponse> SaveSetupAsync(SaveConnectSetupRequest request)
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

            var template = await _connectRepository.GetActiveTemplateByKeyAsync(request.TemplateKey);
            if (template == null)
                return Failure("TemplateKey", "No active Connect template exists for this key.");

            var context = BlocksContext.GetContext();
            var setup = new ConnectSetup
            {
                ItemId = ConnectSetup.SingletonId,
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

            if (!await _connectRepository.TryInsertSetupAsync(setup))
                return Failure("already_configured", "Connect is already set up for this project.");

            return new BaseMutationResponse { IsSuccess = true, ItemId = setup.ItemId };
        }

        private static BaseMutationResponse Failure(string key, string message) =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };
    }
}
