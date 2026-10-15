using Configuration.DomainService.DataGateway.Entities;

namespace Configuration.DomainService.DataGateway.ResponseModel
{
    /// <summary>GET answer. Never carries the connection string or the secret value, only its kind.</summary>
    public class DataGatewayConfigurationResponse
    {
        public string ItemId { get; set; } = string.Empty;

        /// <summary><c>Default</c> or <c>Custom</c>.</summary>
        public string ConnectionType { get; set; } = string.Empty;
        public string ProjectKey { get; set; } = string.Empty;
        public string ProjectShortKey { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public bool IsCollectionNameEditable { get; set; }
        public string CollectionNamePattern { get; set; } = string.Empty;
        public AnalyticsConfiguration? AnalyticsConfiguration { get; set; }
    }
}
