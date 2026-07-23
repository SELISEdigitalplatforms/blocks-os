using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Protocols;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.Validators;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Mailbox.Services;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Mail.Template.Validators;
using Configuration.DomainService.Mail.Validators;
using Configuration.DomainService.Storage.RequestModel;
using Configuration.DomainService.Storage.Validators;

namespace Configuration.DomainService.Shared.Utilities
{
    public static class ApplicationServiceCollectionExtensions
    {
        public static void AddConfigurationServices(this IServiceCollection serviceCollection)
        {
            serviceCollection.AddSingleton<IConfigurationService, ConfigurationService>();
            serviceCollection.AddSingleton<IConfigurationRepository, ConfigurationRepository>();
            serviceCollection.AddSingleton<IMailTemplateService, MailTemplateService>();
            serviceCollection.AddSingleton<IMailTemplateRepository, MailTemplateRepository>();
            serviceCollection.AddSingleton<IMailboxService, MailboxService>();
            serviceCollection.AddSingleton<IMailboxRepository, MailboxRepository>();

            serviceCollection.AddSingleton<IValidator<SaveNotificationConfigurationRequest>, NotificationConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<SaveStorageConfigurationRequest>, StorageConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<MailConfiguration>, MailConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<SaveMailTemplateRequest>, MailTemplateValidator>();
        }
    }
}





