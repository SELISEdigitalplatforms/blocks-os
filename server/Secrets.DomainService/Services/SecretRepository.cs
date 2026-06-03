using Blocks.Genesis;
using MongoDB.Driver;
using Pipelines.Sockets.Unofficial.Arenas;
using Secrets.DomainService.Entities;
using StackExchange.Redis;
using System.Collections;


namespace Secrets.DomainService.Services
{
    public class SecretRepository : ISecretRepository
    {
        private readonly IDbContextProvider _dbContextProvider;

        private const string _collectionName = "Secrets";

        public SecretRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task SaveSecretAsync(Secret secret)
        {
            var collection = _dbContextProvider.GetCollection<Secret>(_collectionName);

            var filter = Builders<Secret>.Filter.Eq(s => s.ItemId, secret.ItemId);
            var options = new ReplaceOptions { IsUpsert = true };

            await collection.ReplaceOneAsync(filter, secret, options);
        }

        public async Task<Secret?> GetSecretByIdAsync(string id)
        {
            var collection = _dbContextProvider.GetCollection<Secret>(_collectionName);
            var filter = Builders<Secret>.Filter.Eq(s => s.ItemId, id);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<(List<Secret> secrets, long totalCount)> GetSecretsAsync(string secretKey,int page, int pageSize)
        {
            var collection = _dbContextProvider.GetCollection<Secret>(_collectionName);
            var filter = Builders<Secret>.Filter.Eq(s => s.SecretKey, secretKey);
            var countTask = collection.CountDocumentsAsync(filter);

            var itemsTask = collection.Find(filter)
                .Skip((page) * pageSize)
                .Limit(pageSize)
                .ToListAsync();

            await Task.WhenAll(countTask, itemsTask);
            return (itemsTask.Result, countTask.Result);

        }

        public async Task DeleteSecretAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<Secret>(_collectionName);
            var filter = Builders<Secret>.Filter.Eq(s => s.ItemId, itemId);

            await collection.DeleteOneAsync(filter);
        }
    }
}
