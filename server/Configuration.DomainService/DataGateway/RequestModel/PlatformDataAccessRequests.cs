using Blocks.Genesis.Entities.Data;

namespace Configuration.DomainService.DataGateway.RequestModel
{
    public sealed class SavePlatformPolicyRequest
    {
        public string? ItemId { get; set; }
        public string SchemaId { get; set; } = string.Empty;
        public string PolicyName { get; set; } = string.Empty;
        public string? PolicyDescription { get; set; }
        public PolicyOperation? Operation { get; set; }
        public PolicyType? PolicyType { get; set; }
        public string[] FieldNames { get; set; } = [];
        public PolicyRuleGroup RuleGroup { get; set; } = new();
        public int? Priority { get; set; }
        public bool? IsAllowPolicy { get; set; }
    }

    public sealed class ConfigurePlatformAccessRequest
    {
        public string SchemaId { get; set; } = string.Empty;
        public PolicyOperation? Operation { get; set; }
        public PolicyType? PolicyType { get; set; }
        public string[] FieldNames { get; set; } = [];
        public SchemaAccessLevel? AccessLevel { get; set; }
    }

    public sealed class SavePlatformValidationRequest
    {
        public string SchemaId { get; set; } = string.Empty;
        /// <summary>The property; a nested one by its dotted path, e.g. Read.Roles.</summary>
        public string FieldName { get; set; } = string.Empty;
        public List<ValidationRule> Validations { get; set; } = [];
    }

    public sealed class SetPlatformFieldDefaultRequest
    {
        public string SchemaId { get; set; } = string.Empty;
        /// <summary>The property; a nested one by its dotted path, e.g. Read.Roles.</summary>
        public string FieldName { get; set; } = string.Empty;
        /// <summary>Null clears the default.</summary>
        public FieldDefaultValue? DefaultValue { get; set; }
    }

    public sealed class BulkPlatformValidationRequest
    {
        public List<string> SchemaIds { get; set; } = [];
        /// <summary>Default properties only; nested ones by their dotted path, e.g. Read.Roles.</summary>
        public List<string> FieldNames { get; set; } = [];
        public List<ValidationRule> Validations { get; set; } = [];
        /// <summary>True: each property gets exactly these rules. False or missing: they are added after its own.</summary>
        public bool? Replace { get; set; }
    }

    public sealed class BulkPlatformFieldDefaultRequest
    {
        public List<string> SchemaIds { get; set; } = [];
        /// <summary>Default properties only; nested ones by their dotted path, e.g. Read.Roles.</summary>
        public List<string> FieldNames { get; set; } = [];
        /// <summary>Null clears the default.</summary>
        public FieldDefaultValue? DefaultValue { get; set; }
    }
}
