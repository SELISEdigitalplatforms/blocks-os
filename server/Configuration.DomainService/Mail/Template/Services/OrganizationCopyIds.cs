using System.Security.Cryptography;
using System.Text;

namespace Configuration.DomainService.Mail.Template.Services
{
    /// <summary>
    /// The id of the copy a job creates for one organization (SPEC33 C4, #735 Q3): a name-based UUID of the tenant,
    /// organization, Name and Language (SHA-256, laid out as an RFC 9562 version 8 UUID). Two jobs that create the same copy at the same moment both use
    /// this id, so MongoDB's unique <c>_id</c> lets only one of them insert it; no other index is needed.
    /// </summary>
    public static class OrganizationCopyIds
    {
        // Fixed namespace for blocks-os organization template copies. Never change it: existing copy ids depend on it.
        private static readonly Guid Namespace = new("6f1d2c3e-8a4b-4f5d-9e27-5c0b7a913d42");

        public static string For(string tenantId, string organizationId, string name, string language)
        {
            // Each part is length-prefixed, so text moving from one part to the next never gives the same input.
            var key = string.Concat(
                Part(tenantId), Part(organizationId), Part(name), Part(language));

            var namespaceBytes = Namespace.ToByteArray(bigEndian: true);
            var keyBytes = Encoding.UTF8.GetBytes(key);
            var input = new byte[namespaceBytes.Length + keyBytes.Length];
            namespaceBytes.CopyTo(input, 0);
            keyBytes.CopyTo(input, namespaceBytes.Length);

            var bytes = SHA256.HashData(input).AsSpan(0, 16).ToArray();
            bytes[6] = (byte)((bytes[6] & 0x0F) | 0x80); // version 8: custom, here name-based with SHA-256
            bytes[8] = (byte)((bytes[8] & 0x3F) | 0x80); // RFC 9562 variant
            return new Guid(bytes, bigEndian: true).ToString();
        }

        private static string Part(string value) => value.Length.ToString(System.Globalization.CultureInfo.InvariantCulture) + ":" + value;
    }
}
