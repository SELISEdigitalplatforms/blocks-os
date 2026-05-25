using Blocks.Genesis;
using CloudConfiguration.DomainService.Authentication.RequestModel;
using CloudConfiguration.DomainService.MFA.RequestModel;
using CloudConfiguration.DomainService.MFA.ResponseModel;
using CloudConfiguration.DomainService.Shared.Services;
using Mfa.DomainService.Services;
using Mfa.DomainService.Shared;
using Mfa.DomainService.Shared.RequestModel;
using Mfa.DomainService.TOTP;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class MfaController : ControllerBase
    {
        private readonly IMfaManagementService _mfaManagementService;
        private readonly TotpService _totpService;
        private readonly IConfigurationService _configurationService;
        public MfaController(IMfaManagementService mfaManagementService,
                            TotpService totpService,
                            IConfigurationService configurationService)
        {
            _mfaManagementService = mfaManagementService;
            _totpService = totpService;
            _configurationService = configurationService;
        }

        [Authorize]
      //  [ProtectedEndPoint("blocks-os::mfa::generate-otp")]
        [HttpPost]
        public async Task<OtpGenerationResponse> GenerateOTP([FromBody] OtpGenerationRequest request)
        {
            return await _mfaManagementService.GenerateOTPAsync(request);
        }

        [Authorize]
       // [ProtectedEndPoint("blocks-os::mfa::verify-otp")]
        [HttpPost]
        public async Task<OtpVerificationResponse> VerifyOTP([FromBody] VerifyOtpRequest request)
        {
            return await _mfaManagementService.VerifyOTPAsync(request);
        }

        [Authorize]
       // [ProtectedEndPoint("blocks-os::mfa::disable-user-mfa")]
        [HttpPost]
        public async Task<BaseResponse> DisableUserMfa([FromBody] DisableUserMfaRequest request)
        {
            return await _mfaManagementService.DisableUserMfa(request);
        }

        [Authorize]
       // [ProtectedEndPoint("blocks-os::mfa::setup-totp")]
        [HttpGet]
        public async Task<SetUpUserTotpResponse> SetUpTotp([FromQuery] SetUpUserTotpRequest request)
        {

            if (string.IsNullOrWhiteSpace(request.UserId))
                return new SetUpUserTotpResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "empty_user_id", "User id should not be empty" } } };

            return await _totpService.GenerateTotpImageByUserAsync(request.UserId);
        }

        [Authorize]
       // [ProtectedEndPoint("blocks-os::mfa::resend-otp")]
        [HttpPost]
        public async Task<OtpGenerationResponse> ResendOtp([FromBody] ResendOtpRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.MfaId)) return new OtpGenerationResponse { Errors = new Dictionary<string, string> { { "empty_mfa_id", "Mfa id should not be empty" } } };

            return await _mfaManagementService.ResendOtpAsync(request.MfaId, request.SendPhoneNumberAsEmailDomain);
        }
        #region Cloud Configuration

        [Authorize]
        [HttpPost]
        //[ProtectedEndPoint("blocks-os::mfa::save-configuration")]
        public async Task<BaseResponse> Save(SaveMfaConfigurationRequest request)
        {
            return await _configurationService.SaveMfaConfigurationAsync(request);
        }

        [Authorize]
        [HttpGet]
       // [ProtectedEndPoint("blocks-os::mfa::get-configuration")]
        public async Task<GetMfaConfigurationResponse> Get([FromQuery] GetAuthenticationConfigurationRequest request)
        {
            return await _configurationService.GetMfaConfigurationAsync();
        }
        #endregion
    }
}
