using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Entities;
using Moq;
using Worker.Consumers.Identifier;

namespace XUnitTest.Worker
{
    public class IdentifierConsumersTests
    {
        [Fact]
        public async Task ConfigureProjectConsumer_ConfiguresProject()
        {
            var projectService = new Mock<IProjectManagementService>();
            var domainService = new Mock<IDomainManagementService>();
            var consumer = new ConfigureProjectConsumer(projectService.Object, domainService.Object);

            var tenant = new Tenant
            {
                DbConnectionString = "mongodb://x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "p" }
            };

            await consumer.Consume(tenant);

            projectService.Verify(s => s.ConfigureProjectAsync(tenant, null), Times.Once);
        }

        [Fact]
        public async Task RestoreProjectConsumer_RestoresUnfinishedProjects()
        {
            var projectService = new Mock<IProjectManagementService>();
            var consumer = new RestoreProjectConsumer(projectService.Object);

            await consumer.Consume(new RestoreProjectRequest());

            projectService.Verify(s => s.RestoreUnfinishedProjectAsync(), Times.Once);
        }

        [Fact]
        public async Task DisableDomainBindingConsumer_DelegatesToDomainService()
        {
            var domainService = new Mock<IDomainManagementService>();
            var consumer = new DisableDomainBindingConsumer(domainService.Object);
            var request = new DisableDomainBindingRequest { ProjectId = "p1", Domain = "app.example.com" };

            await consumer.Consume(request);

            domainService.Verify(s => s.DisableDomainBindingAsync(request), Times.Once);
        }

        [Fact]
        public async Task DomainConfigureConsumer_DelegatesToDomainService()
        {
            var domainService = new Mock<IDomainManagementService>();
            var consumer = new DomainConfigureConsumer(domainService.Object);
            var request = new ConfigureDomainRequest { CookieDomain = "app.example.com" };

            await consumer.Consume(request);

            domainService.Verify(s => s.ConfigureDomainAsync(request), Times.Once);
        }
    }
}
