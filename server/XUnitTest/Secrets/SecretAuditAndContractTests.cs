using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Secrets;
using Configuration.DomainService.Captcha.ResponseModel;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Secrets
{
    public class SecretAuditTests : IDisposable
    {
        private const string Plaintext = "correct-horse-battery-staple";

        private readonly SecretTestContext _context = new();

        public SecretAuditTests() => SecretTestContext.SignIn();

        public void Dispose()
        {
            SecretTestContext.SignOut();
            GC.SuppressFinalize(this);
        }

        [Fact]
        public async Task NoAuditRecordEverCarriesThePlaintext()
        {
            _context.GivenSecret();
            _context.ValueStore.Setup(v => v.GetAsync("secret-1", It.IsAny<CancellationToken>())).ReturnsAsync(Plaintext);

            await _context.Service.SetAsync(new SetSecretRequest { Name = "api-key", Value = Plaintext });
            await _context.Service.GetValueAsync("secret-1");
            await _context.Service.RotateAsync("secret-1", new RotateSecretRequest { Value = Plaintext });

            _context.AuditLog.Should().NotBeEmpty();

            // Serialized, because that is the form the record actually persists in — a property
            // check would miss a value smuggled into Reason or SecretName.
            var serialized = JsonSerializer.Serialize(_context.AuditLog);
            serialized.Should().NotContain(Plaintext);
        }

        [Fact]
        public async Task ValueReadsAreAlwaysAudited()
        {
            _context.GivenSecret();

            await _context.Service.GetValueAsync("secret-1");

            _context.AuditFor(SecretAuditActions.GetValue).Should().ContainSingle();
        }

        [Fact]
        public async Task MetadataReadsAreNotAudited()
        {
            // Every list render would otherwise bury the value-access records that matter.
            _context.GivenSecret();

            await _context.Service.GetAsync("secret-1");
            await _context.Service.FindAsync(new SecretFilter());

            _context.AuditLog.Should().BeEmpty();
        }

        [Fact]
        public async Task DenialsAreAudited()
        {
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(access: new SecretAccess { UserIds = { "someone-else" } }, createdBy: "someone-else");

            await Assert.ThrowsAsync<SecretAccessDeniedException>(() => _context.Service.GetValueAsync("secret-1"));

            _context.AuditFor(SecretAuditActions.AccessDenied).Should().ContainSingle()
                    .Which.Outcome.Should().Be(SecretAuditOutcomes.Denied);
        }

        [Fact]
        public async Task AnAuditWriteFailureDoesNotFailTheOperation()
        {
            // If this rethrew, an audit outage would take down every secret operation.
            _context.GivenSecret();
            _context.AuditRepository
                .Setup(r => r.InsertAsync(It.IsAny<SecretAuditLog>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("audit collection unavailable"));

            var value = await _context.Service.GetValueAsync("secret-1");

            value.Should().Be("hunter2");
        }

        [Fact]
        public async Task AnAuditWriteFailureOnADenialDoesNotMaskTheSecurityException()
        {
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(access: new SecretAccess { UserIds = { "someone-else" } }, createdBy: "someone-else");
            _context.AuditRepository
                .Setup(r => r.InsertAsync(It.IsAny<SecretAuditLog>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("audit collection unavailable"));

            var act = () => _context.Service.GetValueAsync("secret-1");

            await act.Should().ThrowAsync<SecretAccessDeniedException>();
        }
    }

    /// <summary>
    /// Structural guarantees. These fail the build if a future edit reintroduces a value or a
    /// vault coordinate into a persisted or returned type.
    /// </summary>
    public class SecretContractTests
    {
        private static readonly string[] ForbiddenMemberNames =
        [
            "Value", "Password", "ConnectionString", "Secret",
            "VaultUri", "KeyVaultSecretName", "KeyVaultVersion",
            "KeyValuePairs", "KeyPairs", "SecretKey"
        ];

        public static TheoryData<Type> PublicSurfaceTypes() =>
        [
            typeof(Secret), typeof(SecretAuditLog), typeof(SecretAccess),
            typeof(SecretResult), typeof(SecretListResult),
            typeof(SecretAuditLogResult), typeof(SecretAuditListResult),
            typeof(CaptchaConfigResult)
        ];

        [Theory]
        [MemberData(nameof(PublicSurfaceTypes))]
        public void NoPersistedOrReturnedTypeExposesAValueOrVaultCoordinate(Type type)
        {
            var offenders = type
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Select(p => p.Name)
                .Where(name => ForbiddenMemberNames.Contains(name, StringComparer.OrdinalIgnoreCase))
                .ToList();

            offenders.Should().BeEmpty(
                "{0} is persisted or returned to callers, so it must never carry a secret value or vault coordinate", type.Name);
        }

        [Fact]
        public void TheSecretEntityDoesNotResurrectTheLegacyShape()
        {
            var names = typeof(Secret)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Select(p => p.Name)
                .ToList();

            names.Should().NotContain("KeyValuePairs");
            names.Should().NotContain("KeyPairs");
            names.Should().NotContain("SecretKey");
        }

        [Fact]
        public void TheSecretEntityShadowsNoBaseEntityProperty()
        {
            // Redeclaring an inherited property gives Mongo two members mapped to one element,
            // and the driver refuses the whole class map rather than just that field — every
            // read and write on the collection then fails with a 500. Tags did exactly this.
            var inherited = typeof(Blocks.Genesis.BaseEntity)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Select(p => p.Name)
                .ToHashSet(StringComparer.Ordinal);

            var shadowed = typeof(Secret)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Select(p => p.Name)
                .Where(inherited.Contains)
                .ToList();

            shadowed.Should().BeEmpty(
                "Secret must not redeclare a BaseEntity property; use the inherited one");
        }

        [Fact]
        public void TheSecretEntityRegistersWithMongo()
        {
            // The failure this guards is at class-map registration, so only a real serialization
            // round trip reaches it — a property-name check alone would miss a future clash
            // introduced some other way.
            var act = () => MongoDB.Bson.BsonExtensionMethods.ToBson(new Secret { ItemId = "s-1", Tags = ["iam"] });

            act.Should().NotThrow();
        }

        [Fact]
        public void TheStoreLivesInItsOwnDatabase()
        {
            // A dedicated database is what keeps this `Secrets` collection clear of the
            // platform's bootstrap configuration documents (SecretKey + KeyPairs), which sit in
            // a `Secrets` collection inside each service's root database.
            SecretCollections.DatabaseName.Should().Be("SecretStore");
            SecretCollections.Secrets.Should().Be("Secrets");
            SecretCollections.AuditLogs.Should().Be("SecretAuditLogs");
        }

        [Fact]
        public void OnlyTheValueStoreInterfaceReturnsPlaintext()
        {
            var valueReturningMethods = typeof(ISecretService)
                .GetMethods()
                .Where(m => m.ReturnType == typeof(Task<string>)
                         || m.ReturnType == typeof(Task<IReadOnlyDictionary<string, string>>))
                .Select(m => m.Name)
                .ToList();

            // SetAsync/SetManyAsync return ids, not values; the rest are the audited read paths.
            valueReturningMethods.Should().BeEquivalentTo(
                ["SetAsync", "SetManyAsync", "GetValueAsync", "GetValuesAsync"]);
        }

        [Fact]
        public void ThereIsNoRevealOrCopyBackDoor()
        {
            // A UI reveal and a UI copy are the same privileged read; separate methods would
            // mean separate audit stories for the same act.
            var names = typeof(ISecretService).GetMethods().Select(m => m.Name).ToList();

            names.Should().NotContain("RevealAsync");
            names.Should().NotContain("CopyAsync");
        }
    }
}
