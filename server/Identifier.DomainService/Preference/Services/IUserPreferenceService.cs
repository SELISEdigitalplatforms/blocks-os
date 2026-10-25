using Blocks.Genesis;

namespace DomainService.Preference.Services
{
    /// <summary>The signed-in user's own settings, by key. Every call acts on the caller only.</summary>
    public interface IUserPreferenceService
    {
        Task<GetUserPreferenceResponse> GetAsync(GetUserPreferenceRequest request, CancellationToken cancellationToken = default);

        Task<BaseResponse> SaveAsync(SaveUserPreferenceRequest request, CancellationToken cancellationToken = default);
    }
}
