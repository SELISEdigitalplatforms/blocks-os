using Blocks.Genesis;
using Configuration.DomainService.Integration.Services;
using FluentAssertions;
using Moq;
using StackExchange.Redis;
using XUnitTest.TestSupport;

namespace XUnitTest.Services;

public class IntegrationRateLimiterTests : IDisposable
{
    private readonly Mock<ICacheClient> _cache = new();
    private readonly Mock<IDatabase> _cacheDb = new();

    public IntegrationRateLimiterTests()
    {
        _cache.Setup(c => c.CacheDatabase()).Returns(_cacheDb.Object);
    }

    public void Dispose()
    {
        BlocksContext.SetContext(null);
    }

    private IntegrationRateLimiter Limiter() => new(_cache.Object);

    private void CounterReturns(long count) =>
        _cacheDb.Setup(db => db.StringIncrementAsync(It.IsAny<RedisKey>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(count);

    [Fact]
    public async Task Enforce_WithinTheLimit_DoesNotThrow()
    {
        CounterReturns(20);

        var act = () => Limiter().EnforceAsync("CreateRequest", "10.0.0.1");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Enforce_OverTheLimit_ThrowsBlocksRateLimitException()
    {
        CounterReturns(21);

        var act = () => Limiter().EnforceAsync("CreateRequest", "10.0.0.1");

        (await act.Should().ThrowAsync<BlocksRateLimitException>()).WithMessage("Too many requests. Try again later.");
    }

    [Fact]
    public async Task Enforce_FirstHitSetsTheWindowExpiry()
    {
        CounterReturns(1);
        var capturedKeys = new List<RedisKey>();
        var capturedExpiries = new List<TimeSpan?>();
        _cacheDb.Setup(db => db.KeyExpireAsync(It.IsAny<RedisKey>(), It.IsAny<TimeSpan?>(), It.IsAny<ExpireWhen>(), It.IsAny<CommandFlags>()))
            .Callback(new Action<RedisKey, TimeSpan?, ExpireWhen, CommandFlags>((k, t, _, _) => { capturedKeys.Add(k); capturedExpiries.Add(t); }))
            .ReturnsAsync(true);

        await Limiter().EnforceAsync("Exchange", "10.0.0.2");

        capturedKeys.Should().ContainSingle().Which.ToString().Should().Contain("blocks-os:integration:rate:Exchange:10.0.0.2");
        capturedExpiries.Should().ContainSingle().Which.Should().Be(TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task Enforce_LaterHitsDoNotExtendTheWindow()
    {
        CounterReturns(5);

        await Limiter().EnforceAsync("Exchange", "10.0.0.2");

        // Every hit asks Redis to set the expiry, but ExpireWhen.HasNoExpiry makes Redis apply it
        // only when the key doesn't already have one, so a later hit cannot push the window out.
        _cacheDb.Verify(db => db.KeyExpireAsync(It.IsAny<RedisKey>(), It.IsAny<TimeSpan?>(), ExpireWhen.HasNoExpiry, It.IsAny<CommandFlags>()), Times.Once);
        _cacheDb.Verify(db => db.KeyExpireAsync(It.IsAny<RedisKey>(), It.IsAny<TimeSpan?>(), ExpireWhen.Always, It.IsAny<CommandFlags>()), Times.Never);
    }

    [Fact]
    public async Task Enforce_CacheFailure_IsSwallowed()
    {
        _cacheDb.Setup(db => db.StringIncrementAsync(It.IsAny<RedisKey>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisException("connection lost"));

        var act = () => Limiter().EnforceAsync("CreateRequest", "10.0.0.1");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Enforce_UnknownEndpoint_IsIgnored()
    {
        var act = () => Limiter().EnforceAsync("NotAnEndpoint", "10.0.0.1");

        await act.Should().NotThrowAsync();
        _cache.Verify(c => c.CacheDatabase(), Times.Never);
    }
}
