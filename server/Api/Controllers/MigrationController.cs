using Blocks.Genesis;
using DomainService.Access;
using DomainService.Migration;
using DomainService.Migration.Services;
using DomainService.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics.CodeAnalysis;

namespace BlocksOs.Api.Controllers
 {
 [ApiController]
 [SuppressMessage("Major Code Smell", "S6960:Controllers should not have mixed responsibilities", Justification = "Splitting would change controller names, Swagger grouping and operation ids that clients rely on.")]
 [Route("[controller]/[action]")]
 public class MigrationController : ControllerBase
  {
  private readonly IMigrationService _migrationService;
  private readonly IMigrationRepository _migrationRepository;
  private readonly IMessageClient _messageClient;

  /// <summary>
  /// Initializes a new instance of the MigrationController.
  /// </summary>
  /// <param name="migrationService">The migration service.</param>
  /// <param name="migrationRepository">The migration repository.</param>
  public MigrationController ( IMigrationService migrationService, IMigrationRepository migrationRepository, IMessageClient messageClient )
   {
   _migrationService = migrationService;
   _migrationRepository = migrationRepository;
   _messageClient = messageClient;
   }

  /// <summary>
  /// 
  /// </summary>
  /// <param name="command"></param>
  /// <returns></returns>
  [HttpPost]
  [ProtectedEndPoint("blocks-os::migration::migrate")]
  [ProjectPolicy("environments::migrate")]
  public async Task<MigrationOtpGenerationResponse> Migrate ( [FromBody] MigrationRequest command )
   {
   return await _migrationService.Migrate(command);
   }

  /// <summary>
  /// Verifies the OTP code for the migration process.
  /// </summary>
  /// <param name="command">The OTP verification request containing the verification ID and code.</param>
  /// <returns>An <see cref="MigrationOtpVerificationResponse"/> indicating whether the OTP is valid.</returns>
  [HttpPost]
  [ProtectedEndPoint("blocks-os::migration::migrate")]
  // Scope comes from TenantGroupId on the request, added so the second step of the
  // wizard is guarded by the same grant as the first. VerifyAsync additionally checks
  // the OTP was issued to this caller, so only whoever started a migration can finish it.
  [ProjectPolicy("environments::migrate")]
  public async Task<MigrationOtpVerificationResponse> Verify ( [FromBody] MigrationVerifyOtpRequest request )
   {
   return await _migrationService.VerifyAsync(request);
   }

  /// <summary>
  /// Gets the migration status for projects with incomplete services.
  /// </summary>
  /// <param name="tenantGroupId">The tenant group ID to check for migrations.</param>
  /// <returns>List of migration trackers with incomplete services.</returns>
  [HttpGet]
  [ProtectedEndPoint("blocks-os::migration::gets")]
  [ProjectPolicy("environments::view")]
  public async Task<IActionResult> GetMigrationStatus ( [FromQuery] string tenantGroupId )
   {
   if (string.IsNullOrEmpty(tenantGroupId))
    {
    return BadRequest("Tenant group ID cannot be empty.");
    }

   var trackers = await _migrationRepository.GetMigrationsByTenantGroupIdAsync(tenantGroupId);
   return Ok(trackers);
   }

  [HttpPost]
  [ProtectedEndPoint("blocks-os::migration::data-cleanup")]
  [ProjectPolicy(OwnerOnly = true)]
  public async Task<IActionResult> DataCleanup ( [FromBody] DataCleanupRequest request )
   {
   if (request == null || string.IsNullOrWhiteSpace(request.ProjectKey))
    {
    return BadRequest("ProjectKey is required.");
    }
   await _messageClient.SendToConsumerAsync(
       new ConsumerMessage<DataCleanupRequest>
        {
        ConsumerName = IdentifierConstants.DataCleanupQueue,
        Payload = request
        }
   );
   return Ok();
   }
  }
 }
