# SeliseBlocks.Secrets.OS

## Configuration

Values live in Azure Key Vault, configured through the `KeyVault` environment section — the same
keys `Blocks.Genesis` reads, so a host already configured for Genesis needs nothing extra.

| Variable | Required | Purpose |
|---|---|---|
| `KeyVault__KeyVaultUrl` | yes | Vault URL, e.g. `https://my-vault.vault.azure.net/` |
| `KeyVault__ClientId` | no | Service-principal application id |
| `KeyVault__ClientSecret` | no | Service-principal secret |
| `KeyVault__TenantId` | no | Directory tenant id |

Authentication tries `DefaultAzureCredential` first — managed identity on Azure, `az login` /
Visual Studio / `AZURE_*` environment variables locally. When that chain has nothing available and
all three of `ClientId`, `ClientSecret`, and `TenantId` are set, it falls back to those. Set them on
hosts with no CLI login and no managed identity. A partially filled set is ignored.

Bad credentials surface on the first vault call, not at startup: resolution happens in a
synchronous singleton constructor, so probing the token there would block container build on a
network round trip and take the host down on a transient AAD blip.

## Setup

```csharp
services.AddBlocksSecrets();

builder.Services.Configure<MvcOptions>(options => options.Filters.Add<SecretExceptionFilter>());
```

Inject `ISecretService` wherever you need it.

## Types

| Type | Access list | Value readable by | Shown in the Blocks OS UI |
|---|---|---|---|
| `api` | yes | the access list, the creator, root | reveal, copy, edit, rotate |
| `service` | no | any authenticated caller in the tenant | metadata only |
| `both` | no | any authenticated caller in the tenant | reveal, copy, edit, rotate |

`both` reads **identically** to `service` — a valid tenant context and `Active` status is the
whole check for either. The difference is presentational: the UI offers value and edit actions
for `both` and hides them for `service`. That makes an existing capability visible rather than
granting a new one, because the API has always let any authenticated caller in the tenant read
a `service` value.

The type is fixed at creation. There is no operation that rewrites it, because converting one
in place would silently move an existing credential between access models — a `service` secret
turned `both` would become visible to every user in the tenant without anyone re-approving it.

`SecretTypes.HasAccessList` is the single predicate behind the distinction; four rules depend
on it (whether a create stores an access list, whether `UpdateAccessAsync` applies, whether a
value read consults the list, and whether a metadata mutation does).

## Create

```csharp
var secretId = await _secrets.SetAsync(new SetSecretRequest
{
    Name  = "smtp-password",
    Value = plaintext,
    Type  = SecretTypes.Service,
    Tags  = ["mail", "env:prod"],
});
```

```csharp
var ids = await _secrets.SetManyAsync(
[
    new SetSecretRequest { Name = "smtp-password", Value = pwd,  Type = SecretTypes.Service },
    new SetSecretRequest { Name = "smtp-host-key", Value = key,  Type = SecretTypes.Service },
]);
// ids["smtp-password"] => "3f2a...c91"
```

Store the returned id on your own documents. Never the value.

## Read

```csharp
SecretResult? secret = await _secrets.GetAsync(secretId);

SecretListResult page = await _secrets.FindAsync(new SecretFilter
{
    Search     = "smtp",
    Type       = SecretTypes.Service,
    Tags       = ["iam", "os"],   // any of them, not all
    PageNumber = 1,
    PageSize   = 20,
});
```

```csharp
string value = await _secrets.GetValueAsync(secretId);

IReadOnlyDictionary<string, string> values = await _secrets.GetValuesAsync([id1, id2]);
```

## Tags

Tags are free-form labels for grouping and lookup. They carry no authorization meaning — an
access list is still what decides who may read a value.

They are normalized on write: trimmed, lowercased, de-duplicated and ordered. A tag must start
with a letter or digit and may then contain letters, digits, `.`, `_`, `-` and `:`; the colon
is there so a tag can be namespaced as `env:prod`. At most 20 tags per secret, 50 characters
each.

`UpdateAsync` replaces the whole set. Null leaves the existing tags alone; an empty collection
clears them.

```csharp
await _secrets.UpdateAsync(secretId, new UpdateSecretRequest { Tags = ["mail", "env:staging"] });
```

Filtering is **any-of**: a secret matching at least one of the given tags is returned, so
selecting a second tag widens the result rather than narrowing it. At most 10 tags per filter.

### The catalogue

`GetTagsAsync` returns the tenant's tag catalogue — key plus display label — for a tag picker
or a tag filter:

```csharp
IReadOnlyList<SecretTagEntry> tags = await _secrets.GetTagsAsync();
// [{ Key = "iam", Label = "Blocks Iam" }, …]
```

It lives in the tenant database's `keyValueStores` collection under `my-secret-tags`, read and
written through Genesis's `IKeyValueStore`:

```json
{
  "Key": "my-secret-tags",
  "Value": [
    { "Key": "iam", "Label": "Blocks Iam" },
    { "Key": "os",  "Label": "Blocks Logic" }
  ]
}
```

Entries seeded by hand keep the labels they were given. When a create or update carries a tag
the catalogue has not seen, the platform adds it with a label derived from the key
(`payments-team` becomes "Payments Team"); an existing key is never rewritten. Nothing removes
an entry, so a tag stays on offer after the last secret using it is gone.

The catalogue is a convenience list, not an authority. It never constrains what a secret may be
tagged with and is never consulted to validate a tag, so a missing document means "no
suggestions" rather than an error, and a failed catalogue write never fails the secret write
that triggered it.

## Update and rotate

```csharp
await _secrets.UpdateAsync(secretId, new UpdateSecretRequest
{
    Name        = "smtp-password-primary",
    Description = "Outbound mail",
});

await _secrets.RotateAsync(secretId, new RotateSecretRequest { Value = newPlaintext });
```

## Lifecycle

```csharp
await _secrets.LockAsync(secretId);
await _secrets.UnlockAsync(secretId);
await _secrets.DeleteAsync(secretId);
await _secrets.RestoreAsync(secretId);
```

## Access

```csharp
await _secrets.UpdateAccessAsync(secretId, new SecretAccess
{
    UserIds = { "user-1", "user-2" },
    Roles   = { "admin" },
});
```

## Audit

```csharp
SecretAuditListResult logs = await _secrets.GetAuditLogsAsync(new SecretAuditFilter
{
    SecretId   = secretId,
    FromDate   = DateTime.UtcNow.AddDays(-30),
    PageNumber = 1,
    PageSize   = 20,
});
```

## Errors

| Exception | HTTP |
|---|---|
| `SecretValidationException` | 400 |
| `SecretAccessDeniedException` | 403 |
| `SecretNotFoundException` | 404 |
| `SecretStateException` | 409 |
| `SecretVaultException` | 502 |

## HTTP

| Route | Method | Purpose |
|---|---|---|
| `/Secrets/gets` | GET | List metadata; `?tags=iam&tags=os` filters to secrets carrying any of them |
| `/Secrets/tags` | GET | The tenant's tag catalogue, for a picker or a filter |
| `/Secrets/values` | POST | Batch plaintext read by id |
