using Blocks.Genesis;

namespace DomainService.Migration
{
    public class MigrationRequest
    {
        public required string ProjectKey { get; set; }
        public required string TargetedProjectKey { get; set; }
        public required string TenantGroupId { get; set; }
        public required List<ServiceDetails> Services { get; set; }
    }
    public class ServiceDetails
    {
        public bool ShouldOverWriteExistingData { get; set; } = false;
        public required MigrationServiceNames ServiceName { get; set; }
    }
    public class MigrationOtpGenerationResponse : BaseResponse
    {
        public string? VerificationId { get; set; }
    }
    public class MigrationOtpData
    {
        public string Code { get; set; } = string.Empty;
        public MigrationRequest Request { get; set; } = null!;

        /// <summary>
        /// Who started this migration. Verify asserts against it, so a verification id alone is
        /// not enough to finish somebody else's migration.
        /// </summary>
        public string IssuedToUserId { get; set; } = string.Empty;
    }

    public enum MigrationServiceNames
    {
        Authentication,
        IAM,
        MFA,
        CAPTCHA,
        Email,
        DataGateway,
        Notifications,
        Storage,
        Language
    }
}
