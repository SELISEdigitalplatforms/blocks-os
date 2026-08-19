# SeliseBlocks.Secrets.OS

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
