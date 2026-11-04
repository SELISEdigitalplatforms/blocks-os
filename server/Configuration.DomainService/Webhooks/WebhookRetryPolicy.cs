namespace Configuration.DomainService.Webhooks;

/// <summary>What happens after one attempt.</summary>
public enum WebhookAttemptDecision
{
    Delivered,
    Retry,
    Failed
}

/// <summary>
/// Retry rules: 2xx delivered; 3xx and 4xx (except 408 and 429) fail at once; 408, 429, 5xx, timeout and network
/// errors retry up to <see cref="MaxAttempts"/> attempts per run (one call and 3 retries), waiting 30 s, 90 s, 180 s.
/// A longer Retry-After on a 429 wins, capped at <see cref="MaxRetryAfter"/>.
/// </summary>
public static class WebhookRetryPolicy
{
    public const int MaxAttempts = 4;
    public static readonly TimeSpan MaxRetryAfter = TimeSpan.FromSeconds(180);

    private const int TooManyRequests = 429;
    private const int RequestTimeout = 408;

    /// <summary>The waits between attempts; also used by the fan-out retry.</summary>
    internal static readonly TimeSpan[] Waits =
    [
        TimeSpan.FromSeconds(30),
        TimeSpan.FromSeconds(90),
        TimeSpan.FromSeconds(180)
    ];

    /// <param name="result">The attempt's outcome.</param>
    /// <param name="runAttempts">Attempts made in this run, this one included.</param>
    public static WebhookAttemptDecision Decide(WebhookSendResult result, int runAttempts)
    {
        ArgumentNullException.ThrowIfNull(result);
        if (!IsRetryable(result))
        {
            return result.HttpStatus is >= 200 and < 300 ? WebhookAttemptDecision.Delivered : WebhookAttemptDecision.Failed;
        }

        return runAttempts < MaxAttempts ? WebhookAttemptDecision.Retry : WebhookAttemptDecision.Failed;
    }

    /// <summary>The wait before the next attempt, after <paramref name="runAttempts"/> attempts.</summary>
    public static TimeSpan NextWait(int runAttempts, WebhookSendResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        var wait = Waits[Math.Clamp(runAttempts - 1, 0, Waits.Length - 1)];
        if (result.HttpStatus == TooManyRequests && result.RetryAfter is { } retryAfter && retryAfter > wait)
        {
            return retryAfter > MaxRetryAfter ? MaxRetryAfter : retryAfter;
        }

        return wait;
    }

    /// <summary>The error code stored on the attempt; null for a delivered one.</summary>
    public static string? ErrorCodeOf(WebhookSendResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        if (result.ErrorCode is not null)
        {
            return result.ErrorCode;
        }

        return result.HttpStatus switch
        {
            >= 200 and < 300 => null,
            >= 300 and < 400 => WebhookAttemptErrors.Redirect,
            _ => WebhookAttemptErrors.HttpError
        };
    }

    private static bool IsRetryable(WebhookSendResult result)
    {
        if (result.HttpStatus is not { } status)
        {
            // No answer: a refused address never becomes allowed by waiting; timeouts and network errors may pass.
            return result.ErrorCode != WebhookAttemptErrors.UrlNotAllowed;
        }

        return status is RequestTimeout or TooManyRequests or >= 500;
    }
}
