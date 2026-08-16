using System.Text.Json.Serialization;

namespace Configuration.DomainService.Mail.Template.Models
{
    public sealed class BeeLoginResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }
    }
}
