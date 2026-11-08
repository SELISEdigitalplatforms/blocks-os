namespace Configuration.DomainService.Organizations
{
    /// <summary>
    /// A caller confined to one organization asked for another organization's records (see <see cref="CallerOrganization"/>).
    /// The API answers it with 403 and the usual <c>{ isSuccess:false, errors }</c> envelope.
    /// </summary>
    public sealed class OrganizationAccessDeniedException : Exception
    {
        public const string DefaultMessage = "Your organization can only access its own records.";

        public OrganizationAccessDeniedException()
            : base(DefaultMessage)
        {
        }

        public OrganizationAccessDeniedException(string message)
            : base(message)
        {
        }

        public OrganizationAccessDeniedException(string message, Exception innerException)
            : base(message, innerException)
        {
        }
    }
}
