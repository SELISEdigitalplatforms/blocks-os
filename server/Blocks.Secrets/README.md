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

## Create

```csharp
var secretId = await _secrets.SetAsync(new SetSecretRequest
{
    Name  = "smtp-password",
    Value = plaintext,
    Type  = SecretTypes.Service,
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
    PageNumber = 1,
    PageSize   = 20,
});
```

```csharp
string value = await _secrets.GetValueAsync(secretId);

IReadOnlyDictionary<string, string> values = await _secrets.GetValuesAsync([id1, id2]);
```

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
