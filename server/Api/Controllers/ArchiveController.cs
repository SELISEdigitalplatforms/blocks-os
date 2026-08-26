using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
 [ApiController]
 [Route("[controller]/[action]")]
 public class ArchiveController : ControllerBase //controller Used for testing the archive and delete functionality
 {
  private readonly IMessageClient _messageClient;
  private readonly ILogger<ArchiveController> _logger;

  public ArchiveController (
      IMessageClient messageClient,
      ILogger<ArchiveController> logger )
  {
   _messageClient = messageClient;
   _logger = logger;
  }

  [HttpPost]
  public async Task<ActionResult<SimpleResponse>> EnqueueBackup ( )
  {
   try
   {
    _logger.LogInformation("EnqueueBackup API called - enqueueing backup process");

    var message = new PublishScheduleCommand();
    await EnqueueBackupCommandAsync(message);

    return Ok(new SimpleResponse
    {
     Success = true,
     Message = "Backup process enqueued successfully. Check worker logs for detailed summary."
    });
   }
   catch (Exception ex)
   {
    _logger.LogError(ex, "Error enqueueing backup process");
    return StatusCode(500, new SimpleResponse
    {
     Success = false,
     Message = $"Failed to enqueue backup process: {ex.Message}"
    });
   }
  }

  private Task EnqueueBackupCommandAsync ( PublishScheduleCommand message )
  {
   return _messageClient.SendToConsumerAsync(
       new ConsumerMessage<PublishScheduleCommand>
       {
        ConsumerName =Constants.StartBackupQueue,
        Payload = message
       }
   );
  }

 }

 public class SimpleResponse
 {
  public bool Success { get; set; }
  public string Message { get; set; }
 }
}
