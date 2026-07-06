namespace Secrets.DomainService.ResponseModel
{
    public class SaveSecretRequest
    {
        public string SecretKey { get; set; }
        public Dictionary<string, string> KeyValuePairs { get; set; }
        public string? ItemId { get; set; }
    }
}
