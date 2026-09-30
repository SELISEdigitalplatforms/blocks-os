using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// Cards are scoped to a project group, and the two halves of a card live apart: what may be
/// shown sits in the root database, what could raise a charge sits in the vault.
/// </summary>
public class PaymentMethodServiceTests
{
    private const string Group = "grp_01JB9K5S8TN2C7";
    private const string User = "usr_01JB9K2D7XF4Q1";

    private readonly Mock<ITenantPaymentMethodRepository> _repository = new();
    private readonly Mock<IBillingSecretStore> _secrets = new();

    private PaymentMethodService Service() =>
        new(_repository.Object, _secrets.Object, NullLogger<PaymentMethodService>.Instance);

    private static AttachPaymentMethodRequest Card() => new()
    {
        ProviderName = "adyen",
        ProviderToken = "tok_live_abc",
        ProviderCustomerId = "cust_42",
        Brand = "VISA",
        LastFour = "4242",
        ExpiryMonth = 4,
        ExpiryYear = 2029,
    };

    [Fact]
    public async Task Attach_writes_the_secret_before_the_row()
    {
        var order = new List<string>();

        _secrets
            .Setup(s => s.SaveAsync(Group, It.IsAny<string>(), It.IsAny<CardSecret>(), It.IsAny<CancellationToken>()))
            .Callback(() => order.Add("secret"))
            .Returns(Task.CompletedTask);

        _repository
            .Setup(r => r.ListAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        _repository
            .Setup(r => r.InsertAsync(It.IsAny<TenantPaymentMethod>(), It.IsAny<CancellationToken>()))
            .Callback(() => order.Add("row"))
            .Returns(Task.CompletedTask);

        var result = await Service().AttachAsync(Group, User, Card());

        Assert.True(result.IsSuccess);
        // A row written first, with the secret then failing, would show a card that can never be
        // charged. The reverse leaves an orphaned vault value, which is invisible and harmless.
        Assert.Equal(["secret", "row"], order);
    }

    [Fact]
    public async Task Attach_stores_no_secret_on_the_row()
    {
        TenantPaymentMethod? written = null;

        _repository.Setup(r => r.ListAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _repository
            .Setup(r => r.InsertAsync(It.IsAny<TenantPaymentMethod>(), It.IsAny<CancellationToken>()))
            .Callback<TenantPaymentMethod, CancellationToken>((m, _) => written = m)
            .Returns(Task.CompletedTask);

        await Service().AttachAsync(Group, User, Card());

        Assert.NotNull(written);
        Assert.Equal(Group, written!.TenantGroupId);
        Assert.Equal(User, written.AddedByUserId);
        Assert.Equal("4242", written.LastFour);

        // The whole point: the row names the secret, it does not hold it.
        var serialised = System.Text.Json.JsonSerializer.Serialize(written);
        Assert.DoesNotContain("tok_live_abc", serialised, StringComparison.Ordinal);
        Assert.DoesNotContain("cust_42", serialised, StringComparison.Ordinal);
        Assert.Contains(written.SecretId, BillingSecretStore.SecretIdFor(Group, written.ItemId));
    }

    [Fact]
    public async Task First_card_becomes_the_default_and_later_ones_do_not()
    {
        var written = new List<TenantPaymentMethod>();

        _repository
            .Setup(r => r.InsertAsync(It.IsAny<TenantPaymentMethod>(), It.IsAny<CancellationToken>()))
            .Callback<TenantPaymentMethod, CancellationToken>((m, _) => written.Add(m))
            .Returns(Task.CompletedTask);

        _repository.Setup(r => r.ListAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        await Service().AttachAsync(Group, User, Card());

        _repository
            .Setup(r => r.ListAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync([written[0]]);
        await Service().AttachAsync(Group, User, Card());

        Assert.True(written[0].IsDefault);
        Assert.False(written[1].IsDefault);
    }

    [Fact]
    public async Task A_vault_failure_refuses_the_card_rather_than_filing_an_uncharge_able_one()
    {
        _secrets
            .Setup(s => s.SaveAsync(Group, It.IsAny<string>(), It.IsAny<CardSecret>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("vault down"));

        var result = await Service().AttachAsync(Group, User, Card());

        Assert.False(result.IsSuccess);
        Assert.Equal(PaymentMethodFailures.SecretUnavailable, result.Reason);
        _repository.Verify(r => r.InsertAsync(It.IsAny<TenantPaymentMethod>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(0, 2029)]
    [InlineData(13, 2029)]
    [InlineData(4, 1999)]
    public async Task A_malformed_expiry_is_refused(int month, int year)
    {
        var card = Card();
        card.ExpiryMonth = month;
        card.ExpiryYear = year;

        var result = await Service().AttachAsync(Group, User, card);

        Assert.False(result.IsSuccess);
        Assert.Equal(PaymentMethodFailures.InvalidCard, result.Reason);
    }

    [Fact]
    public async Task Removing_the_default_promotes_another_because_a_renewal_needs_one()
    {
        var gone = new TenantPaymentMethod { ItemId = "pm_1", TenantGroupId = Group, IsDefault = true };
        var kept = new TenantPaymentMethod { ItemId = "pm_2", TenantGroupId = Group };

        _repository.Setup(r => r.GetAsync(Group, "pm_1", It.IsAny<CancellationToken>())).ReturnsAsync(gone);
        _repository.Setup(r => r.MarkRemovedAsync(Group, "pm_1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repository.Setup(r => r.ListAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync([kept]);

        var result = await Service().RemoveAsync(Group, "pm_1");

        Assert.True(result.IsSuccess);
        _repository.Verify(r => r.SetDefaultAsync(Group, "pm_2", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Removing_a_card_deletes_its_vault_secret()
    {
        _repository.Setup(r => r.GetAsync(Group, "pm_9", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TenantPaymentMethod { ItemId = "pm_9", TenantGroupId = Group });
        _repository.Setup(r => r.MarkRemovedAsync(Group, "pm_9", It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repository.Setup(r => r.ListAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync([]);

        await Service().RemoveAsync(Group, "pm_9");

        _secrets.Verify(s => s.DeleteAsync(Group, "pm_9", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_vault_failure_on_delete_does_not_fail_the_removal()
    {
        _repository.Setup(r => r.GetAsync(Group, "pm_9", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TenantPaymentMethod { ItemId = "pm_9", TenantGroupId = Group });
        _repository.Setup(r => r.MarkRemovedAsync(Group, "pm_9", It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repository.Setup(r => r.ListAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _secrets.Setup(s => s.DeleteAsync(Group, "pm_9", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("vault down"));

        // The row is already gone from the project's view; an orphaned secret is not worth
        // telling the caller their removal failed.
        var result = await Service().RemoveAsync(Group, "pm_9");

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task An_unknown_card_is_not_found_rather_than_silently_fine()
    {
        _repository.Setup(r => r.MarkRemovedAsync(Group, "nope", It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await Service().RemoveAsync(Group, "nope");

        Assert.False(result.IsSuccess);
        Assert.Equal(PaymentMethodFailures.NotFound, result.Reason);
    }

    [Fact]
    public async Task A_blank_group_reads_nothing()
    {
        Assert.Empty(await Service().ListAsync(string.Empty));
        _repository.Verify(r => r.ListAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task The_charge_secret_comes_from_the_vault_via_the_default_card()
    {
        _repository.Setup(r => r.GetDefaultAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TenantPaymentMethod { ItemId = "pm_1", TenantGroupId = Group, IsDefault = true });
        _secrets.Setup(s => s.ReadAsync(Group, "pm_1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CardSecret { ProviderToken = "tok", ProviderCustomerId = "cust" });

        var secret = await Service().GetDefaultChargeSecretAsync(Group);

        Assert.Equal("tok", secret!.ProviderToken);
    }

    [Fact]
    public async Task No_default_card_means_no_charge_secret()
    {
        _repository.Setup(r => r.GetDefaultAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync((TenantPaymentMethod?)null);

        Assert.Null(await Service().GetDefaultChargeSecretAsync(Group));
    }
}
