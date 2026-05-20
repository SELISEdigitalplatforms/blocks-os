using Blocks.Genesis;
using System;
using System.Collections.Generic;
using System.Text;

namespace Secrets.DomainService.ResponseModel
{
    public class GetSecretRequest : IProjectKey
    {
        public string ItemId { get; set; }
        public string? ProjectKey { get ; set ; }
    }
}
