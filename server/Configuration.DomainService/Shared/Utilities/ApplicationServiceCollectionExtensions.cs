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
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.Services;
using Configuration.DomainService.Captcha.Validators;

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

            // Scoped, unlike the services above: it depends on Blocks.Secrets' ISecretService/
            // ISecretAuditService/ISecretAuthorizationService, which are themselves Scoped
            // because they read the request-scoped BlocksContext. A Singleton here would either
            // fail to resolve (scope validation) or capture the first request's identity forever.
            serviceCollection.AddScoped<ICaptchaConfigService, CaptchaConfigService>();

            serviceCollection.AddSingleton<IValidator<SaveNotificationConfigurationRequest>, NotificationConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<SaveStorageConfigurationRequest>, StorageConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<MailConfiguration>, MailConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<SaveMailTemplateRequest>, MailTemplateValidator>();
            serviceCollection.AddSingleton<IValidator<SaveCaptchaConfigRequest>, CaptchaConfigValidator>();
        }
    }
}





