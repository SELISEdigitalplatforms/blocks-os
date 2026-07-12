
namespace CloudConfiguration.DomainService.Storage.Enums
{
    /// <summary>
    /// Broad classification of a storage strategy: remote cloud object storage
    /// versus on-premises file storage.
    /// </summary>
    public enum StorageStrategyCategory
    {
        /// <summary>Storage lives in a managed cloud object store (S3, Azure Blob, ...).</summary>
        Cloud = 0,

        /// <summary>Storage lives on the local file system of the running node.</summary>
        Local = 1,
    }
}
