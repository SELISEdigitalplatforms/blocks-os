using Blocks.Genesis;
using BlocksTemplate.Api;
using Cloud.DomainService.Utilities;
using Cloud.LmtService.Utilities;
using CloudConfiguration.DomainService.Shared.Utilities;
using DomainService.Shared;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Secrets.DomainService.Services;
using SeliseBlocks.ConfigurationDriver;

var builder = WebApplication.CreateBuilder(args);
ApplicationConfigurations.ConfigureApiEnv(builder, args);

var serviceName = "blocks-os";
var vaultType = ApplicationConfigurations.ResolveVaultType();
Console.WriteLine($"Using Genesis vault type: {vaultType}");
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(serviceName, vaultType);
Console.WriteLine($"Database Connection String: {secret.DatabaseConnectionString}");

ApplicationConfigurations.ConfigureServices(builder.Services, GetMessageConfiguration(secret.MessageConnectionString));

builder.Configuration.AddMongoDbConfiguration(options =>
{
    options.ConnectionString = secret.DatabaseConnectionString;
    options.DatabaseName = secret.RootDatabaseName;
    options.CollectionName = "Secrets";
    options.SecretKey = "blocks-secret-os";
});
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 15 * 1024 * 1024; // 15 MB
});

var services = builder.Services;

services.AddHealthChecks();

ApplicationConfigurations.ConfigureApi(services, serviceName);

builder.Services.Configure<MvcOptions>(options =>
{
    options.Conventions.Insert(0, new GlobalApiRoutePrefixConvention("api"));
});

var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);

ApplyFrontendRuntimeSettings(builder.Configuration, wwwrootPath);

services.AddApplicationServices();
services.AddCloudDomainServices();
services.AddCloudLmtServices();
services.AddCloudConfigurationServices();
services.AddSingleton<ISecretManagementService, SecretManagementService>();
services.AddSingleton<ISecretRepository, SecretRepository>();


var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

var indexHtml = Path.Combine(app.Environment.WebRootPath ?? "", "index.html");

if (File.Exists(indexHtml))
{
    app.MapFallbackToFile("/index.html");
}


ApplicationConfigurations.ConfigureMiddleware(app);


await app.RunAsync();

//static VaultType ResolveVaultType()
//{
//    var configuredVaultType = Environment.GetEnvironmentVariable("BLOCKS_VAULT_TYPE");
//    if (!string.IsNullOrWhiteSpace(configuredVaultType) &&
//        Enum.TryParse<VaultType>(configuredVaultType, true, out var parsedVaultType))
//    {
//        return parsedVaultType;
//    }

//    var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ??
//                      Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

//    return string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)
//        ? VaultType.OnPrem
//        : VaultType.Azure;
//}

static MessageConfiguration GetMessageConfiguration(string messageConnectionString)
{
    const string DefaultProvider = "azure";
    const string RabbitMqProvider = "rabbitmq";

    string provider;
    if (Uri.TryCreate(messageConnectionString, UriKind.Absolute, out var uri) &&
        (uri.Scheme.Equals("amqp", StringComparison.OrdinalIgnoreCase) ||
         uri.Scheme.Equals("amqps", StringComparison.OrdinalIgnoreCase)))
    {
        provider = RabbitMqProvider;
    }
    else
    {
        provider = DefaultProvider;
    }

    return provider switch
    {
        RabbitMqProvider => new MessageConfiguration
        {
            RabbitMqConfiguration = new RabbitMqConfiguration()
        },
        _ => new MessageConfiguration
        {
            AzureServiceBusConfiguration = new AzureServiceBusConfiguration()
        }
    };
}

static void ApplyFrontendRuntimeSettings(IConfiguration configuration, string webRootPath)
{
    // ACTIVE path: read frontend runtime values from the "FrontendRuntime" section. These
    // are supplied at deploy time from the Mongo "Secrets" document (SecretKey
    // "blocks-secret-os") via AddMongoDbConfiguration, using keys prefixed
    // "FrontendRuntime:BLOCKS_*". Standard .NET config layering still applies, so env vars
    // named "FrontendRuntime__BLOCKS_*" override individual keys.
    var section = configuration.GetSection("FrontendRuntime");
    var replacements = new Dictionary<string, string?>
    {
        ["__BLOCKS_IAM_BASE_URL__"] = section["BLOCKS_IAM_BASE_URL"],
        ["__BLOCKS_IAM_CALLBACK_URL__"] = section["BLOCKS_IAM_CALLBACK_URL"],
        ["__BLOCKS_IAM_CLIENT_ID__"] = section["BLOCKS_IAM_CLIENT_ID"],
        ["__BLOCKS_OS_BASE_URL__"] = section["BLOCKS_OS_BASE_URL"],
        ["__BLOCKS_OS_CALLBACK_URL__"] = section["BLOCKS_OS_CALLBACK_URL"],
    };

    var files = Directory.EnumerateFiles(webRootPath, "*", SearchOption.AllDirectories)
        .Where(path =>
        {
            var ext = Path.GetExtension(path);
            return ext.Equals(".html", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".js", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".css", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".json", StringComparison.OrdinalIgnoreCase);
        });

    foreach (var filePath in files)
    {
        var content = File.ReadAllText(filePath);
        var updated = content;

        foreach (var (token, value) in replacements)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                updated = updated.Replace(token, value, StringComparison.Ordinal);
            }
        }

        if (!ReferenceEquals(content, updated) && !content.Equals(updated, StringComparison.Ordinal))
        {
            File.WriteAllText(filePath, updated);
        }
    }
}
