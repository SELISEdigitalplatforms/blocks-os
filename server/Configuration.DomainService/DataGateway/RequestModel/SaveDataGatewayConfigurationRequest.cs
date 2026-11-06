namespace Configuration.DomainService.DataGateway.RequestModel
{
    public class SaveDataGatewayConfigurationRequest
    {
        public string? ItemId { get; set; }
        public string? ProjectKey { get; set; }

        /// <summary>
        /// <c>default</c> or empty = Blocks DB; anything else = the real connection string (plain). Null on an update of an
        /// existing Custom configuration = keep the saved secret.
        /// </summary>
        public string? ConnectionString { get; set; }
        public string? DatabaseName { get; set; }
        public bool IsCollectionNameEditable { get; set; }
        public string? CollectionNamePattern { get; set; }
        public bool? EnableAnalytics { get; set; }
        public bool UpdateRequest { get; set; }
    }
}
