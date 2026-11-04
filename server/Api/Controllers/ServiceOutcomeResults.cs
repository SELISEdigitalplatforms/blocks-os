using Blocks.Genesis;
using Configuration.DomainService.Shared.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>Maps a <see cref="ServiceOutcome{T}"/> to HTTP: 200 with the value, or 400/404/409 with <c>Errors.code</c>.</summary>
public static class ServiceOutcomeResults
{
    public const string ErrorCodeKey = "code";

    public static ActionResult<T> ToActionResult<T>(this ControllerBase controller, ServiceOutcome<T> outcome)
    {
        ArgumentNullException.ThrowIfNull(outcome);
        if (outcome.IsOk)
        {
            return controller.Ok(outcome.Value);
        }

        var status = outcome.Status switch
        {
            OutcomeStatus.NotFound => StatusCodes.Status404NotFound,
            OutcomeStatus.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        var body = new BaseResponse
        {
            IsSuccess = false,
            Errors = new Dictionary<string, string> { [ErrorCodeKey] = outcome.ErrorCode ?? string.Empty }
        };
        return controller.StatusCode(status, body);
    }
}
