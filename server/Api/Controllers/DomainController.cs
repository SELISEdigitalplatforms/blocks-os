using System.Text.Json;
using System.Threading.Channels;
using Blocks.Genesis;
using DomainService.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace BlocksOs.Api.Controllers
{
 [ApiController]
 [Route("[controller]/[action]")]
 public class DomainController : ControllerBase
 {
  // Keeps idle proxies and load balancers from closing the stream while certbot runs
  private static readonly TimeSpan StreamHeartbeatInterval = TimeSpan.FromSeconds(15);
  private static readonly JsonSerializerOptions StreamJsonOptions = new(JsonSerializerDefaults.Web);

  private readonly IDomainManagementService _domainManagementService;
  private readonly ILogger<DomainController> _logger;

  public DomainController(IDomainManagementService domainManagementService, ILogger<DomainController> logger)
  {
   _domainManagementService = domainManagementService;
   _logger = logger;
  }

  [Authorize]
  [HttpPost]
  public async Task<BaseResponse> Configure([FromBody] ConfigureDomainRequest request)
  {
    if (string.IsNullOrWhiteSpace(request.CookieDomain))
    {
     return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "missing_required_fields", "domain name is missing" } } };
    }

    return await _domainManagementService.ConfigureDomainAsync(request);
  }

  [Authorize]
  [HttpGet]
  public async Task<DomainSetupGuideResponse> SetupGuide()
  {
    return await _domainManagementService.GetDomainSetupGuideAsync();
  }

  /// <summary>
  /// Configures a domain like <see cref="Configure"/>, streaming each step as a server-sent
  /// event: "step" events (<see cref="DomainSetupProgress"/>) while it runs, then one "result"
  /// event (<see cref="BaseResponse"/>). The run does not depend on the connection: a browser
  /// that goes away mid-run leaves it to finish, and the domain's status shows the outcome.
  /// </summary>
  [Authorize]
  [HttpPost]
  public async Task ConfigureStream([FromBody] ConfigureDomainRequest request)
  {
    var aborted = HttpContext.RequestAborted;

    Response.ContentType = "text/event-stream";
    Response.Headers.CacheControl = "no-cache, no-transform";
    // Stops nginx-style proxies from holding the events back until the response ends
    Response.Headers["X-Accel-Buffering"] = "no";
    HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

    if (string.IsNullOrWhiteSpace(request?.CookieDomain))
    {
     await WriteEventAsync("result", new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "missing_required_fields", "domain name is missing" } } }, aborted);
     return;
    }

    var events = Channel.CreateUnbounded<(string Name, object Data)>();

    // Deliberately not awaited and not tied to the request: cancelling mid-run would leave
    // the proxy with a vhost and no certificate. Events queue up whether or not anyone reads.
    _ = Task.Run(async () =>
    {
     try
     {
      var result = await _domainManagementService.ConfigureDomainWithProgressAsync(
       request,
       progress => events.Writer.WriteAsync(("step", progress)).AsTask());

      events.Writer.TryWrite(("result", result));
     }
     catch (Exception ex)
     {
      _logger.LogError(ex, "Guided setup failed unexpectedly for {Domain}", request.CookieDomain);
      events.Writer.TryWrite(("result", new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "setup_failed", "Domain setup failed unexpectedly. Please try again." } } }));
     }
     finally
     {
      events.Writer.TryComplete();
     }
    });

    try
    {
     Task<bool>? waitForEvent = null;

     while (true)
     {
      waitForEvent ??= events.Reader.WaitToReadAsync(aborted).AsTask();

      if (await Task.WhenAny(waitForEvent, Task.Delay(StreamHeartbeatInterval, aborted)) != waitForEvent)
      {
       await WriteRawAsync(": heartbeat\n\n", aborted);
       continue;
      }

      var hasMore = await waitForEvent;
      waitForEvent = null;

      if (!hasMore)
      {
       break;
      }

      while (events.Reader.TryRead(out var item))
      {
       await WriteEventAsync(item.Name, item.Data, aborted);
      }
     }
    }
    catch (OperationCanceledException) when (aborted.IsCancellationRequested)
    {
     _logger.LogInformation("Client left the setup stream for {Domain}; setup continues in the background", request.CookieDomain);
    }
  }

  private Task WriteEventAsync(string name, object data, CancellationToken cancellationToken) =>
   WriteRawAsync($"event: {name}\ndata: {JsonSerializer.Serialize(data, data.GetType(), StreamJsonOptions)}\n\n", cancellationToken);

  private async Task WriteRawAsync(string payload, CancellationToken cancellationToken)
  {
    await Response.WriteAsync(payload, cancellationToken);
    await Response.Body.FlushAsync(cancellationToken);
  }
 }
}
