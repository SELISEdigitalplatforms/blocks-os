namespace Configuration.DomainService.Mail.Mailbox
{
    public class GetMailBoxMailRequest
    {
        public string? MessageId { get; set; }

        // Id of any stored status row of the mail. Links use it because Message-IDs end in a
        // domain ("...@mail.gmail.com"), and the SPA fallback treats a dotted last segment as a file.
        public string? ItemId { get; set; }
    }
}
