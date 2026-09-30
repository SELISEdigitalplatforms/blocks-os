using Blocks.Genesis;
using DomainService.Billing.Entities;
using DomainService.Dtos;
using DomainService.Projects;
using DomainService.Shared;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

public interface IInvoiceMailer
{
    /// <summary>Emails an invoice to the project's owner.</summary>
    Task SendAsync(Invoice invoice, CancellationToken cancellationToken = default);
}

/// <summary>
/// Sends an invoice through the platform's mail queue.
/// </summary>
/// <remarks>
/// The same path project invitations already take: a <c>SendMail</c> onto the mail queue, rendered
/// and delivered by the service that owns templates. blocks-os composes the data and knows nothing
/// about how a mail is built or sent.
/// <para>
/// A mail that cannot be queued never fails the charge behind it. The money has moved and the
/// invoice is written; an email is the least important part of that and the worst possible reason
/// to fail a renewal.
/// </para>
/// </remarks>
public sealed class InvoiceMailer : IInvoiceMailer
{
    private readonly IMessageClient _messageClient;
    private readonly IProjectRepository _projects;
    private readonly ILogger<InvoiceMailer> _logger;

    public InvoiceMailer(
        IMessageClient messageClient,
        IProjectRepository projects,
        ILogger<InvoiceMailer> logger)
    {
        _messageClient = messageClient;
        _projects = projects;
        _logger = logger;
    }

    public async Task SendAsync(Invoice invoice, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(invoice);

        try
        {
            var owner = await _projects.GetGroupOwnerAsync(invoice.TenantGroupId).ConfigureAwait(false);
            var email = owner?.Email;

            if (string.IsNullOrWhiteSpace(email))
            {
                _logger.LogWarning(
                    "Invoice {Number} has no owner to send to for {TenantGroupId}.",
                    invoice.Number,
                    invoice.TenantGroupId);
                return;
            }

            await _messageClient
                .SendToConsumerAsync(new ConsumerMessage<SendMail>
                {
                    ConsumerName = IdentifierConstants.MailQueue,
                    Payload = new SendMail
                    {
                        To = [email.ToLowerInvariant()],
                        Language = "en-US",
                        Purpose = invoice.State == InvoiceStates.Paid
                            ? IdentifierConstants.InvoicePaidMailPurpose
                            : IdentifierConstants.InvoiceUnpaidMailPurpose,
                        BodyDataContext = new Dictionary<string, string>
                        {
                            { "InvoiceNumber", invoice.Number },
                            { "Amount", $"{invoice.Market} {invoice.Total:N2}" },
                            { "IssuedOn", invoice.IssuedAtUtc.ToString("d MMMM yyyy") },
                            { "LineCount", invoice.Lines.Count.ToString() },
                            // The unpaid template says this carries rather than that anything is
                            // suspended, because nothing is.
                            { "CarriedIn", $"{invoice.Market} {invoice.CarriedIn:N2}" },
                        },
                    },
                })
                .ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogError(exception, "Invoice {Number} could not be emailed.", invoice.Number);
        }
    }
}
