using Blocks.Genesis;

namespace DomainService.Migration
{
    public class MigrationVerifyOtpRequest
    {
        public string VerificationId { get; set; }
        public string VerificationCode { get; set; }

        /// <summary>
        /// The project group being migrated. Carried on the request so the second step of the
        /// wizard is guarded by the same grant as the first — the verification id alone tells
        /// the authorization filter nothing about which project it belongs to.
        /// </summary>
        public string TenantGroupId { get; set; } = string.Empty;
    }
    public class MigrationOtpVerificationResponse : BaseResponse
    {
        public bool IsValid { get; set; }
    }
}
