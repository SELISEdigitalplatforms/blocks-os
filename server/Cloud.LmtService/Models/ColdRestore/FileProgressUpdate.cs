namespace Cloud.LmtService.Models.ColdRestore
{
    /// <summary>
    /// Fields that <c>ILogTraceRestoreRepository.UpdateFileProgressAsync</c> writes to a
    /// file-progress row. <see cref="Status"/> and <see cref="RowsRestored"/> are always written
    /// (RowsRestored defaults to 0); <see cref="ErrorMessage"/> only when it is not blank;
    /// <see cref="StartedAt"/> and <see cref="CompletedAt"/> only when they have a value.
    /// </summary>
    public sealed record FileProgressUpdate(RestoreFileProgressStatus Status)
    {
        public int RowsRestored { get; init; }
        public string? ErrorMessage { get; init; }
        public DateTime? StartedAt { get; init; }
        public DateTime? CompletedAt { get; init; }
    }

    /// <summary>
    /// Fields that the archive-restore file-progress updates
    /// (<c>UpdateFileProgressStatusByIdAsync</c> / <c>UpdateFileProgressStatusByObjectIdAsync</c>)
    /// write. <see cref="Status"/> is always written; every other field only when it has a value
    /// (<see cref="ErrorMessage"/> only when it is not blank). See the repository methods for how
    /// an unset <see cref="RowsRestored"/> is treated.
    /// </summary>
    public sealed record ArchiveFileProgressUpdate(RestoreFileProgressStatus Status)
    {
        public bool? NeedsHydration { get; init; }
        public int? RowsRestored { get; init; }
        public ArchiveHydrationStatus? HydrationStatus { get; init; }
        public DateTime? StartedAt { get; init; }
        public DateTime? CompletedAt { get; init; }
        public string? ErrorMessage { get; init; }
    }
}
