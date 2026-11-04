using Blocks.Genesis;
using DomainService.Entities;
using DomainService.Shared.Dtos;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Text;
using Blocks.Genesis.Entities.Os;
using Os.DataAccess;

namespace Worker.Consumers.Identifier
{
    public class UpdateResourceUsageConsumer : IConsumer<UpdateResourceUsageCommand_Identifier>
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IOsDataAccess _dataAccess;
        public UpdateResourceUsageConsumer(IDbContextProvider dbContextProvider, IOsDataAccess dataAccess)
        {
            _dbContextProvider = dbContextProvider;
            _dataAccess = dataAccess;
        }

        public async Task Consume(UpdateResourceUsageCommand_Identifier context)
        {
            var collection = _dbContextProvider.GetDatabase(context.TenantId).GetCollection<ResourceLimit>("ResourceLimits");
            var filter = Builders<ResourceLimit>.Filter.Eq(r => r.Resource, context.Resource);
            var update = Builders<ResourceLimit>.Update.Inc(r => r.Usage, context.Amount);

            // Queue consumer writing the message's tenant DB: the data access helper takes its named skip
            // path (no-user-context / other-tenant-db) unless an authenticated same-tenant context exists.
            var editFilter = await _dataAccess.EditFilterAsync(OsSchemas.ResourceLimit, filter, "UpdateResourceUsageConsumer.Consume", context.TenantId);
            if (editFilter is null)
            {
                return;
            }

            await _dataAccess.CheckUpdateAsync(OsSchemas.ResourceLimit, update, "UpdateResourceUsageConsumer.Consume", context.TenantId);
            await collection.UpdateOneAsync(editFilter, update);
        }
    }
}
