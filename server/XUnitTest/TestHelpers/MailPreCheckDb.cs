using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.TestHelpers
{
    /// <summary>
    /// A mock <see cref="IDbContextProvider"/> that answers the three collections MailPreCheck reads
    /// (EmailTemplates, MailServerConfigurations, Users). Each collection returns one document or none;
    /// the flags can be flipped per test. No database is involved.
    /// </summary>
    public sealed class MailPreCheckDb
    {
        public bool TemplateExists { get; set; } = true;
        public bool ConfigExists { get; set; } = true;
        public bool UserExists { get; set; } = true;
        public string? MailConfigurationId { get; set; } = "cfg-1";
        public string TemplateBody { get; set; } = "";

        public Mock<IDbContextProvider> Provider { get; } = new();

        public MailPreCheckDb()
        {
            Provider.Setup(p => p.GetCollection<BsonDocument>("EmailTemplates"))
                .Returns(() => Collection(() => TemplateExists
                    ? new BsonDocument { { "_id", "t-1" }, { "Name", "x" }, { "MailConfigurationId", MailConfigurationId is null ? BsonNull.Value : MailConfigurationId }, { "TemplateBody", TemplateBody } }
                    : null));
            Provider.Setup(p => p.GetCollection<BsonDocument>("MailServerConfigurations"))
                .Returns(() => Collection(() => ConfigExists ? new BsonDocument { { "_id", "cfg-1" } } : null));
            Provider.Setup(p => p.GetCollection<BsonDocument>("Users"))
                .Returns(() => Collection(() => UserExists ? new BsonDocument { { "_id", "u-1" } } : null));
        }

        public IDbContextProvider Object => Provider.Object;

        private static IMongoCollection<BsonDocument> Collection(Func<BsonDocument?> doc)
        {
            var collection = new Mock<IMongoCollection<BsonDocument>>();
            collection
                .Setup(c => c.FindAsync(
                    It.IsAny<FilterDefinition<BsonDocument>>(),
                    It.IsAny<FindOptions<BsonDocument, BsonDocument>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(() =>
                {
                    var found = doc();
                    var cursor = new Mock<IAsyncCursor<BsonDocument>>();
                    var served = false;
                    cursor.Setup(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
                        .ReturnsAsync(() => { var more = !served && found != null; served = true; return more; });
                    cursor.SetupGet(x => x.Current).Returns(() => found != null ? new[] { found } : Array.Empty<BsonDocument>());
                    return cursor.Object;
                });
            return collection.Object;
        }
    }
}
