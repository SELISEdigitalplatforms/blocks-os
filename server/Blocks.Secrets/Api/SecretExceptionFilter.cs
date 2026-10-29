using Blocks.Genesis;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Blocks.Secrets;

/// <summary>
/// Maps secret-domain exceptions onto HTTP status codes.
/// </summary>
/// <remarks>
/// Ships with the package so every host that exposes secrets gets the same status codes, but
/// the domain itself stays transport-agnostic: <see cref="ISecretService"/> throws and knows
/// nothing about HTTP, which is what lets workers and other services use it unchanged.
/// <para>
/// The response carries the machine-readable reason code but never the exception's stack or
/// inner message — a vault failure's inner detail can name infrastructure the caller has no
/// business seeing.
/// </para>
/// </remarks>
public sealed class SecretExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var (statusCode, errorKey) = context.Exception switch
        {
            SecretValidationException => (StatusCodes.Status400BadRequest, "invalid_request"),
            SecretAccessDeniedException => (StatusCodes.Status403Forbidden, "access_denied"),
            SecretNotFoundException => (StatusCodes.Status404NotFound, "not_found"),
            SecretStateException => (StatusCodes.Status409Conflict, "invalid_state"),
            SecretVaultException => (StatusCodes.Status502BadGateway, "vault_unavailable"),
            _ => (0, string.Empty)
        };

        if (statusCode == 0)
        {
            return;
        }

        var exception = (SecretException)context.Exception;

        var errors = new Dictionary<string, string> { [errorKey] = BuildMessage(exception, statusCode) };

        if (!string.IsNullOrWhiteSpace(exception.ReasonCode))
        {
            errors["reason"] = exception.ReasonCode;
        }

        context.Result = new ObjectResult(new BaseResponse { IsSuccess = false, Errors = errors })
        {
            StatusCode = statusCode
        };

        context.ExceptionHandled = true;
    }

    private static string BuildMessage(SecretException exception, int statusCode) =>
        statusCode == StatusCodes.Status502BadGateway
            // Deliberately generic: the underlying vault error can name hosts, URLs and
            // credential types that must not reach an API caller.
            ? "The secret store is currently unavailable."
            : exception.Message;
}
