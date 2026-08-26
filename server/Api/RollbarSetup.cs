using Microsoft.Extensions.Logging;
using Rollbar;
using Rollbar.NetCore.AspNet;

// Rollbar ships its own ILogger; this file always means the framework one.
using ILogger = Microsoft.Extensions.Logging.ILogger;

namespace BlocksOs.Api;

/// <summary>
/// Wires Rollbar error reporting into the host.
/// </summary>
/// <remarks>
/// Reporting is opt-in. With no <c>Rollbar:AccessToken</c> in configuration every member here is
/// a no-op, so developer machines and any environment that has not been seeded stay silent
/// instead of failing at startup. The token is expected to arrive from the Mongo "Secrets"
/// document (SecretKey "blocks-secret-os") like every other deploy-time value; see
/// <see cref="Program"/>.
/// <para>
/// Rollbar sits alongside the Genesis log pipeline (console/Mongo/LMT) rather than replacing it:
/// Genesis owns Serilog and it is the log store of record. Rollbar exists for alerting and
/// grouping, so it only ever receives faults.
/// </para>
/// </remarks>
internal static class RollbarSetup
{
    private const string AccessTokenKey = "Rollbar:AccessToken";
    private const string EnvironmentKey = "Rollbar:Environment";
    private const string CodeVersionKey = "Rollbar:CodeVersion";
    private const string CaptureLogsKey = "Rollbar:CaptureLogs";

    /// <summary>
    /// Header and payload names never sent to Rollbar. Rollbar scrubs a default set already;
    /// these are the ones specific to this platform, and getting them wrong would ship tenant
    /// credentials to a third party.
    /// </summary>
    private static readonly string[] ScrubFields =
    [
        "x-blocks-key",
        "X-Blocks-Key",
        "Authorization",
        "authorization",
        "access_token",
        "refresh_token",
        "accessToken",
        "refreshToken",
        "password",
        "clientSecret",
        "client_secret",
        "connectionString",
        "secretValue",
    ];

    /// <summary>
    /// True once <see cref="Initialize"/> has found a token and brought Rollbar up. Callers must
    /// check this before touching <see cref="RollbarLocator"/>, which throws when the
    /// infrastructure was never initialised.
    /// </summary>
    internal static bool IsEnabled { get; private set; }

    /// <summary>The environment name reports are filed under, recorded so startup can log it.</summary>
    private static string _environmentName = "unknown";

    /// <summary>
    /// Brings up the Rollbar singleton. Safe to call when unconfigured (does nothing) and safe to
    /// call twice (the second call is ignored) -- the underlying infrastructure throws on
    /// re-initialisation.
    /// </summary>
    internal static void Initialize(IConfiguration configuration, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        if (IsEnabled)
        {
            return;
        }

        var accessToken = configuration[AccessTokenKey];
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return;
        }

        var config = new RollbarInfrastructureConfig(
            accessToken,
            configuration[EnvironmentKey] is { Length: > 0 } configured
                ? configured
                : environment.EnvironmentName);

        config.RollbarLoggerConfig.RollbarDataSecurityOptions.Reconfigure(
            new RollbarDataSecurityOptions(
                PersonDataCollectionPolicies.None,
                IpAddressCollectionPolicy.CollectAnonymized,
                ScrubFields,
                []));

        var codeVersion = configuration[CodeVersionKey];
        if (!string.IsNullOrWhiteSpace(codeVersion))
        {
            config.RollbarLoggerConfig.RollbarPayloadAdditionOptions.CodeVersion = codeVersion;
        }

        RollbarInfrastructure.Instance.Init(config);

        _environmentName = config.RollbarLoggerConfig.RollbarDestinationOptions.Environment ?? "unknown";
        IsEnabled = true;
    }

    /// <summary>
    /// Says in the log whether reporting is on, and surfaces Rollbar's own delivery failures.
    /// </summary>
    /// <remarks>
    /// Without this, a token with the wrong scope, a suspended token or a blocked egress route all
    /// look identical from the outside: no items, no explanation. Rollbar transmits on a background
    /// queue and swallows its own failures by design, so its internal event stream is the only
    /// place those show up.
    /// <para>
    /// Call after the host is built, so this uses the real logger and lands in the Genesis
    /// pipeline (console plus Mongo/LMT) rather than bypassing it.
    /// </para>
    /// </remarks>
    internal static void AttachDiagnostics(ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(logger);

        if (!IsEnabled)
        {
            logger.LogInformation(
                "Rollbar reporting is OFF: no {ConfigKey} configured.", AccessTokenKey);
            return;
        }

        logger.LogInformation(
            "Rollbar reporting is ON for environment {RollbarEnvironment}.", _environmentName);

        RollbarInfrastructure.Instance.QueueController!.InternalEvent += (_, args) =>
        {
            switch (args)
            {
                // Rollbar answered and refused the payload. A token of the wrong scope lands here.
                case RollbarApiErrorEventArgs apiError:
                    logger.LogError(
                        "Rollbar rejected a payload: {ErrorCode} {ErrorDescription}",
                        apiError.ErrorCode,
                        apiError.ErrorDescription);
                    break;

                case PayloadDropEventArgs dropped:
                    logger.LogWarning("Rollbar dropped a payload: {Reason}", dropped.Reason);
                    break;

                case CommunicationErrorEventArgs commsError:
                    logger.LogWarning(
                        commsError.Error,
                        "Rollbar transmission failed, {RetriesLeft} retries left.",
                        commsError.RetriesLeft);
                    break;

                case InternalErrorEventArgs internalError:
                    logger.LogWarning(
                        internalError.Error, "Rollbar internal error: {Details}", internalError.Details);
                    break;

                // Proof of delivery, at Debug so a healthy service stays quiet.
                case CommunicationEventArgs:
                    logger.LogDebug("Rollbar accepted a payload.");
                    break;

                default:
                    break;
            }
        };
    }

    /// <summary>
    /// Optionally forwards <see cref="LogLevel.Error"/> and above from <c>ILogger</c> to Rollbar.
    /// </summary>
    /// <remarks>
    /// Off unless <c>Rollbar:CaptureLogs</c> is true. <see cref="RollbarExceptionFilter"/> already
    /// reports controller faults with a real exception and tenant context, and Genesis's
    /// <c>GlobalExceptionHandlerMiddleware</c> logs those same faults -- so enabling both means two
    /// Rollbar items per error. Turn this on to reach faults raised outside the MVC pipeline
    /// (middleware, hosted services), accepting the duplicates.
    /// <para>
    /// Must be called after <c>ApplicationConfigurations.ConfigureApi</c>: Genesis calls
    /// <c>ClearProviders()</c> when it installs Serilog, and logging-builder callbacks run in
    /// registration order, so a provider added before that call would be dropped.
    /// </para>
    /// </remarks>
    internal static void AddLogCapture(IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        if (!IsEnabled || !configuration.GetValue(CaptureLogsKey, false))
        {
            return;
        }

        services.AddRollbarLogger(options =>
            options.Filter = (_, logLevel) => logLevel >= LogLevel.Error);
    }
}
