using System.Collections.Generic;
using Blocks.Genesis;
using Configuration.DomainService.DataGateway;
using Microsoft.Extensions.Configuration;
using Moq;

namespace XUnitTest.TestHelpers
{
    /// <summary>os SPEC2 test helpers: the root-DB handle and the DataGateway:RootConfigEnabled switch.</summary>
    internal static class DataGatewayTestSupport
    {
        public const string RootDatabaseName = "BlocksRootDb";

        public static IBlocksSecret RootSecret()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.RootDatabaseName).Returns(RootDatabaseName);
            return secret.Object;
        }

        public static IConfiguration Config(bool on) => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { { DataGatewayRootMode.ConfigKey, on ? "true" : "false" } })
            .Build();

        public static DataGatewayRootMode Mode(bool on) => new(Config(on));
    }
}
