namespace Cloud.LmtService.Models.ArchiveAndDelete
{
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
