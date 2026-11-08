using Blocks.Genesis;
using DomainService.Shared.Services;
using MongoDB.Driver;
using System.Numerics;
using System.Text;

namespace DomainService.Shared.Utilities;

public class EncodingService : IEncodingService
{
    private readonly IMongoCollection<BlocksGuid> _blocksGuidsCollection;

    private const string Base26Alphabet = "abcdefghijklmnopqrstuvwxyz";

    public EncodingService(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret)
    {
        _blocksGuidsCollection = dbContextProvider
            .GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName)
            .GetCollection<BlocksGuid>("BlocksGuids");
    }

    public async Task<string> EncodeToBase26Async(string input, string tenantGroupId, int length)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(length);

        // Return existing encoding if already stored
        var existingCursor = await _blocksGuidsCollection
            .FindAsync(x => x.OriginalValue == input);
        var existing = await existingCursor.FirstOrDefaultAsync();

        if (existing is not null)
            return Truncate(existing.EncodedValue, length);

        // Generate new encoding
        string encodedValue = long.TryParse(input, out var number)
            ? await EncodeUniqueBase26FromNumber(number, length)
            : Guid.TryParse(input, out var guid)
                ? await EncodeUniqueBase26FromGuid(guid, length)
                : await EncodeUniqueBase26FromGuid(Guid.NewGuid(), length);

        // Store in DB
        await _blocksGuidsCollection.InsertOneAsync(new BlocksGuid
        {
            ItemId = Guid.NewGuid().ToString(),
            OriginalValue = input,
            EncodedValue = encodedValue,
            TenantGroupId = tenantGroupId
        });

        return encodedValue;
    }

    private async Task<string> EncodeUniqueBase26FromNumber(long number, int length)
    {
        var result = Truncate(ConvertToBase26(number), length);
        // Compare exactly the value that will be persisted and used in the URL.
        // Nearby numeric IDs often share a prefix, so incrementing the number
        // would repeat hundreds of queries against the same shortened value.
        return await ExistsInDb(result)
            ? await EncodeUniqueBase26FromGuid(Guid.NewGuid(), length)
            : result;
    }

    private async Task<string> EncodeUniqueBase26FromGuid(Guid guid, int length)
    {
        string result;
        do
        {
            result = Truncate(ConvertToBase26(guid), length);
            guid = Guid.NewGuid();
        }
        while (await ExistsInDb(result));

        return result;
    }

    private static string ConvertToBase26(long number)
    {
        var sb = new StringBuilder();
        var value = BigInteger.Abs(new BigInteger(number));
        if (value.IsZero)
            return "a";

        while (value > 0)
        {
            int remainder = (int)(value % 26);
            value /= 26;
            sb.Insert(0, Base26Alphabet[remainder]);
        }

        return sb.ToString();
    }

    private static string ConvertToBase26(Guid guid)
    {
        var bytes = guid.ToByteArray();
        var unsignedBytes = new byte[bytes.Length + 1];
        Array.Copy(bytes, unsignedBytes, bytes.Length);

        var value = new BigInteger(unsignedBytes);
        if (value == 0)
            return "a";

        var sb = new StringBuilder();
        while (value > 0)
        {
            int remainder = (int)(value % 26);
            value /= 26;
            sb.Insert(0, Base26Alphabet[remainder]);
        }

        return sb.ToString();
    }

    private async Task<bool> ExistsInDb(string encodedValue)
    {
        var cursor = await _blocksGuidsCollection
            .FindAsync(x => x.EncodedValue == encodedValue);
        return await cursor.AnyAsync();
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length > maxLength ? value[..maxLength] : value;
}
