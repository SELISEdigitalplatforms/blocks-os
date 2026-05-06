using Blocks.Genesis;
using MongoDB.Driver;
using Secrets.DomainService.Entities;
using StackExchange.Redis;


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

        public async Task<List<Secret>> GetSecretsAsync(string secretKey)
        {
            var collection = _dbContextProvider.GetCollection<Secret>(_collectionName);
            var filter = Builders<Secret>.Filter.Eq(s => s.SecretKey, secretKey);

            return await (await collection.FindAsync(filter)).ToListAsync();
        }
    }
}
