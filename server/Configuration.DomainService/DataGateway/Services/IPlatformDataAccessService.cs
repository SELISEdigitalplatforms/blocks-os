using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.ResponseModel;

namespace Configuration.DomainService.DataGateway.Services
{
    /// <summary>
    /// The Data Access page for platform (system) schemas: their access levels and policies, and, when switched on,
    /// validation rules and default values on the properties the Genesis allow-list opens.
    /// </summary>
    public interface IPlatformDataAccessService
    {
        /// <summary>The offered system schemas, with their access levels, visible properties and rule flags.</summary>
        Task<PlatformDataAccessResult> GetSchemasAsync(CancellationToken cancellationToken);

        Task<PlatformDataAccessResult> GetPoliciesAsync(string schemaId, CancellationToken cancellationToken);

        /// <summary>Creates a policy (null <paramref name="itemId"/>) or updates the schema's policy with that id.</summary>
        Task<PlatformDataAccessResult> SavePolicyAsync(SavePlatformPolicyRequest request, string? itemId, CancellationToken cancellationToken);

        Task<PlatformDataAccessResult> ConfigureAsync(ConfigurePlatformAccessRequest request, CancellationToken cancellationToken);

        Task<PlatformDataAccessResult> DeletePolicyAsync(string itemId, CancellationToken cancellationToken);

        /// <summary>The field's validation rules; null data when it has none.</summary>
        Task<PlatformDataAccessResult> GetValidationAsync(string schemaId, string fieldName, CancellationToken cancellationToken);

        /// <summary>
        /// Replaces the field's validation rules; an empty list removes them. Only properties the Genesis allow-list
        /// opens; Reference rules point at system Entity schemas; every rule is saved as version 1.
        /// </summary>
        Task<PlatformDataAccessResult> SaveValidationAsync(SavePlatformValidationRequest request, CancellationToken cancellationToken);

        /// <summary>
        /// The same validation rules on several default properties (the base entity's own: Language, Tags, Read.Roles, …)
        /// of several system schemas. <c>Replace</c> gives each property exactly these rules (an empty list removes
        /// them); otherwise they are added after the ones it has. Every pair is checked first, as a single save would
        /// be; if any is refused nothing is written, and each refusal is named by Schema.Property.
        /// </summary>
        Task<PlatformDataAccessResult> BulkValidationAsync(BulkPlatformValidationRequest request, CancellationToken cancellationToken);

        /// <summary>Sets or (null) clears the field's default value. Only properties the Genesis allow-list opens.</summary>
        Task<PlatformDataAccessResult> SetFieldDefaultAsync(SetPlatformFieldDefaultRequest request, CancellationToken cancellationToken);

        /// <summary>
        /// Sets or (null) clears the same default value on several default properties of several system schemas.
        /// Every pair is checked first; if any is refused nothing is written, and each refusal is named by Schema.Property.
        /// </summary>
        Task<PlatformDataAccessResult> BulkFieldDefaultAsync(BulkPlatformFieldDefaultRequest request, CancellationToken cancellationToken);
    }
}
