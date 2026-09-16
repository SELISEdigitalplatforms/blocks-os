using Configuration.DomainService.Storage.RequestModel;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Extensions.DependencyInjection;

namespace XUnitTest.Validators
{
    /// <summary>
    /// FluentValidation is not the only thing standing between a request and the controller action.
    /// With &lt;Nullable&gt;enable&lt;/Nullable&gt; and [ApiController] (see StorageController.Save),
    /// ASP.NET Core's model binder treats a non-nullable reference-type property as implicitly
    /// required and rejects the request with a 400 - and a ValidationProblemDetails body naming that
    /// property - before the controller action, and therefore FluentValidation, ever runs. That stage
    /// can't be exercised by calling the controller or the validator directly in a unit test (as every
    /// other test in this project does), only by asking the real model metadata provider ASP.NET Core
    /// itself consults for "is this property required". The provider classes that compute this from
    /// nullability are internal to the framework, so it's resolved the same way the app does: through
    /// the DI container `AddControllers()` wires up, with the same default `MvcOptions`/
    /// `ApiBehaviorOptions` the real app runs with (this repo overrides neither).
    /// </summary>
    public class SaveStorageConfigurationRequestModelBindingTests
    {
        private static ModelMetadata MetadataFor(string propertyName)
        {
            var provider = new ServiceCollection()
                .AddLogging()
                .AddControllers()
                .Services
                .BuildServiceProvider()
                .GetRequiredService<IModelMetadataProvider>();

            return provider.GetMetadataForProperty(typeof(SaveStorageConfigurationRequest), propertyName);
        }

        [Theory]
        [InlineData(nameof(SaveStorageConfigurationRequest.Name))]
        [InlineData(nameof(SaveStorageConfigurationRequest.StorageStrategy))]
        public void Property_IsNotImplicitlyRequired_SoAnUpdateOmittingItBindsSuccessfully(string propertyName)
        {
            // This is the exact flag [ApiController]'s automatic 400 response consults. Reproducing
            // the reported bug (make the property `string` instead of `string?`) turns this false into
            // true, which is what made every update - which never sends Name/StorageStrategy - fail at
            // the door with "The Name field is required." before FluentValidation could allow it.
            MetadataFor(propertyName).IsRequired.Should().BeFalse();
        }

        [Theory]
        [InlineData(nameof(SaveStorageConfigurationRequest.ConnectionString))]
        [InlineData(nameof(SaveStorageConfigurationRequest.SecretKey))]
        [InlineData(nameof(SaveStorageConfigurationRequest.AccessKey))]
        [InlineData(nameof(SaveStorageConfigurationRequest.CloudStorageRegionEndPoint))]
        [InlineData(nameof(SaveStorageConfigurationRequest.Host))]
        [InlineData(nameof(SaveStorageConfigurationRequest.Port))]
        [InlineData(nameof(SaveStorageConfigurationRequest.UserName))]
        [InlineData(nameof(SaveStorageConfigurationRequest.Password))]
        [InlineData(nameof(SaveStorageConfigurationRequest.RemoteBasePath))]
        [InlineData(nameof(SaveStorageConfigurationRequest.ItemId))]
        public void EveryOtherOptionalField_WasAlreadyNotImplicitlyRequired(string propertyName)
        {
            // These were already nullable before this fix - included so a future change that makes one
            // of them non-nullable again gets caught here instead of as another silent 400 in prod.
            MetadataFor(propertyName).IsRequired.Should().BeFalse();
        }
    }
}
