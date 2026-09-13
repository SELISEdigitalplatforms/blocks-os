namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// Triggers the nightly archive-and-delete pass. The backup has a command of its own so that
    /// PublishScheduleCommand is free to mean "some scheduled maintenance job" rather than
    /// "the backup", which is what it silently meant while it was the only one registered.
    /// </summary>
    public class RunBackupCommand
    { }

    /// <summary>
    /// Triggers the expired-data sweep. Carried on its own queue rather than folded into the backup
    /// command so a cleanup failure cannot force the whole backup to be retried.
    /// </summary>
    public class RunCleanupCommand
    { }

    /// <summary>
    /// Triggers a rehydration poll. Separate from the backup command because it wants a far tighter
    /// schedule: this poll is what converts a finished rehydration into restored rows, so its
    /// interval sets the tail latency of every archive restore.
    /// </summary>
    public class RunHydrationCheckCommand
    { }
}
