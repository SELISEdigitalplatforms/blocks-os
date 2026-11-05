using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
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
    /// <summary>blocks-os#736: the delete job runs in the Worker next to the copy job, on the same queue.</summary>
    public class EmailTemplateDeleteWiringTests
    {
        [Fact] // the registrations Worker/Program.cs makes for both jobs
        public void WorkerRegistration_ResolvesBothConsumers_AndRoutesBothCommands()
        {
            var services = new ServiceCollection();
            // What Genesis and the Worker's other registrations already provide.
            services.AddSingleton(Mock.Of<IDbContextProvider>());
            services.AddSingleton(Mock.Of<IOsDataAccess>());
            services.AddSingleton(Mock.Of<IBuiltInNotificationSender>());
            services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));

            services.AddEmailTemplateCopyJob();
            services.AddSingleton<IConsumer<EmailTemplateCopyCommand>, EmailTemplateCopyConsumer>();
            services.AddSingleton<IEmailTemplateDeleteJob, EmailTemplateDeleteJob>();
            services.AddSingleton<IConsumer<EmailTemplateDeleteCommand>, EmailTemplateDeleteConsumer>();

            using var provider = services.BuildServiceProvider();
            provider.GetRequiredService<IConsumer<EmailTemplateDeleteCommand>>().Should().BeOfType<EmailTemplateDeleteConsumer>();
            provider.GetRequiredService<IEmailTemplateDeleteJob>().Should().BeOfType<EmailTemplateDeleteJob>();
            var routes = new RoutingTable(services).Routes;
            routes.Should().ContainKey(nameof(EmailTemplateCopyCommand));
            routes.Should().ContainKey(nameof(EmailTemplateDeleteCommand));
        }

        [Fact] // tenant isolation: the job runs in the command's tenant, unauthenticated (no user rules)
        public async Task Consumer_RunsTheJobInTheCommandsTenant()
        {
            BlocksContext? seen = null;
            var job = new Mock<IEmailTemplateDeleteJob>();
            job.Setup(j => j.RunAsync(It.IsAny<EmailTemplateDeleteCommand>(), default))
                .Callback(() => seen = BlocksContext.GetContext())
                .ReturnsAsync(new EmailTemplateDeleteResult());

            await new EmailTemplateDeleteConsumer(job.Object, NullLogger<EmailTemplateDeleteConsumer>.Instance).Consume(new EmailTemplateDeleteCommand
            {
                JobId = "j", TenantId = "project-9", OriginalTenantId = "root-1", RequestedByUserId = "admin-1", Name = "n", Language = "en-US",
            });

            seen.Should().NotBeNull();
            seen!.TenantId.Should().Be("project-9");
            seen.OriginalTenantId.Should().Be("root-1");
            seen.UserId.Should().Be("admin-1");
            seen.IsAuthenticated.Should().BeFalse();
        }

        [Theory] // a command without a tenant is dropped (logged), never run nor retried forever
        [InlineData(null)]
        [InlineData("")]
        [InlineData("  ")]
        public async Task Consumer_WithoutATenant_DoesNotRunTheJob(string? tenantId)
        {
            var job = new Mock<IEmailTemplateDeleteJob>(MockBehavior.Strict);

            var consume = () => new EmailTemplateDeleteConsumer(job.Object, NullLogger<EmailTemplateDeleteConsumer>.Instance).Consume(new EmailTemplateDeleteCommand
            {
                JobId = "j", TenantId = tenantId!, RequestedByUserId = "admin-1", Name = "n", Language = "en-US",
            });

            await consume.Should().NotThrowAsync();
            job.VerifyNoOtherCalls();
        }
    }
}
