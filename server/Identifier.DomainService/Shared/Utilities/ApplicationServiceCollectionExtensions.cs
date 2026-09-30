using Blocks.Extension.DependencyInjection;
using Blocks.Genesis;
using DomainService.Access;
using DomainService.Access.Services;
using DomainService.Billing.Services;
using DomainService.Catalogue.Services;
using DomainService.Certificate;
using DomainService.ManagedService;
using DomainService.ManagedService.Services;
using DomainService.ManagedService.Validator;
using DomainService.Migration;
using DomainService.Migration.Services;
using DomainService.People;
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
        /// <param name="isProduction">
        /// Whether live payment credentials may be used. False refuses them, so a non-production
        /// deployment cannot charge a real card however it is configured.
        /// </param>
        /// <param name="logicBaseUrl">
        /// Where blocks-logic serves its notification hub, for pushing order progress to the
        /// console. Empty leaves progress unsent, which costs live updates and nothing else.
        /// </param>
        public static void AddApplicationServices(
            this IServiceCollection services,
            bool isProduction = false,
            string? logicBaseUrl = null)
        {
            // The catalogue: published to the platform database, served to the console, seeded per
            // tenant. Adding a meter is an edit to that data, not to this file.
            services.AddBlocksCatalogue();
            // Subscriptions: cards, orders, payment and the workers that build what was bought.
            services.AddBlocksBilling(isProduction, logicBaseUrl);

            // Quota enforcement. Genesis knows how to check and record; it never learns what a
            // credit costs or what counts as a build.
            //
            // Only present on a Genesis that has the quota work. Build with
            // -p:UseLocalGenesis=true to reference ../../blocks-genesis-net directly; on the
            // published package this compiles once the version is cut.
#if GENESIS_QUOTA
            services.AddBlocksQuota();
#endif
            // Register validator
            services.AddTransient<IValidator<CreateProjectRequest>, CreateProjectRequestValidator>();
            services.AddTransient<IValidator<UpdateAuthConfigRequest>, UpdateAuthConfigRequestValidator>();
            services.AddTransient<IValidator<UpdateProjectRequest>, UpdateProjectRequestValidator>();
            services.AddTransient<IValidator<RegisterServiceRequest>, RegisterServiceRequestValidator>();
            services.AddTransient<IValidator<MigrationRequest>, MigrationRequestValidator>();

   // Register services
            services.AddSingleton<IProjectManagementService, ProjectManagementService>();
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
            services.AddSingleton<IPeopleRepository, PeopleRepository>();

            // Project access (owner / contributor grants)
            // Scoped, not singleton: it caches the per-request access resolution through
            // IHttpContextAccessor, and a singleton would hand one caller's answer to the next.
            services.AddHttpContextAccessor();
            services.AddScoped<IProjectAccessService, ProjectAccessService>();
            services.AddScoped<ProjectPolicyFilter>();

            // Drivers
            services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();

            services.RegisterBlocksStorageServices();
            services.RegisterBlocksMailService();

            // Registered after RegisterBlocksStorageServices: it resolves IStorageDriverService.
            services.AddSingleton<ICertificateUploadService, CertificateUploadService>();
        }
    }
}
