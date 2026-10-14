using System.IO;
using System.Threading.Tasks;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Services;
using Blocks.Genesis;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Formatters;
using Moq;

namespace XUnitTest.Controllers
{
    /// <summary>os SPEC2 X-3: the controller uses the new scoped service; no doc = null = 204 (R-X-GET-NONE).</summary>
    public class DataGatewayControllerTests
    {
        [Fact]
        public async Task GetConfig_NoConfiguration_ReturnsNull_WhichMvcAnswersWith204()
        {
            var service = new Mock<IDataGatewayConfigurationService>();
            service.Setup(s => s.GetDataGatewayConfigurationAsync()).ReturnsAsync((DataGatewayConfiguration?)null);

            var result = await new DataGatewayController(service.Object).GetConfig();

            result.Should().BeNull();
            // ASP.NET Core's default HttpNoContentOutputFormatter turns a null action result into 204.
            var http = new DefaultHttpContext();
            http.Response.Body = new MemoryStream();
            var context = new OutputFormatterWriteContext(http, (s, e) => new StreamWriter(s, e), typeof(DataGatewayConfiguration), null);
            var formatter = new HttpNoContentOutputFormatter();
            formatter.CanWriteResult(context).Should().BeTrue();
            await formatter.WriteAsync(context);
            http.Response.StatusCode.Should().Be(StatusCodes.Status204NoContent);
        }

        [Fact]
        public async Task SaveConfig_DelegatesToDataGatewayService()
        {
            var service = new Mock<IDataGatewayConfigurationService>();
            var request = new SaveDataGatewayConfigurationRequest { ConnectionString = "default", DatabaseName = "d" };
            service.Setup(s => s.SaveDataGatewayConfigurationAsync(request)).ReturnsAsync(new BaseMutationResponse { IsSuccess = true, ItemId = "cfg" });

            var response = await new DataGatewayController(service.Object).SaveConfig(request);

            response.ItemId.Should().Be("cfg");
        }
    }
}
