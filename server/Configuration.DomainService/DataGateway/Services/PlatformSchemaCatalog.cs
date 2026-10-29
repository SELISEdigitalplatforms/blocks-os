using Blocks.Genesis.Entities.Data;

namespace Configuration.DomainService.DataGateway.Services
{
    /// <summary>
    /// Which system schemas the Data Access page offers, which service owns each, and which of their properties stay
    /// hidden. Hiding is a page and API filter only: the stored schema docs keep every property, because the services
    /// read exactly the listed fields (removing one would load it as empty).
    /// </summary>
    public static class PlatformSchemaCatalog
    {
        private const string Iam = "IAM";
        private const string Os = "OS";
        private const string Logic = "Logic";
        private const string Release = "Release";
        private const string Monitor = "Monitor";

        /// <summary>Schemas the page offers, by owning service. A system schema not listed here is hidden.</summary>
        public static readonly IReadOnlyDictionary<string, string> Owners = new Dictionary<string, string>
        {
            ["User"] = Iam, ["Role"] = Iam, ["Permission"] = Iam, ["Organization"] = Iam,
            ["IdentityProvider"] = Iam, ["ClientCredential"] = Iam, ["OidcClientRegistration"] = Iam,
            ["SignupLink"] = Iam, ["SignupLinkConfiguration"] = Iam, ["UserActivity"] = Iam, ["BlocksClientConfig"] = Iam,
            ["EmailTemplate"] = Os, ["IntegrationSetup"] = Os, ["ThirdPartyJWTClaims"] = Os,
            ["MailServerConfiguration"] = Os, ["ResourceLimit"] = Os,
            ["WorkflowEntity"] = Logic, ["WorkflowVersionEntity"] = Logic, ["WorkflowExecutionEntity"] = Logic,
            ["WorkflowItemExecutionEntity"] = Logic, ["FunctionEntity"] = Logic, ["FunctionVersionEntity"] = Logic,
            ["FunctionRunEntity"] = Logic, ["FunctionRunLogEntity"] = Logic, ["FunctionBuildEntity"] = Logic,
            ["FunctionAuditEventEntity"] = Logic, ["ProxyDetailEntity"] = Logic, ["ProxyVersionEntity"] = Logic,
            ["ProxyExecutionEntity"] = Logic, ["Schedule"] = Logic, ["OfflineNotification"] = Logic,
            ["FirebaseConfiguration"] = Logic,
            ["Repo"] = Release,
            ["MonitorConfiguration"] = Monitor, ["MonitorIncident"] = Monitor, ["MonitorPingLog"] = Monitor
        };

