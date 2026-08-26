using Blocks.Genesis;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Rollbar;

namespace BlocksOs.Api;

/// <summary>
/// Reports controller faults to Rollbar. Never alters the response.
/// </summary>
/// <remarks>
/// A filter rather than middleware, because Genesis registers
/// <c>GlobalExceptionHandlerMiddleware</c> from <c>ConfigureMiddleware</c> -- the last middleware
/// in the pipeline, and therefore the innermost. It turns the exception into a response, so
/// nothing outside it ever sees the throw and Rollbar's own middleware would report almost
/// nothing. The MVC filter stage runs inside all of that, where the exception is still an
/// exception and the request-scoped <see cref="BlocksContext"/> is still resolvable.
/// </remarks>
public sealed class RollbarExceptionFilter : IExceptionFilter, IOrderedFilter
{
    private readonly ILogger<RollbarExceptionFilter> _logger;

    /// <summary>Initializes a new instance of the <see cref="RollbarExceptionFilter"/> class.</summary>
    /// <param name="logger">Used only to record a failure to reach Rollbar.</param>
    public RollbarExceptionFilter(ILogger<RollbarExceptionFilter> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Runs as the outermost exception filter. Exception filters execute from the innermost
    /// outward, so the lowest <c>Order</c> runs last -- which is what lets
    /// <see cref="ShouldReport"/> see whether another filter (e.g. <c>SecretExceptionFilter</c>)
    /// already turned this exception into a deliberate status code.
    /// </summary>
    public int Order => int.MinValue;

    /// <summary>Reports the exception, then leaves the response exactly as it found it.</summary>
    /// <param name="context">The exception context supplied by the MVC filter pipeline.</param>
    public void OnException(ExceptionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (!RollbarSetup.IsEnabled || !ShouldReport(context))
        {
            return;
        }

        try
        {
            RollbarLocator.RollbarInstance.Error(BuildPackage(context));
        }
        catch (Exception reportingFailure)
        {
            // Telemetry must never turn a handled fault into a second, worse one. The original
            // exception is already on its way to the Genesis pipeline, so a Rollbar outage costs
            // us nothing but this line.
            _logger.LogWarning(reportingFailure, "Failed to report an exception to Rollbar.");
        }
    }

    /// <summary>
    /// Skips what would only be noise: client disconnects, and business rules another filter
    /// deliberately answered with a 4xx. A handled exception that still resolves to 5xx -- a vault
    /// outage surfaced as 502, say -- is a real fault and is reported.
    /// </summary>
    private static bool ShouldReport(ExceptionContext context)
    {
        if (context.Exception is OperationCanceledException)
        {
            return false;
        }

        if (!context.ExceptionHandled)
        {
            return true;
        }

        var statusCode = (context.Result as IStatusCodeActionResult)?.StatusCode
            ?? context.HttpContext.Response.StatusCode;

        return statusCode >= StatusCodes.Status500InternalServerError;
    }

    private static CustomKeyValuePackageDecorator BuildPackage(ExceptionContext context)
    {
        var blocksContext = BlocksContext.GetContext();
        var request = context.HttpContext.Request;

        var custom = new Dictionary<string, object?>
        {
            ["tenantId"] = blocksContext?.TenantId,
            ["organizationId"] = blocksContext?.OrganizationId,
            ["method"] = request.Method,
            ["path"] = request.Path.Value,
            ["traceId"] = context.HttpContext.TraceIdentifier,
        };

        // Rollbar renders the custom block verbatim, so blank entries are pure noise in the UI.
        var populated = custom
            .Where(entry => entry.Value is string text ? text.Length > 0 : entry.Value is not null)
            .ToDictionary(entry => entry.Key, entry => entry.Value);

        IRollbarPackage package = new ExceptionPackage(context.Exception, context.Exception.Message);

        var userId = blocksContext?.UserId;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            package = new PersonPackageDecorator(
                package,
                new Rollbar.DTOs.Person(userId) { Email = blocksContext?.Email });
        }

        return new CustomKeyValuePackageDecorator(package, populated);
    }
}
