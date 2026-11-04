namespace Configuration.DomainService.Storage
{
    /// <summary>Error texts of the storage configuration API (shared by the validator and the service).</summary>
    public static class StorageConfigurationMessages
    {
        public const string NameNotUnique = "Name should be unique";
        public const string NotFound = "Storage configuration not found.";
    }
}