        /// <summary>
        /// Properties only the backend uses, per schema. A name hides the property and everything under it
        /// (<c>DeploySettings</c> hides <c>DeploySettings.Region</c>). New backend-only property? Add it here.
        /// </summary>
        public static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> HiddenFields = new Dictionary<string, IReadOnlySet<string>>
        {
            ["User"] = Set("VerifiedType", "PasswordSetTime", "PasswordChangedAtUtc", "LastCredentialRotationAtUtc",
                "FailedLoginCount", "LastFailedLoginUtc", "FailedMfaCount", "LastFailedMfaUtc", "LockoutCount", "LastLockoutUtc",
                "SecurityStamp", "TokenVersion", "MfaMethods", "AllowedLogInType", "TermsAcceptedAtUtc", "PrivacyAcceptedAtUtc",
                "DeactivatedBy", "ActivatedAtUtc", "ActivatedBy", "ExternalUserId"),
            ["IdentityProvider"] = Set("JwksUri", "ClientSecretReference", "PrivateKeyReference"),
            ["ClientCredential"] = Set("ClientSecretReference"),
            ["OidcClientRegistration"] = Set("ClientSecretReference"),
            ["SignupLink"] = Set("CodeHash", "MaxRedemptions", "RedemptionCount", "CreatedUserId", "CreatedByClientId",
                "CreatedByOrganizationId", "RevokedAtUtc", "RevokedBy"),
            ["IntegrationSetup"] = Set("RevokedBy", "RevokedDate"),
            ["MailServerConfiguration"] = Set("UseDefaultCredentials", "SmtpClient", "IsEnableSnsConfiguration", "ClientSecretReference",
                "AccountPasswordReference"),
            ["WorkflowEntity"] = Set("LastPublishedVersionId", "PublishedMeta", "TestMeta", "PublishedVersionId"),
            ["WorkflowVersionEntity"] = Set("Snapshot.PublishedVersionId", "Snapshot.LastPublishedVersionId",
                "Snapshot.PublishedMeta", "Snapshot.TestMeta"),
            ["WorkflowExecutionEntity"] = Set("OriginalExecutionId", "WorkflowSnapshot.PublishedVersionId",
                "WorkflowSnapshot.LastPublishedVersionId", "WorkflowSnapshot.PublishedMeta", "WorkflowSnapshot.TestMeta"),
            ["WorkflowItemExecutionEntity"] = Set("WorkflowExecutionId", "AncestorMap"),
            ["FunctionEntity"] = Set("SourceHash", "Limits", "Retry", "ActiveVersionId", "LastVersionNumber", "TotalRuns",
                "LastRunAt", "Deletion"),
            ["FunctionVersionEntity"] = Set("ImageDigest", "ArtifactId", "ArtifactSha256", "CodeHash", "ManifestHash", "Limits",
                "Retry", "RuntimeId"),
            ["FunctionRunEntity"] = Set("ImageDigest", "TenantId", "MaxAttempts", "CpuWindowMs", "ExitCode", "RunnerId", "Reused",
                "DiscardReason", "HandoverMs", "ReuseRequested", "Timings", "IdempotencyKey"),
            ["FunctionRunLogEntity"] = Set("Seq"),
            ["FunctionBuildEntity"] = Set("SourceHash", "ImageDigest", "ArtifactSha256", "BaseImage", "Ephemeral"),
            ["ProxyDetailEntity"] = Set("Stats"),
            ["ProxyVersionEntity"] = Set("CreatedByName"),
            ["ProxyExecutionEntity"] = Set("IsTest", "CallerKind", "CallerUserName", "CallerImpersonated",
                "CallerImpersonationSessionId", "CallerIp", "CallerUserAgent", "CallerOrigin", "WorkflowRunId", "WorkflowNodeId",
                "RouteUpstreamPath"),
            ["OfflineNotification"] = Set("ReadByUserIds"),
            ["FirebaseConfiguration"] = Set("AuthorizationKey"),
            ["Repo"] = Set("ProjectId", "DeployedNamespace", "DeploySettings", "GithubWebhook", "DependencyTrackProjectUuid",
                "SecretStoreItemId", "RepositoryType")
        };

        public static bool IsOffered(string schemaName) => Owners.ContainsKey(schemaName);

        /// <summary>True when the property, or a property above it, is hidden.</summary>
        public static bool IsHiddenField(string schemaName, string fieldPath)
        {
            if (!HiddenFields.TryGetValue(schemaName, out var hidden) || string.IsNullOrEmpty(fieldPath)) return false;
            if (hidden.Contains(fieldPath)) return true;
            var end = fieldPath.LastIndexOf('.');
            return end > 0 && IsHiddenField(schemaName, fieldPath[..end]);
        }

        /// <summary>The schema's properties without the hidden ones.</summary>
        public static List<FieldDefinition> VisibleFields(SchemaDefinition schema) =>
            schema.Fields.Where(field => !IsHiddenField(schema.SchemaName, field.Name)).ToList();

        /// <summary>The first hidden property among the names, or null.</summary>
        public static string? FirstHidden(string schemaName, IEnumerable<string> fieldPaths) =>
            fieldPaths.FirstOrDefault(path => IsHiddenField(schemaName, path));

        /// <summary>The first hidden property a row rule compares, in any nested group, or null.</summary>
        public static string? FirstHiddenInRules(string schemaName, PolicyRuleGroup? group)
        {
            if (group is null) return null;
            return FirstHidden(schemaName, group.Rules.SelectMany(SchemaFieldsOf))
                ?? group.NestedGroups.Select(nested => FirstHiddenInRules(schemaName, nested)).FirstOrDefault(name => name is not null);
        }

        private static IEnumerable<string> SchemaFieldsOf(PolicyRule rule)
        {
            if (rule.LeftSource == ConditionSource.SCHEMA_FIELD) yield return rule.LeftOperand;
            if (rule.RightSource != ConditionSource.SCHEMA_FIELD) yield break;
            yield return rule.RightOperand;
            foreach (var operand in rule.RightOperands) yield return operand;
        }

        private static IReadOnlySet<string> Set(params string[] names) => new HashSet<string>(names, StringComparer.Ordinal);
    }
}
