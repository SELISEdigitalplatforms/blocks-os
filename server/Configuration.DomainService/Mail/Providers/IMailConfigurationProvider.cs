using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;
using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Mail.Providers
{
    /// <summary>The directions a provider can be configured for.</summary>
    [Flags]
    public enum MailDirections
    {
        None = 0,
        Outbound = 1,
        Inbound = 2,
        Both = Outbound | Inbound,
    }

    /// <summary>
    /// How an inbound provider receives mail. Capability metadata only — nothing in this release
    /// reads it, and no push provider is registered. It is declared now so that adding one is a
    /// new definition rather than a new column in every caller.
    /// </summary>
    public enum MailInboundMode
    {
        None = 0,
        Poll = 1,
        Push = 2,
    }

    /// <summary>
    /// Everything that differs between mail providers, behind one contract.
    /// </summary>
    /// <remarks>
    /// The point of the boundary is that adding a provider is a new registered definition plus a
    /// client label entry, and nothing else: the orchestrating service keeps name/id validation,
    /// repository writes, authorization and response envelopes, and has no branch on
    /// <see cref="MailServiceProvider"/>. Existing flat fields stay the persistence contract for
    /// the password providers — a definition maps records into a normalized view, it does not
    /// rewrite them or introduce a polymorphic discriminator.
    /// <para>
    /// Definitions are <b>scoped</b>, because the ones that own a secret depend on the scoped
    /// <c>ISecretService</c>, which reads the request-scoped <c>BlocksContext</c>.
    /// </para>
    /// </remarks>
    public interface IMailConfigurationProvider
    {
        MailServiceProvider Provider { get; }

        MailDirections SupportedDirections { get; }

        MailInboundMode InboundMode { get; }

        /// <summary>
        /// Overwrites the provider-owned non-secret transport and auth values on the request.
        /// </summary>
        /// <remarks>
        /// Runs <b>before</b> validation. A provider with fixed transport settings therefore
        /// ignores whatever the caller submitted for them rather than rejecting it, and the
        /// shared host/port rules then see the normalized values.
        /// </remarks>
        void Normalize(MailConfiguration request);

        /// <summary>
        /// Provider-specific field errors, keyed by field name. Empty means valid.
        /// </summary>
        /// <param name="existing">
        /// The stored record on edit, null on create — what distinguishes "a secret is required"
        /// from "a secret is already on file".
        /// </param>
        /// <param name="existingCredentialStatus">
        /// <see cref="ResolveCredentialStatusAsync"/> for <paramref name="existing"/>, or null when
        /// there is no stored record or it owns no linked secret. A reference whose secret is
        /// archived or missing is not "on file": it cannot be kept, only replaced.
        /// </param>
        IDictionary<string, string> Validate(
            MailConfiguration request,
            MailServerConfiguration? existing,
            string? existingCredentialStatus);

        /// <summary>
        /// Provider-specific field errors for a duplicate request. Empty means valid.
        /// </summary>
        /// <remarks>
        /// Separate from <see cref="Validate"/> because a duplicate submits a different shape —
        /// a source id and, for a provider that owns a secret, a replacement value — rather than
        /// a full configuration.
        /// </remarks>
        IDictionary<string, string> ValidateDuplicate(
            MailServerConfiguration source,
            DuplicateMailConfigurationRequest request);

        /// <summary>
        /// Whether a copy keeps the source's default flag.
        /// </summary>
        /// <remarks>
        /// Declarative rather than a branch in the orchestrator. The password providers answer
        /// true, which is what they do today; a provider whose copy must stand on its own
        /// answers false.
        /// </remarks>
        bool DuplicateInheritsDefault { get; }

        /// <summary>
        /// Creates or rotates whatever credential this provider owns, before the configuration
        /// is written.
        /// </summary>
        /// <param name="existingCredentialStatus">
        /// The status <see cref="Validate"/> was given. When it says the stored reference is
        /// broken, a supplied value creates a new credential instead of rotating the dead one.
        /// </param>
        Task<MailCredentialResult> SaveCredentialAsync(
            MailConfiguration request,
            MailServerConfiguration? existing,
            string? existingCredentialStatus,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Provisions an <b>independent</b> credential for <paramref name="copy"/>, a copy of
        /// <paramref name="source"/> that is not yet written.
        /// </summary>
        /// <param name="copy">
        /// The copy as it will be stored, already carrying its own id and name, so a secret
        /// description names the copy rather than the source.
        /// </param>
        /// <returns>
        /// A result with <see cref="MailCredentialResult.Error"/> set when the source's credential
        /// cannot be carried over; no credential was created and no copy may be written.
        /// </returns>
        Task<MailCredentialResult> DuplicateCredentialAsync(
            MailServerConfiguration source,
            MailServerConfiguration copy,
            DuplicateMailConfigurationRequest request,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// The reference field this provider owns on <paramref name="entity"/>: the one a delete
        /// retires and a failed delete restores. Null when the record links no secret.
        /// </summary>
        string? CredentialReferenceOf(MailServerConfiguration entity);

        /// <summary>
        /// Stores a reference a credential operation returned in the field this provider owns.
        /// </summary>
        /// <remarks>
        /// The orchestrator never assigns a reference field or a plaintext itself, so a provider's
        /// mode decides where the reference lands: <c>AccountPasswordReference</c> for a password
        /// (which also blanks <c>AccountPassword</c>), <c>ClientSecretReference</c> for OAuth.
        /// </remarks>
        void ApplyCredential(MailServerConfiguration entity, string? credentialReference);

        /// <summary>
        /// Retires the owned credential. Called before the configuration is deleted, and as
        /// compensation for a credential this operation created but could not finish using.
        /// </summary>
        /// <returns>
        /// True only when this call retired a credential. A credential that was already archived
        /// or no longer exists is tolerated and reported as false, so a failed delete afterwards
        /// knows it has nothing of its own to restore.
        /// </returns>
        Task<bool> DeleteCredentialAsync(string? credentialReference, CancellationToken cancellationToken = default);

        /// <summary>Undoes <see cref="DeleteCredentialAsync"/> when the delete that followed it failed.</summary>
        Task RestoreCredentialAsync(string? credentialReference, CancellationToken cancellationToken = default);

        /// <summary>
        /// The state of the linked secret <paramref name="entity"/> points at, or null when this
        /// provider owns no linked secret for that record.
        /// </summary>
        /// <remarks>
        /// One metadata read at most, never a value read. Never throws for a secret-store failure:
        /// it answers <c>unavailable</c> instead, so one unreadable secret cannot fail a list.
        /// </remarks>
        Task<string?> ResolveCredentialStatusAsync(MailServerConfiguration entity, CancellationToken cancellationToken = default);

        /// <summary>
        /// Copies this provider's non-secret fields and "configured" flags onto the response.
        /// Never the plaintext and never the reference.
        /// </summary>
        /// <param name="credentialStatus">What <see cref="ResolveCredentialStatusAsync"/> returned for <paramref name="entity"/>.</param>
        void ProjectResponse(MailServerConfiguration entity, MailConfigurationResponse response, string? credentialStatus);
    }

    /// <summary>
    /// The outcome of a credential operation: which reference the configuration should point at,
    /// and whether this operation is the one that created it.
    /// </summary>
    /// <remarks>
    /// <see cref="Created"/> is what makes compensation possible. If the configuration write
    /// fails afterwards, only a credential this operation created may be retired — rolling back
    /// a rotation would need the previous plaintext, which the caller no longer has and this
    /// service never keeps.
    /// </remarks>
    public sealed class MailCredentialResult
    {
        public static readonly MailCredentialResult None = new();

        public string? Reference { get; init; }

        public bool Created { get; init; }

        /// <summary>
        /// A field error that stops the operation before anything is written, keyed by request
        /// field. Null on success.
        /// </summary>
        public KeyValuePair<string, string>? Error { get; init; }

        public static MailCredentialResult Rejected(string field, string message) =>
            new() { Error = new KeyValuePair<string, string>(field, message) };
    }
}
