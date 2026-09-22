using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Shared.Enums;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace XUnitTest.Services
{
    /// <summary>
    /// Backward compatibility of the persisted document, asserted against real BSON rather than
    /// against a constructed object.
    /// </summary>
    /// <remarks>
    /// This is the claim that says no migration is needed, so it is worth testing at the
    /// serializer rather than trusting that a C# default and a missing BSON element agree. The
    /// document below is the pre-change shape: the additive fields are absent, not null.
    /// <para>
    /// It matters twice over, because new projects have their default mail configuration copied
    /// out of <c>BlocksConfiguration</c> as a raw <c>BsonDocument</c>. Every freshly provisioned
    /// tenant therefore starts with a document in exactly this shape.
    /// </para>
    /// </remarks>
    public class MailServerConfigurationBsonTests
    {
        private const string PreChangeDocument = """
            {
              "_id": "legacy-zoho-1",
              "Name": "Zoho Primary",
              "Host": "smtp.zoho.com",
              "Port": 465,
              "EnableSSL": true,
              "SenderName": "Contoso",
              "SenderAddress": "noreply@contoso.com",
              "SenderUserName": "zohouser",
              "AccountPassword": "password1",
              "UseDefaultCredentials": false,
              "SmtpClient": 0,
              "IsDefault": true,
              "IsInbound": false,
              "Provider": 1,
              "IsEnableSnsConfiguration": false
            }
            """;

        [Fact]
        public void PreChangeDocument_DeserializesOntoTheLegacyPath()
        {
            var entity = BsonSerializer.Deserialize<MailServerConfiguration>(BsonDocument.Parse(PreChangeDocument));

            // The zero values are what make the additive fields safe: an absent element and the
            // pre-change behaviour have to mean the same thing.
            entity.AuthenticationType.Should().Be(MailAuthenticationType.Password);
            entity.SecurityMode.Should().Be(MailSecurityMode.Legacy);

            entity.TenantId.Should().BeNull();
            entity.ClientId.Should().BeNull();
            entity.ClientSecretReference.Should().BeNull();
            entity.MailboxAddress.Should().BeNull();

            // And nothing the record already had has moved or changed meaning.
            entity.Provider.Should().Be(MailServiceProvider.Zoho);
            entity.EnableSSL.Should().BeTrue();
            entity.Host.Should().Be("smtp.zoho.com");
            entity.Port.Should().Be(465);
            entity.SenderUserName.Should().Be("zohouser");
            entity.AccountPassword.Should().Be("password1");
            entity.IsDefault.Should().BeTrue();
        }

        [Fact]
        public void PreChangeDocument_RoundTripsWithoutLosingItsLegacyFields()
        {
            var entity = BsonSerializer.Deserialize<MailServerConfiguration>(BsonDocument.Parse(PreChangeDocument));

            var rewritten = entity.ToBsonDocument();

            rewritten["Provider"].AsInt32.Should().Be((int)MailServiceProvider.Zoho);
            rewritten["EnableSSL"].AsBoolean.Should().BeTrue();
            rewritten["AccountPassword"].AsString.Should().Be("password1");

            // A save adds the new fields at their defaults rather than rewriting anything, which
            // is additive: the document gains elements and loses none.
            rewritten["AuthenticationType"].AsInt32.Should().Be((int)MailAuthenticationType.Password);
            rewritten["SecurityMode"].AsInt32.Should().Be((int)MailSecurityMode.Legacy);
            rewritten["ClientSecretReference"].IsBsonNull.Should().BeTrue();
        }

        [Fact]
        public void UnknownElements_AreStillIgnored()
        {
            // [BsonIgnoreExtraElements] is what lets blocks-logic and blocks-cli write fields this
            // service has not heard of. Losing it would turn a forward-compatible document into a
            // deserialization failure.
            var withExtras = BsonDocument.Parse(PreChangeDocument);
            withExtras["SomeFieldFromAnotherService"] = "value";

            var entity = BsonSerializer.Deserialize<MailServerConfiguration>(withExtras);

            entity.Name.Should().Be("Zoho Primary");
        }

        [Fact]
        public void AnOffice365Document_CarriesAReferenceAndNoPlaintext()
        {
            var document = BsonDocument.Parse("""
                {
                  "_id": "o365-1",
                  "Name": "Microsoft 365 Primary",
                  "Host": "smtp.office365.com",
                  "Port": 587,
                  "EnableSSL": false,
                  "Provider": 2,
                  "IsInbound": false,
                  "AuthenticationType": 1,
                  "SecurityMode": 2,
                  "TenantId": "contoso-tenant",
                  "ClientId": "mailer-app",
                  "ClientSecretReference": "secret-1",
                  "MailboxAddress": "mailer@contoso.com",
                  "AccountPassword": ""
                }
                """);

            var entity = BsonSerializer.Deserialize<MailServerConfiguration>(document);

            entity.Provider.Should().Be(MailServiceProvider.Office365Smtp);
            entity.AuthenticationType.Should().Be(MailAuthenticationType.OAuthClientCredentials);
            entity.SecurityMode.Should().Be(MailSecurityMode.StartTls);
            entity.ClientSecretReference.Should().Be("secret-1");
            entity.AccountPassword.Should().BeEmpty();
        }
    }
}
