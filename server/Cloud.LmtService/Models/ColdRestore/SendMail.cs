namespace Cloud.LmtService.Models.ColdRestore
{
    // Message for the blocks-logic mail listener. Genesis routes by payload type name, so the class
    // must be named SendMail. Same fields as logic's BaseMailRequest.
    public class SendMail
    {
        public Dictionary<string, string> SubjectDataContext { get; set; } = new Dictionary<string, string>();
        public IEnumerable<string> To { get; set; } = Enumerable.Empty<string>();
        public IEnumerable<string> Bcc { get; set; } = Enumerable.Empty<string>();
        public IEnumerable<string> Cc { get; set; } = Enumerable.Empty<string>();
        public string Purpose { get; set; } = string.Empty;
        public string Language { get; set; } = string.Empty;
        public IEnumerable<string> ReplyTo { get; set; } = Enumerable.Empty<string>();
        public IEnumerable<string> Attachments { get; set; } = Enumerable.Empty<string>();
        public Dictionary<string, string> BodyDataContext { get; set; } = new Dictionary<string, string>();
        public bool SendPhoneNumberAsEmail { get; set; } = false;
    }
}
