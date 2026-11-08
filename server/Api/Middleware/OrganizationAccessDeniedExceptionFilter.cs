using Blocks.Genesis;
using Configuration.DomainService.Organizations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BlocksOs.Api.Middleware;

/// <summary>
/// A caller confined to its token's organization reached for another organization's records: 403 with the envelope
/// the rest of the API uses, so a client reads the reason from <c>errors</c> as it does for a 400.
/// </summary>
public sealed class OrganizationAccessDeniedExceptionFilter : IExceptionFilter
{
    /// <summary>The <c>errors</c> key of the refusal, named like the project access filter's <c>own_project</c>.</summary>
    public const string ErrorKey = "own_organization";

    public void OnException(ExceptionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.Exception is not OrganizationAccessDeniedException exception)
            return;

        context.Result = new ObjectResult(new BaseResponse
        {
            IsSuccess = false,
            Errors = new Dictionary<string, string> { [ErrorKey] = exception.Message },
        })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
        context.ExceptionHandled = true;
    }
}
