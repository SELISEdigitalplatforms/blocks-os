using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DomainService.Shared.Entities
{
    public class DisableDomainBindingRequest
    {
        /// <summary>
        /// Tenant id of the project the domain belongs to — this is what the
        /// consumer looks the project up by, not the project's ItemId.
        /// </summary>
        public string ProjectId { get; set; }

        /// <summary>
        /// The application's own host to unbind, with or without a scheme. Never
        /// the shared blocksapi host: that one serves every application under the
        /// same root domain.
        /// </summary>
        public string Domain {  get; set; }

        /// <summary>
        /// Whether the host's certificate lineage goes with the binding. False
        /// leaves it in /etc/letsencrypt so re-adding the host reuses it instead
        /// of issuing a fresh certificate against the weekly duplicate limit.
        /// </summary>
        public bool DeleteCertificate { get; set; }
    }
}
