# Multi-Application Project Configuration — Specification

## Overview & Goals

The `GET /api/Project/Get` endpoint currently returns only the first application from `Tenant.Applications` as flat fields (`applicationDomain`, `isDomainVerified`, `cookieDomain`). The database stores multiple applications per project, but the API and frontend only surface one. This spec enhances the existing API response to include the full `Applications` array, and updates the frontend to display and manage multiple applications on the Configure page.

### Goals
- **Enhance (not replace)** existing `GET /api/Project/Get` — add `applications` array to response
- **Backward compatible** — existing flat fields retained for unmodified consumers
- **Frontend Configure page** shows all applications with domain, verified status, cookie domain
- **Add Application** flow on the Configure page
- **Zero new endpoints** — enhance existing response model only

### Non-Goals
- Deleting applications (managed via `UpdateProject` which already adds new apps)
- Application-specific configuration (certificates, JWT — out of scope)

---

## Architecture

### Current State

```
GET /api/Project/Get
  → ProjectManagementService.GetAsync()
    → tenant.Applications.FirstOrDefault() → flat fields
    → Response: { applicationDomain, isDomainVerified, cookieDomain, ... }
```

### Target State

```
GET /api/Project/Get
  → ProjectManagementService.GetAsync()
    → tenant.Applications → mapped to ApplicationDto[]
    → Response: { ..., applications: [{ domain, cookieDomain, isDomainVerified }] }
    → (backward compat: flat fields still populated from FirstOrDefault)
```

---

## Backend Changes

### New DTO

```csharp
// server/Identifier.DomainService/Project/ApplicationDto.cs
public class ApplicationDto
{
    public string Domain { get; set; }
    public string CookieDomain { get; set; }
    public bool IsDomainVerified { get; set; }
}
```

### Enhanced Response Model

```csharp
// server/Identifier.DomainService/Project/GetProjectRequest.cs
public class GetProjectResponseData : Project
{
    public string TenantSlug { get; set; }
    public List<ApplicationDto> Applications { get; set; }  // NEW
}
```

### Service Change (`ProjectManagementService.GetAsync`, line 372-406)

After existing mapping, add:
```csharp
Applications = tenant.Applications?.Select(a => new ApplicationDto
{
    Domain = a.Domain,
    CookieDomain = a.CookieDomain,
    IsDomainVerified = a.IsDomainVerified
}).ToList() ?? new List<ApplicationDto>()
```

**Files modified:**
- `Identifier.DomainService/Project/GetProjectRequest.cs` — add `Applications` property
- New: `Identifier.DomainService/Project/ApplicationDto.cs` — DTO
- `Identifier.DomainService/Project/Services/ProjectManagementService.cs` — map Applications in `GetAsync()`

---

## Frontend Changes

### Model Update

```typescript
// client/app/models/project.model.ts
export interface IApplication {
  domain: string;
  cookieDomain: string;
  isDomainVerified: boolean;
}

export interface IProject {
  // ... existing fields unchanged
  applications: IApplication[];  // NEW
}
```

### Configure Page Enhancement

The existing `Configure` component at `client/app/idp/iam/modules/user-management/configure/configure.tsx` currently shows IAM configuration fields. This spec adds an **Applications section** to the configure page showing:

```
┌──────────────────────────────────────────────────┐
│  Applications                                     │
│                                                   │
│  ┌──────────────────────────────┬────────┬──────┐│
│  │ Domain                       │ Status │      ││
│  ├──────────────────────────────┼────────┼──────┤│
│  │ https://dbaosi.dev.blocks... │ ✓      │ App 1││
│  │ https://dev-construct.sel... │ ✓      │ App 2││
│  │ https://dev-api.selisebl...  │ ✓      │ App 3││
│  └──────────────────────────────┴────────┴──────┘│
│                                                   │
│  [+ Add Application]                              │
└──────────────────────────────────────────────────┘
```

### Components Used (all existing)

| Element | Component |
|---------|-----------|
| Section card | `<Card>` + `<CardContent>` |
| Application list | `<Table>` family |
| Domain display | `<span>` + monospace |
| Verified badge | `<Badge>` variant="outline" (green) or "destructive" (red) |
| Add button | `<Button>` variant="outline" |
| Add dialog | `<Dialog>` with `<Form>` (Input for domain) |
| Loading | `<Skeleton>` |

### Add Application Flow
1. Click "+ Add Application" button
2. `<Dialog>` opens with form: Domain URL input
3. On submit: calls `POST /api/Project/UpdateProject` with new `applicationDomain`
4. (Backend already handles adding to `tenant.Applications` list — line 435)
5. On success: invalidate project query, dialog closes, toast

---

## API Contract (Unchanged)

```
GET /api/Project/Get
```

**Response (enhanced):**
```json
{
    "data": {
        "tenantSlug": "dbaosi",
        "name": "Gateway",
        "applicationDomain": "https://dbaosi.dev.blocksdevelopers.com",
        "isDomainVerified": false,
        "cookieDomain": "blocksdevelopers.com",
        "applications": [
            {
                "domain": "https://dbaosi.dev.blocksdevelopers.com",
                "cookieDomain": "blocksdevelopers.com",
                "isDomainVerified": false
            },
            {
                "domain": "https://dev-construct.seliseblocks.com",
                "cookieDomain": "blocksdevelopers.com",
                "isDomainVerified": true
            },
            {
                "domain": "https://dev-api.seliseblocks.com",
                "cookieDomain": "blocksdevelopers.com",
                "isDomainVerified": true
            }
        ],
        "itemId": "e7c9f7fa-7a7a-4055-b476-186cfda98a97",
        ...
    }
}
```

---

## Testing Plan

### Backend (xUnit)

| Test | Coverage |
|---|---|
| `GetAsync_ReturnsAllApplications` | Maps full applications array |
| `GetAsync_NoApplications_ReturnsEmptyList` | Null/missing array handling |
| `GetAsync_BackwardCompat_PreservesFlatFields` | Flat fields still populated |

### Frontend (Vitest)

| Test | Coverage |
|---|---|
| Renders applications table from project data | Happy path |
| Renders empty state when no applications | Empty |
| Add Application dialog opens and submits | Form flow |
| Verified badge shows correct variant | Conditional rendering |

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Applications array null/missing | Returns empty array `[]` |
| Add application fails (API error) | Toast error, dialog stays open |
| Domain already exists | Backend validation (existing) |

---

## Deployment
1. Deploy backend: add `ApplicationDto`, update `GetProjectResponseData`, update `GetAsync()` mapping
2. Deploy frontend: update `IProject` model, add Applications section to Configure page
3. No database migrations needed
4. No new permissions needed

---

## Dependencies
- Existing `Tenant.Applications` list (Blocks.Genesis)
- Existing `ProjectController.Get()` endpoint
- Existing `UpdateProject` endpoint (already appends to Applications at line 435)

## References
- `ProjectManagementService.GetAsync()` — line 372-406
- `ProjectManagementService.UpdateProjectAsync()` — line 408-471 (line 435 adds to Applications)
- `IProject` model — `client/app/models/project.model.ts`
- `Configure` component — `client/app/idp/iam/modules/user-management/configure/configure.tsx`