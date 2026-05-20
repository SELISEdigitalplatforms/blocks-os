using Blocks.Genesis;
using System;
using System.Collections.Generic;
using System.Text;

namespace Secrets.DomainService.ResponseModel
{
    public class SaveSecretRequest : IProjectKey
    {
        public string SecretKey { get; set; }
        public Dictionary<string, string> KeyValuePairs { get; set; }
        public string? ItemId { get; set; }
        public string? ProjectKey { get; set ; }
    }
}
