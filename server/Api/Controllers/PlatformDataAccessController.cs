using Blocks.Genesis;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.ResponseModel;
using Configuration.DomainService.DataGateway.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>The Data Access page for platform (system) schemas. The work is in <see cref="IPlatformDataAccessService"/>.</summary>
[ApiController]
[Route("[controller]/[action]")]
public sealed class PlatformDataAccessController(IPlatformDataAccessService platformDataAccessService) : ControllerBase
{
    [HttpGet]
    [ProtectedEndPoint("blocks-data::data-access::get-data-access-policy")]
    public async Task<IActionResult> Schemas(CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.GetSchemasAsync(cancellationToken));

    [HttpGet]
    [ProtectedEndPoint("blocks-data::data-access::get-data-access-policy")]
    public async Task<IActionResult> Policies([FromQuery] string schemaId, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.GetPoliciesAsync(schemaId, cancellationToken));

    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-access::create-data-access-policy")]
    public async Task<IActionResult> Create([FromBody] SavePlatformPolicyRequest request, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.SavePolicyAsync(request, null, cancellationToken));

    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-access::configure-security")]
    public async Task<IActionResult> Configure([FromBody] ConfigurePlatformAccessRequest request, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.ConfigureAsync(request, cancellationToken));

    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-access::update-data-access-policy")]
    public async Task<IActionResult> Update([FromBody] SavePlatformPolicyRequest request, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.SavePolicyAsync(request, request.ItemId, cancellationToken));

    [HttpDelete]
    [ProtectedEndPoint("blocks-data::data-access::delete-data-access-policy")]
    public async Task<IActionResult> Delete([FromQuery] string itemId, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.DeletePolicyAsync(itemId, cancellationToken));

    /// <summary>The field's validation rules; null when it has none.</summary>
    [HttpGet]
    [ProtectedEndPoint("blocks-data::data-validation::get-validation-by-schema-and-field")]
    public async Task<IActionResult> Validation([FromQuery] string schemaId, [FromQuery] string fieldName, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.GetValidationAsync(schemaId, fieldName, cancellationToken));

    /// <summary>
    /// Replaces the field's validation rules; an empty list removes them. Only properties the Genesis allow-list
    /// opens; Reference rules point at system Entity schemas; every rule is saved as version 1.
    /// </summary>
    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-validation::update-data-validation")]
    public async Task<IActionResult> SaveValidation([FromBody] SavePlatformValidationRequest request, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.SaveValidationAsync(request, cancellationToken));

    /// <summary>
    /// The same validation rules on several default properties (the base entity's own: Language, Tags, Read.Roles, …)
    /// of several system schemas. <c>Replace</c> gives each property exactly these rules (an empty list removes
    /// them); otherwise they are added after the ones it has. Every pair is checked first, as a single save would
    /// be; if any is refused nothing is written, and each refusal is named by Schema.Property.
    /// </summary>
    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-validation::update-data-validation")]
    public async Task<IActionResult> BulkValidation([FromBody] BulkPlatformValidationRequest request, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.BulkValidationAsync(request, cancellationToken));

    /// <summary>Sets or (null) clears the field's default value. Only properties the Genesis allow-list opens.</summary>
    [HttpPost]
    [ProtectedEndPoint("blocks-data::schema::save-schema-fields")]
    public async Task<IActionResult> FieldDefault([FromBody] SetPlatformFieldDefaultRequest request, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.SetFieldDefaultAsync(request, cancellationToken));

    /// <summary>
    /// Sets or (null) clears the same default value on several default properties of several system schemas.
    /// Every pair is checked first; if any is refused nothing is written, and each refusal is named by Schema.Property.
    /// </summary>
    [HttpPost]
    [ProtectedEndPoint("blocks-data::schema::save-schema-fields")]
    public async Task<IActionResult> BulkFieldDefault([FromBody] BulkPlatformFieldDefaultRequest request, CancellationToken cancellationToken) =>
        ToResult(await platformDataAccessService.BulkFieldDefaultAsync(request, cancellationToken));

    private IActionResult ToResult(PlatformDataAccessResult result) => result.Outcome switch
    {
        PlatformDataAccessOutcome.Ok => Ok(new { isSuccess = true, data = result.Data }),
        PlatformDataAccessOutcome.NotFound => NotFound(),
        PlatformDataAccessOutcome.Refused => BadRequest(new BaseResponse { IsSuccess = false, Errors = result.Errors }),
        _ => BadRequest(),
    };
}
