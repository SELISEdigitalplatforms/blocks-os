using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Utilities;
using DomainService.Shared;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Os.DataAccess;
using Os.DataAccess.Notifications;
using Worker.Consumers.Mail;

namespace XUnitTest.Worker
{
    /// <summary>blocks-os#735: the copy queue is bound in the Worker, and the Worker can build the consumer.</summary>
    public class EmailTemplateCopyWiringTests
    {
        [Theory]
        [InlineData("amqp://<username>:<password>@localhost:5672")]
        [InlineData("Endpoint=sb://ns.servicebus.windows.net/;SharedAccessKey=y")]
        public void WorkerMessageConfiguration_BindsTheEmailTemplateQueueOnce(string connection)
        {
            var config = Constants.WithEmailTemplateQueue(Constants.WithEmailTemplateQueue(IdentifierConstants.GetMessageConfiguration(connection)));

            if (config.RabbitMqConfiguration is not null)
            {
                config.RabbitMqConfiguration.ConsumerSubscriptions.Should().ContainSingle(s => s.QueueName == "blocks_os_email_template_listener");
            }
            else
            {
                config.AzureServiceBusConfiguration!.Queues.Should().ContainSingle(q => q == "blocks_os_email_template_listener");
            }
        }

        [Fact]
        public void WorkerRegistration_ResolvesTheConsumer_AndRoutesTheCommand()
        {
            var services = new ServiceCollection();
            // What Genesis and the Worker's other registrations already provide.
            services.AddSingleton(Mock.Of<IDbContextProvider>());
            services.AddSingleton(Mock.Of<IOsDataAccess>());
            services.AddSingleton(Mock.Of<IBuiltInNotificationSender>());
            services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));

            services.AddEmailTemplateCopyJob();
            services.AddSingleton<IConsumer<EmailTemplateCopyCommand>, EmailTemplateCopyConsumer>();

            using var provider = services.BuildServiceProvider();
            provider.GetRequiredService<IConsumer<EmailTemplateCopyCommand>>().Should().BeOfType<EmailTemplateCopyConsumer>();
            provider.GetRequiredService<IEmailTemplateCopyJob>().Should().BeOfType<EmailTemplateCopyJob>();
            provider.GetRequiredService<IOrganizationReader>().Should().BeOfType<OrganizationReader>();
            new RoutingTable(services).Routes.Should().ContainKey(nameof(EmailTemplateCopyCommand));
        }

        [Fact] // tenant isolation: the job runs in the command's tenant, unauthenticated (no user rules)
        public async Task Consumer_RunsTheJobInTheCommandsTenant()
        {
            BlocksContext? seen = null;
            var job = new Mock<IEmailTemplateCopyJob>();
            job.Setup(j => j.RunAsync(It.IsAny<EmailTemplateCopyCommand>(), default))
                .Callback(() => seen = BlocksContext.GetContext())
                .ReturnsAsync(new EmailTemplateCopyResult());

            await new EmailTemplateCopyConsumer(job.Object).Consume(new EmailTemplateCopyCommand
            {
                JobId = "j", TenantId = "project-9", OriginalTenantId = "root-1", RequestedByUserId = "admin-1", TemplateId = "t",
            });

            seen.Should().NotBeNull();
            seen!.TenantId.Should().Be("project-9");
            seen.OriginalTenantId.Should().Be("root-1");
            seen.UserId.Should().Be("admin-1");
            seen.IsAuthenticated.Should().BeFalse();
        }
    }
}
