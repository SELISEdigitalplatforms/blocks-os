namespace Configuration.DomainService.Mail.Mailbox
{
    /// <summary>The stored MIME of one mail, as <c>GetRawMimeAsync</c> reads it.</summary>
    public class MailBoxRawMime
    {
        /// <summary>
        /// Characters in the stored string. Inbound mail is stored with MimeKit's
        /// <c>MimeMessage.ToString()</c>, one Latin-1 char per byte, so this is also its size in bytes.
        /// </summary>
        public long Length { get; set; }

        /// <summary>The stored MIME, or null when it is longer than the read's cap.</summary>
        public string? RawMime { get; set; }
    }
}
