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
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Validators;
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.Services;
using Configuration.DomainService.Captcha.Validators;
using Configuration.DomainService.Mail.Providers;
using Configuration.DomainService.Mail.Services;
using Configuration.DomainService.Connect.RequestModel;
using Configuration.DomainService.Connect.Services;
using Configuration.DomainService.Connect.Validators;

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
            serviceCollection.AddSingleton<IConnectService, ConnectService>();
            serviceCollection.AddSingleton<IConnectRepository, ConnectRepository>();

            // Scoped, unlike the services above: it depends on Blocks.Secrets' ISecretService/
            // ISecretAuditService/ISecretAuthorizationService, which are themselves Scoped
            // because they read the request-scoped BlocksContext. A Singleton here would either
            // fail to resolve (scope validation) or capture the first request's identity forever.
            serviceCollection.AddScoped<ICaptchaConfigService, CaptchaConfigService>();

            // Mail configuration is scoped for the same reason: the Office 365 provider
            // definition resolves the client secret through ISecretService. The provider
            // definitions are registered individually and collected by the registry, so adding a
            // provider is one more AddScoped and nothing else.
            serviceCollection.AddScoped<IMailConfigurationProvider, AmazonSesMailConfigurationProvider>();
            serviceCollection.AddScoped<IMailConfigurationProvider, ZohoMailConfigurationProvider>();
            serviceCollection.AddScoped<IMailConfigurationProvider, Office365SmtpMailConfigurationProvider>();
            serviceCollection.AddScoped<IMailConfigurationProvider, GmailMailConfigurationProvider>();
            serviceCollection.AddScoped<IMailConfigurationProviderRegistry, MailConfigurationProviderRegistry>();
            serviceCollection.AddScoped<IMailConfigurationService, MailConfigurationService>();

            serviceCollection.AddSingleton<IValidator<SaveNotificationConfigurationRequest>, NotificationConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<SaveStorageConfigurationRequest>, StorageConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<SaveDataGatewayConfigurationRequest>, DataGatewayConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<MailConfiguration>, MailConfigurationValidator>();
            serviceCollection.AddSingleton<IValidator<SaveMailTemplateRequest>, MailTemplateValidator>();
            serviceCollection.AddSingleton<IValidator<SaveCaptchaConfigRequest>, CaptchaConfigValidator>();
            serviceCollection.AddSingleton<IValidator<SaveConnectSetupRequest>, SaveConnectSetupRequestValidator>();
        }
    }
}





