using Blocks.Genesis;
using FluentValidation;

namespace DomainService.Preference.Services
{
    /// <summary>
    /// Keeps each user's settings in Genesis's key-value store (the <c>keyValueStores</c>
    /// collection), one single-value entry per user and setting, keyed
    /// <c>user-preference::{userId}::{key}</c>.
    /// </summary>
    /// <remarks>
    /// <c>impersonated: false</c> on every call: a user's settings are the user's, not a
    /// project's. The default would read and write whichever project the console is
    /// impersonating, and the settings would differ from one project to the next.
    /// Only the single-value API (Get/Set) is used on these keys; mixing in the multi-value API
    /// on the same key makes reads return an arbitrary document.
    /// </remarks>
    public sealed class UserPreferenceService : IUserPreferenceService
    {
        private const string StoreKeyPrefix = "user-preference";

        private readonly IKeyValueStore _store;
        private readonly IValidator<SaveUserPreferenceRequest> _saveValidator;

        public UserPreferenceService(IKeyValueStore store, IValidator<SaveUserPreferenceRequest> saveValidator)
        {
            _store = store;
            _saveValidator = saveValidator;
        }

        /// <summary>The store key for one user's setting.</summary>
        public static string StoreKey(string userId, string key) => $"{StoreKeyPrefix}::{userId}::{key}";

        public async Task<GetUserPreferenceResponse> GetAsync(GetUserPreferenceRequest request, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(request);
            var userId = CurrentUserId();
            if (string.IsNullOrEmpty(userId))
                return new GetUserPreferenceResponse { IsSuccess = false, Key = request.Key, Errors = NoUser() };
            if (!UserPreferenceKeys.All.Contains(request.Key))
                return new GetUserPreferenceResponse { IsSuccess = false, Key = request.Key, Errors = UnknownKey() };

            var value = await _store
                .GetAsync<string>(StoreKey(userId, request.Key), impersonated: false, cancellationToken)
                .ConfigureAwait(false);
            return new GetUserPreferenceResponse { IsSuccess = true, Key = request.Key, Value = value };
        }

        public async Task<BaseResponse> SaveAsync(SaveUserPreferenceRequest request, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(request);
            var validation = await _saveValidator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
            if (!validation.IsValid)
            {
                return new BaseResponse
                {
                    IsSuccess = false,
                    Errors = validation.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.First().ErrorMessage),
                };
            }

            var userId = CurrentUserId();
            if (string.IsNullOrEmpty(userId))
                return new BaseResponse { IsSuccess = false, Errors = NoUser() };

            await _store
                .SetAsync(StoreKey(userId, request.Key), request.Value, impersonated: false, cancellationToken)
                .ConfigureAwait(false);
            return new BaseResponse { IsSuccess = true, Errors = new Dictionary<string, string>() };
        }

        private static string CurrentUserId() => BlocksContext.GetContext()?.UserId ?? string.Empty;

        private static Dictionary<string, string> NoUser() =>
            new() { { "user", "Preferences belong to a signed-in user." } };

        private static Dictionary<string, string> UnknownKey() =>
            new() { { "Key", "Key is not a known preference." } };
    }
}
