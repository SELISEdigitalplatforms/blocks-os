namespace Configuration.DomainService.Shared.Secrets
{
    /// <summary>
    /// Finds the configurations in this tenant that point at a given secret.
    /// </summary>
    /// <remarks>
    /// The secret itself records no owner, so the only way to answer "what breaks if I archive
    /// this?" is to search the owners. Covers the two blocks-os configuration types that own a
    /// service secret: CAPTCHA and Office 365 mail. Advisory only — nothing may refuse an archive
    /// or purge because of the answer, or cleaning up a broken configuration would deadlock.
    /// </remarks>
    public interface ISecretDependentLookup
    {
        /// <summary>
        /// The configurations that reference <paramref name="secretId"/>. Empty — never an error —
        /// for an id that is unknown or belongs to another tenant, so existence is not revealed.
        /// </summary>
        Task<SecretDependentsResult> FindAsync(string secretId, CancellationToken cancellationToken = default);
    }

    /// <summary>Response of <c>GET /secrets/dependents</c>.</summary>
    public sealed class SecretDependentsResult
    {
        public string SecretId { get; set; } = string.Empty;

        public IReadOnlyList<SecretDependent> Dependents { get; set; } = [];
    }

    /// <summary>
    /// One configuration that references a secret. Deliberately just enough to name it in a
    /// dialog: no secret value, no mail reference, no other configuration field.
    /// </summary>
    public sealed class SecretDependent
    {
        public const string CaptchaKind = "captcha";
        public const string MailKind = "mail";

        /// <summary><see cref="CaptchaKind"/> or <see cref="MailKind"/>.</summary>
        public string Kind { get; set; } = string.Empty;

        public string Id { get; set; } = string.Empty;

        /// <summary>The CAPTCHA provider, or the mail configuration's name.</summary>
        public string Name { get; set; } = string.Empty;
    }
}
