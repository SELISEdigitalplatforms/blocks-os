using System.Threading.Tasks;
using DomainService.ManagedService;
using DomainService.ManagedService.Validator;
using FluentAssertions;

namespace XUnitTest.Validators
{
    public class RegisterServiceRequestValidatorTests
    {
        private readonly RegisterServiceRequestValidator _validator = new();

        [Theory]
        [InlineData("backend")]
        [InlineData("frontend")]
        [InlineData("Backend")]
        [InlineData("FRONTEND")]
        public async Task Validate_AllowedServiceType_IsValid(string serviceType)
        {
            var request = new RegisterServiceRequest { ServiceName = "svc", ServiceType = serviceType };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyServiceName_Fails()
        {
            var request = new RegisterServiceRequest { ServiceName = "", ServiceType = "backend" };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterServiceRequest.ServiceName));
        }

        [Fact]
        public async Task Validate_TooLongServiceName_Fails()
        {
            var request = new RegisterServiceRequest { ServiceName = new string('x', 101), ServiceType = "backend" };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_DisallowedServiceType_Fails()
        {
            var request = new RegisterServiceRequest { ServiceName = "svc", ServiceType = "database" };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterServiceRequest.ServiceType));
        }

        [Fact]
        public async Task Validate_EmptyServiceType_Fails()
        {
            var request = new RegisterServiceRequest { ServiceName = "svc", ServiceType = "" };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }
    }
}
