using Configuration.DomainService.Shared.Enums;

namespace Configuration.DomainService.Mail.Providers
{
    /// <summary>
    /// Resolves the definition that owns a provider/direction pair.
    /// </summary>
    public interface IMailConfigurationProviderRegistry
    {
        /// <summary>
        /// The definition for <paramref name="provider"/> in <paramref name="isInbound"/>, or a
        /// field error naming why there is none.
        /// </summary>
        /// <remarks>
        /// Returns rather than throws so the caller can answer with the mutation envelope every
        /// other validation failure uses, and — crucially — can do so before any secret or
        /// configuration write happens.
        /// </remarks>
        bool TryResolve(
            MailServiceProvider provider,
            bool isInbound,
            out IMailConfigurationProvider definition,
            out KeyValuePair<string, string> error);

        /// <summary>
        /// The definition for a provider regardless of direction.
        /// </summary>
        /// <remarks>
        /// For operations on a record that is already stored — reading, duplicating, deleting.
        /// Those must not be re-judged against the direction rules: a record written before a
        /// provider's directions were narrowed still needs its secret retired when it is deleted,
        /// and refusing to resolve it would strand the secret.
        /// </remarks>
        bool TryGet(MailServiceProvider provider, out IMailConfigurationProvider definition);

        /// <summary>Every registered definition, for capability listings and contract tests.</summary>
        IReadOnlyCollection<IMailConfigurationProvider> Definitions { get; }
    }

    /// <inheritdoc />
    /// <remarks>
    /// Keyed by provider alone. Direction is answered by the definition's
    /// <see cref="IMailConfigurationProvider.SupportedDirections"/> rather than by the key, so
    /// there is one authority for "this provider cannot do inbound" and the unsupported-direction
    /// error has a single source.
    /// </remarks>
    public sealed class MailConfigurationProviderRegistry : IMailConfigurationProviderRegistry
    {
        private readonly IReadOnlyDictionary<MailServiceProvider, IMailConfigurationProvider> _definitions;

        public MailConfigurationProviderRegistry(IEnumerable<IMailConfigurationProvider> definitions)
        {
            ArgumentNullException.ThrowIfNull(definitions);

            _definitions = definitions.ToDictionary(definition => definition.Provider);
        }

        public IReadOnlyCollection<IMailConfigurationProvider> Definitions => _definitions.Values.ToList();

        public bool TryGet(MailServiceProvider provider, out IMailConfigurationProvider definition)
        {
            if (_definitions.TryGetValue(provider, out var resolved))
            {
                definition = resolved;
                return true;
            }

            definition = null!;
            return false;
        }

        public bool TryResolve(
            MailServiceProvider provider,
            bool isInbound,
            out IMailConfigurationProvider definition,
            out KeyValuePair<string, string> error)
        {
            definition = null!;
            error = default;

            // Enum.IsDefined first: an undefined numeric value deserializes onto the enum
            // unchallenged, so without this a request carrying provider 7 would simply miss the
            // dictionary and be reported as an unregistered provider rather than a bad value.
            if (!Enum.IsDefined(provider) || !_definitions.TryGetValue(provider, out var resolved))
            {
                error = new KeyValuePair<string, string>("Provider", "Unsupported mail service provider.");
                return false;
            }

            var requested = isInbound ? MailDirections.Inbound : MailDirections.Outbound;

            if (!resolved.SupportedDirections.HasFlag(requested))
            {
                error = new KeyValuePair<string, string>("IsInbound", DescribeUnsupportedDirection(provider, isInbound));
                return false;
            }

            definition = resolved;
            return true;
        }

        /// <summary>
        /// The label here is the server-side copy of the provider's display name. It exists
        /// because the message is part of the API contract and reaches a user unchanged; the
        /// client keeps its own map for presentation.
        /// </summary>
        private static string DescribeUnsupportedDirection(MailServiceProvider provider, bool isInbound)
        {
            var label = provider switch
            {
                MailServiceProvider.Office365Smtp => "SMTP Office 365",
                MailServiceProvider.AmazonSes => "Amazon SES",
                MailServiceProvider.Zoho => "Zoho",
                _ => provider.ToString()
            };

            var direction = isInbound ? "outbound" : "inbound";

            return $"{label} supports {direction} configurations only.";
        }
    }
}
