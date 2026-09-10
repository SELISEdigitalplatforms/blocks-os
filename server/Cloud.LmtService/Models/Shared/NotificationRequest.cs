namespace Cloud.LmtService.Models.Shared
{
    /// <summary>
    /// Payload for the notification service's send endpoint.
    ///
    /// Typed on purpose. This was previously built as an anonymous object, where every property
    /// name is valid by definition — so a misspelled <see cref="ConfigurationName"/> compiled
    /// cleanly and the endpoint rejected each send with HTTP 400 for a missing required field.
    /// The send is fire-and-forget, so the only symptom was a logged null result.
    /// </summary>
    public sealed class NotificationRequest
    {
        public string? ConnectionId { get; set; }
        public List<string> UserIds { get; set; } = [];
        public List<string> Roles { get; set; } = [];

        /// <summary>Serialized JSON when <see cref="SaveDenormalizedPayloadAsAnObject"/> is false.</summary>
        public string DenormalizedPayload { get; set; } = string.Empty;
        public bool SaveDenormalizedPayloadAsAnObject { get; set; }

        public string ResponseKey { get; set; } = string.Empty;
        public string ResponseValue { get; set; } = string.Empty;
        public bool ContentAvailable { get; set; }

        /// <summary>Required by the endpoint; comes from NotificationConfig.NotificationConfigName.</summary>
        public string ConfigurationName { get; set; } = string.Empty;
    }
}
