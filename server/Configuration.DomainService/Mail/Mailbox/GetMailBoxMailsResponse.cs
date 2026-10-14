using System.Text.Json.Serialization;
using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Blocks.Genesis.Entities.Logic;

namespace Configuration.DomainService.Mail.Mailbox
{
    public class GetMailBoxMailsResponse : BaseResponse
    {
        public long TotalCount { get; set; }
        public List<MailBoxEntityResponse> Mails { get; set; }
    }

    public class MailBoxEntityResponse : MailBoxEntity
    {
        public List<MailBoxEntityTimeline> Timeline { get; set; }
    }

    public class MailBoxEntityTimeline
    {
        [BsonRepresentation(BsonType.String)]
        [JsonConverter(typeof(JsonStringEnumConverter))]
        public MailStatus Status { get; set; }
        public DateTime Date { get; set; }
    }
}
