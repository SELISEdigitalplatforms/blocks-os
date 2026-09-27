namespace Configuration.DomainService.DataGateway.RequestModel
{
    public class SaveDataGatewayConfigurationRequest
    {
        public string? ItemId { get; set; }
        public string? ProjectKey { get; set; }
        public string? ConnectionString { get; set; }
        public string? DatabaseName { get; set; }
        public bool IsCollectionNameEditable { get; set; }
        public string? CollectionNamePattern { get; set; }
        public bool? EnableAnalytics { get; set; }
        public bool UpdateRequest { get; set; }
    }
}
