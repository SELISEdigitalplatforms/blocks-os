using System.Text.Json.Serialization;

namespace Configuration.DomainService.Mail.ResponseModel
{
    /// <summary>How many templates name a configuration, across all organizations.</summary>
    public class MailConfigurationUsageResponse
    {
        public bool IsSuccess { get; set; }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public long? TemplateCount { get; set; }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public Dictionary<string, string>? Errors { get; set; }
    }
}
