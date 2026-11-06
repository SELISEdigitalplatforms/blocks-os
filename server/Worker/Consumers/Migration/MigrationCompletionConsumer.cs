using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Migration;
using DomainService.Migration.Services;
using Blocks.Genesis.Entities.Os;
using Os.DataAccess.Notifications;
using System;
using System.Collections.Generic;
using System.Text;

namespace Worker.Consumers.Migration
 {
  public class MigrationCompletionConsumer : IConsumer<MigrationCompletionEvent>
  {
     private readonly IMigrationRepository _migrationRepository;
     private readonly ILogger<MigrationCompletionConsumer> _logger;
     private readonly IMigrationService _migrationService;
     private readonly IBuiltInNotificationSender? _notificationSender;
     private readonly IConfiguration? _configuration;

     public MigrationCompletionConsumer (
         IMigrationRepository migrationRepository,
         ILogger<MigrationCompletionConsumer> logger,
         IMigrationService migrationService,
         IBuiltInNotificationSender? notificationSender = null,
         IConfiguration? configuration = null )
      {
      _migrationRepository = migrationRepository;
      _logger = logger;
      _migrationService = migrationService;
      _notificationSender = notificationSender;
      _configuration = configuration;
      }

    public async Task Consume ( MigrationCompletionEvent migrationCompletion )
   {
    // No local catch: exceptions propagate unchanged to the Blocks.Genesis consumer dispatcher, which
    // logs them; TrackerId and ServiceName for this message are in the "Processing migration completion" log.
    _logger.LogInformation(
        "Processing migration completion for TrackerId: {TrackerId}, Service: {ServiceName}, Success: {IsSuccess}",
        migrationCompletion.TrackerId,
        migrationCompletion.ServiceName,
        migrationCompletion.IsSuccess);

    // Parse the service name to enum
    if (!Enum.TryParse<MigrationServiceNames>(migrationCompletion.ServiceName, true, out var serviceName))
     {
     _logger.LogError(
         "Invalid service name '{ServiceName}' for TrackerId: {TrackerId}",
         migrationCompletion.ServiceName,
         migrationCompletion.TrackerId);
     return;
     }

    // Update the migration tracker with completion status
    var updateResult = await _migrationRepository.UpdateServiceStatusAsync(
        migrationCompletion.TrackerId,
        serviceName,
        migrationCompletion.IsSuccess,
        migrationCompletion.ErrorMessage);

    var tracker = await _migrationRepository.GetMigrationTrackerAsync(migrationCompletion.TrackerId);
    if (tracker == null)
     {
     _logger.LogError(
         "Migration tracker not found for TrackerId: {TrackerId}",
         migrationCompletion.TrackerId);
     return;
    }

    await _migrationService.NotifyServiceDataMigrationProgress(migrationCompletion.IsSuccess, tracker.ProjectKey, tracker.TargetedProjectKey);

    if (updateResult)
    {
    _logger.LogInformation(
        "Successfully updated migration status for TrackerId: {TrackerId}, Service: {ServiceName}",
        migrationCompletion.TrackerId,
        migrationCompletion.ServiceName);

    if (tracker != null && _migrationService.AreAllServicesCompleted(tracker))
     {
     _logger.LogInformation(
         "All services completed for TrackerId: {TrackerId}. Sending final migration completion notification.",
         migrationCompletion.TrackerId);
     await _migrationService.NotifyDataMigrationEvent(true, tracker.ProjectKey, tracker.TargetedProjectKey);
     }
    else
     {
     await NotifyIfFinishedWithFailuresAsync(tracker, serviceName, migrationCompletion.IsSuccess);
     }
    }
    else
    {
    _logger.LogWarning(
        "Failed to update migration status for TrackerId: {TrackerId}, Service: {ServiceName}. Tracker may not exist.",
        migrationCompletion.TrackerId,
        migrationCompletion.ServiceName);
    }
   }

  /// <summary>
  /// The final "success" push above is sent only when every service succeeded. When every requested
  /// service has reported and at least one failed, the user who started the migration gets
  /// <c>os-data-migration-failed</c> instead. Sent in the root tenant, like the existing migration pushes.
  /// </summary>
  private async Task NotifyIfFinishedWithFailuresAsync(MigrationTracker tracker, MigrationServiceNames current, bool currentSucceeded)
  {
   if (_notificationSender is null)
    {
    return;
    }

   var services = ServiceStatuses(tracker).Where(s => s.Status != null).ToList();
   if (services.Count == 0)
    {
    return;
    }

   // The service that just reported counts as reported even when its failure carried no message.
   bool Reported(MigrationServiceNames name, ServiceMigrationStatus status) =>
       name == current || status.IsCompleted || !string.IsNullOrEmpty(status.ErrorMessage);
   bool Failed(MigrationServiceNames name, ServiceMigrationStatus status) =>
       name == current ? !currentSucceeded : !status.IsCompleted && !string.IsNullOrEmpty(status.ErrorMessage);

   if (!services.All(s => Reported(s.Name, s.Status!)))
    {
    return;
    }

   var failed = services.Where(s => Failed(s.Name, s.Status!)).Select(s => s.Name.ToString()).ToList();
   if (failed.Count == 0)
    {
    return;
    }

   var startedBy = string.Equals(tracker.CreatedBy, "system", StringComparison.Ordinal) ? null : tracker.CreatedBy;

   await _notificationSender.SendAsync(new BuiltInNotification
    {
    ConfigurationName = BuiltInNotificationNames.DataMigrationFailed,
    Event = "migration-finished-with-failures",
    Title = "Environment data migration finished with errors",
    Description = $"{failed.Count} of {services.Count} services failed: {string.Join(", ", failed)}",
    IsSuccess = false,
    Ids = new Dictionary<string, string?>
     {
     ["trackerId"] = tracker.ItemId,
     ["projectKey"] = tracker.ProjectKey,
     ["targetedProjectKey"] = tracker.TargetedProjectKey
     },
    UserIds = [startedBy],
    TenantId = _configuration?["RootTenantId"]
    });
  }

  private static IEnumerable<(MigrationServiceNames Name, ServiceMigrationStatus? Status)> ServiceStatuses(MigrationTracker tracker) =>
  [
   (MigrationServiceNames.Authentication, tracker.Authentication),
   (MigrationServiceNames.IAM, tracker.IAM),
   (MigrationServiceNames.MFA, tracker.MFA),
   (MigrationServiceNames.CAPTCHA, tracker.CAPTCHA),
   (MigrationServiceNames.Email, tracker.Email),
   (MigrationServiceNames.DataGateway, tracker.DataGateway),
   (MigrationServiceNames.Notifications, tracker.Notifications),
   (MigrationServiceNames.Storage, tracker.Storage),
   (MigrationServiceNames.Language, tracker.LanguageService)
  ];
  }
 }
