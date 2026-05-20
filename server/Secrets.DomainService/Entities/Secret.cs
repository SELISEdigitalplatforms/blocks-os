using Blocks.Genesis;

namespace Secrets.DomainService.Entities
{
    public class Secret : BaseEntity 
    {
        public string SecretKey { get; set; } = string.Empty;
        public Dictionary<string, string> KeyValuePairs { get; set; }
    }
}
