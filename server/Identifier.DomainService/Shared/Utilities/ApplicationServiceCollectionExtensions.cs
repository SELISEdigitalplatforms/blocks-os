using Os.DataAccess;
using Os.DataAccess;
using Blocks.Extension.DependencyInjection;
using Blocks.Genesis;
using DomainService.Access;
using DomainService.Access.Services;
using DomainService.Certificate;
using DomainService.ManagedService;
using DomainService.ManagedService.Services;
using DomainService.ManagedService.Validator;
using DomainService.Migration;
using DomainService.Migration.Services;
using DomainService.People;
using DomainService.Preference;
using DomainService.Preference.Services;
using DomainService.Projects;
using DomainService.Shared.Services;
using DomainService.Shared.Utilities;
using DomainService.Subscription.Services;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Storage.DomainService.Services;
using Storage.DomainService.Storage;
using Storage.DomainService.Storage.Validators;

namespace DomainService.Shared
{
    public static class ApplicationServiceCollectionExtensions
    {
        public static void AddApplicationServices(this IServiceCollection services)
        {
            services.AddOsDataAccess();

            // Register validator
            services.AddTransient<IValidator<CreateProjectRequest>, CreateProjectRequestValidator>();
            services.AddTransient<IValidator<UpdateAuthConfigRequest>, UpdateAuthConfigRequestValidator>();
            services.AddTransient<IValidator<UpdateProjectRequest>, UpdateProjectRequestValidator>();
            services.AddTransient<IValidator<RegisterServiceRequest>, RegisterServiceRequestValidator>();
            services.AddTransient<IValidator<MigrationRequest>, MigrationRequestValidator>();

   // Register services
            services.AddSingleton<IProjectManagementService, ProjectManagementService>();
            services.AddSingleton<IDataGatewayRootProvisioner, DataGatewayRootProvisioner>();
            services.AddSingleton<IStorageConfigurationSeedCopier, StorageConfigurationSeedCopier>();
            services.AddSingleton<IMailConfigurationSeedCopier, MailConfigurationSeedCopier>();
            services.AddSingleton<IProjectRepository, ProjectRepository>();

            services.AddSingleton<IDomainManagementService, DomainManagementService>();
            services.AddSingleton<ICertificateManager, CertificateManager>();
            services.AddSingleton<ICertificateStorageFactory, CertificateStorageFactory>();
            services.AddSingleton<IEncodingService, EncodingService>();
            services.AddSingleton<IServiceManagement, ServiceManagement>();
            services.AddSingleton<IServiceManagementRepository, ServiceManagementRepository>();
            services.AddSingleton<ISubscriptionRepository, SubscriptionRepository>();
            services.AddSingleton<ISubscriptionService, SubscriptionService>();
            services.AddSingleton<IMigrationService, MigrationService>();
            services.AddSingleton<IMigrationRepository, MigrationRepository>();
            services.AddSingleton<IMigrationNotificationService, MigrationNotificationService>();
   // People
            services.AddSingleton<IPeopleService, PeopleService>();
            services.AddSingleton<IPeopleInvitationMessenger, PeopleInvitationMessenger>();
            services.AddSingleton<IPeopleRepository, PeopleRepository>();
            // Built-in notifications to project owner + caller

            // User preferences (the caller's own settings, in the root key-value store)
            services.AddTransient<IValidator<SaveUserPreferenceRequest>, SaveUserPreferenceRequestValidator>();
            services.AddSingleton<IUserPreferenceService, UserPreferenceService>();

            // Project access (owner / contributor grants)
            // Scoped, not singleton: it caches the per-request access resolution through
            // IHttpContextAccessor, and a singleton would hand one caller's answer to the next.
            services.AddHttpContextAccessor();
            services.AddScoped<IProjectAccessService, ProjectAccessService>();
            services.AddScoped<ProjectPolicyFilter>();

            // Drivers
            services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();

            services.RegisterBlocksStorageServices();

            // Registered after RegisterBlocksStorageServices: it resolves IStorageDriverService.
            services.AddSingleton<ICertificateUploadService, CertificateUploadService>();
        }
    }
}
