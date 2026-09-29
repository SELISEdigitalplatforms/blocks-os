namespace Configuration.DomainService.Mail.Mailbox
{
    public class GetMailBoxMailsRequest
    {
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string? Status { get; set; }
        public string? SearchText { get; set; }
        public DateRange? SendDateRange { get; set; }
        public bool? IsInbound { get; set; }

        /// <summary>
        /// Only mail read through, or sent with, this configuration. Absent means every configuration.
        /// </summary>
        public string? MailServerConfigurationId { get; set; }
    }

    public class DateRange
    {
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
    }
}
