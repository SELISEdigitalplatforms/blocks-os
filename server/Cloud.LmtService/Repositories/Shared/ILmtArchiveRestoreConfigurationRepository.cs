using Cloud.LmtService.Models.Shared;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Repositories.Shared
{
    public interface ILmtArchiveRestoreConfigurationRepository
    {
        Task<LmtArchiveRestoreConfigurations> GetLmtArchiveRestoreConfigurationsAsync(CancellationToken ct = default);
    }
}
