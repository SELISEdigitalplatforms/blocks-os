namespace Cloud.LmtService.Models.ColdRestore
{
    /// <summary>
    /// What restore needs to know about a blob before planning it: whether it is there, and whether
    /// it has to be rehydrated before anything can read it.
    /// </summary>
    /// <param name="Exists">False when no blob was written for that tenant, date and data type.</param>
    /// <param name="IsArchived">
    /// True while the blob sits in the Archive tier. Reads fail with HTTP 409 until rehydration
    /// finishes, so the cold path must reject it and the archive path must hydrate it first.
    /// </param>
    public sealed record BlobTierState(bool Exists, bool IsArchived)
    {
        public static BlobTierState Missing { get; } = new(false, false);
    }
}
