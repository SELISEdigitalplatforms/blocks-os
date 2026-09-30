using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Entities
{
    /// <summary>
    /// One meter's ceiling and usage, for one environment, for one usage period.
    /// <para>
    /// blocks-os owns <see cref="Limit"/>, <see cref="Purchased"/> and <see cref="Enforcement"/>.
    /// Genesis owns <see cref="Usage"/> and never touches the others. The two sides never write the
    /// same field, which is why a limit change and a live increment need no coordination.
    /// </para>
    /// </summary>
    [BsonIgnoreExtraElements]
    public class ResourceLimit : BaseEntity
    {
        /// <summary>Full catalogue meter id, e.g. <c>api.calls</c>. This is what Genesis looks up.</summary>
        public string Resource { get; set; }

        /// <summary>Catalogue service that owns the meter, e.g. <c>api</c>. Derived from <see cref="Resource"/>.</summary>
        public string Service { get; set; }

        /// <summary>
        /// Which environment this row belongs to — <c>dev</c>, <c>stg</c>, <c>prod</c>. Every meter is
        /// environment-scoped; there is no project-wide pool and nothing is split or swapped.
        /// </summary>
        public string Environment { get; set; }

        /// <summary>
        /// The 30-day period this usage belongs to, e.g. <c>2026-09-12</c>. Without it, usage
        /// accumulates forever and every customer is blocked after one period's worth.
        /// </summary>
        public string PeriodKey { get; set; }

        /// <summary>
        /// <c>counter</c> consumed over the period · <c>resource</c> live objects that exist right now
        /// · <c>policy</c> a setting rather than a quota.
        /// </summary>
        public string Kind { get; set; }

        /// <summary>Included ceiling for the period. <c>-1</c> means uncapped.</summary>
        public long Limit { get; set; }

        /// <summary>Consumed so far. Written by Genesis only, with <c>$max</c>, so it can only rise within a period.</summary>
        public long Usage { get; set; }

        /// <summary>
        /// Units bought outright. These carry past the period boundary while the allowance resets, so
        /// nobody loses units they paid for two days earlier.
        /// </summary>
        public long Purchased { get; set; }

        /// <summary>
        /// What happens when the counter is unreachable. <c>open</c> for cheap counters, <c>closed</c>
        /// where every unit is spend that cannot be recovered.
        /// </summary>
        public string FailMode { get; set; } = "open";

        /// <summary>
        /// <c>enforced</c> or <c>off</c>. The kill switch at row scope; also how a project runs
        /// unmetered without Genesis retrying a cold key on every request.
        /// </summary>
        public string Enforcement { get; set; } = "enforced";

        public string ResourceType { get; set; }
        public DateTime Lifetime { get; set; }
        public bool IsActive { get; set; }
        public bool EnableAutoRenew { get; set; }
        public string TenantId { get; set; }
        public string Type { get; set; }
    }
}
