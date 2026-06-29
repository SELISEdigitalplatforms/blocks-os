# System Email Templates (IAM) — Specification

## Overview & Goals

A template management system for IAM transactional emails in blocks-os. Unlike blocks-utilities marketing email templates, these are **system-level templates** tied to IAM lifecycle events: account activation, password reset, welcome, MFA setup, invitation, and deactivation. Templates support multi-language, variable substitution (via existing `BodyDataContext`), and HTML editing.

### Goals
- **Template CRUD** per email purpose — AccountActivation, PasswordReset, Welcome, MFA, Invitation, AccountDeactivated
- **Multi-language** — per-template language variants (en-US, fr, de, etc.)
- **Variable substitution** — use existing `BodyDataContext`/`SubjectDataContext` keys as template variables
- **HTML preview** — render template with sample data before saving
- **Live preview in BeeFree** — reuse existing `@beefree.io/sdk` integration for drag-and-drop HTML editing
- **Default fallback** — system defaults per purpose/language when no custom template exists
- **Plugs into existing `SendMail` flow** — no change to `SendEmailAsync` or the consumer pipeline

### Non-Goals
- Marketing/campaign templates (those live in blocks-utilities)
- Workflow/approval on template changes
- A/B testing
- Dynamic recipient lists

---

## Architecture

### How It Plugs In

```
Current flow:
  IdentityAccessManagementService.SendActivationToEmailAsync()
    → builds SendMail { Purpose, BodyDataContext, SubjectDataContext, Language }
    → queues to MailQueue
    → Consumer renders email body (currently hardcoded?)

New flow:
  IdentityAccessManagementService.SendActivationToEmailAsync()
    → builds SendMail { Purpose, BodyDataContext, SubjectDataContext, Language }
    → queues to MailQueue
    → Consumer fetches template by (Purpose, Language)
    → renders with BodyDataContext variables
    → sends via SMTP
```

### Entity Model

```csharp
public class SystemEmailTemplate : BaseEntity
{
    public string Purpose { get; set; }        // "AccountActivation", "PasswordReset", etc.
    public string Language { get; set; }        // "en-US", "fr", "de", etc.
    public string Subject { get; set; }          // "Welcome to {{ProjectName}}!"
    public string BodyHtml { get; set; }         // Full HTML with {{variable}} placeholders
    public string Description { get; set; }      // Admin note
    public bool IsActive { get; set; }           // Enable/disable this template
    public List<string> Variables { get; set; }  // Auto-extracted from Subject+Body: ["UserName","ActivationLink"]
}
```

### Email Purposes (predefined, not user-creatable)

| Purpose | Default trigger | Typical variables |
|---|---|---|
| `AccountActivation` | User signs up | `UserName`, `ActivationLink`, `ProjectName` |
| `AccountActivated` | User confirms email | `UserName`, `LoginLink` |
| `PasswordReset` | Forgot password request | `UserName`, `ResetLink`, `ExpiryHours` |
| `PasswordResetSuccess` | Password changed | `UserName` |
| `ProjectInvitation` | Admin invites user to project | `UserName`, `InvitationLink`, `ProjectName`, `InviterName` |
| `MfaSetup` | User enabled MFA | `UserName`, `MfaType` |
| `MfaCode` | MFA code sent via email | `UserName`, `MfaCode`, `ExpiryMinutes` |
| `AccountDeactivated` | User deactivated | `UserName` |
| `Welcome` | First login after activation | `UserName`, `LoginLink`, `ProjectName` |

### Consumer Integration

The `SendEmailConsumer` (or its equivalent in blocks-os Worker) fetches the template:

```csharp
var template = _templateRepo.GetByPurposeAndLanguage(
    sendMailEvent.Purpose, sendMailEvent.Language);

var subject = Render(template?.Subject ?? Defaults.Subject[purpose], sendMailEvent.SubjectDataContext);
var body = Render(template?.BodyHtml ?? Defaults.BodyHtml[purpose], sendMailEvent.BodyDataContext);

// Then send via SMTP as before
```

If no custom template exists → use built-in system defaults (hardcoded, always available as fallback).

---

## API Contract

```
GET    /api/system-templates                    → List<SystemEmailTemplate> (filtered by purpose, language)
GET    /api/system-templates/{id}               → SystemEmailTemplate detail
POST   /api/system-templates                    → Create template for a purpose+language
PUT    /api/system-templates/{id}               → Update template
DELETE /api/system-templates/{id}               → Delete (reverts to default)
POST   /api/system-templates/{id}/duplicate     → Clone to another language
GET    /api/system-templates/purposes           → List available purposes with variable docs
POST   /api/system-templates/preview            → Render template with test data, return HTML
```

### Preview Request
```json
{
  "templateId": "optional-existing-template",
  "bodyHtml": "<p>Hello {{UserName}}</p>",
  "subject": "Welcome {{UserName}}",
  "testData": { "UserName": "Jane Doe", "ActivationLink": "https://..." }
}
```

Response: `{ "subject": "Welcome Jane Doe", "bodyHtml": "<p>Hello Jane Doe</p>" }`

---

## Backend Files

```
server/
├── CloudConfiguration.DomainService/
│   └── SystemTemplates/
│       ├── Entities/
│       │   └── SystemEmailTemplate.cs
│       ├── Services/
│       │   ├── ISystemTemplateService.cs
│       │   ├── SystemTemplateService.cs
│       │   ├── ISystemTemplateRepository.cs
│       │   └── SystemTemplateRepository.cs
│       ├── Dtos/
│       │   ├── SaveSystemTemplateRequest.cs
│       │   ├── GetSystemTemplateRequest.cs
│       │   ├── PreviewTemplateRequest.cs
│       │   └── SystemTemplateResponse.cs
│       └── Validators/
│           └── SystemTemplateValidator.cs
├── Api/Controllers/
│   └── SystemTemplateController.cs    # New controller
└── XUnitTest/SystemTemplates/
    ├── SystemTemplateServiceTests.cs
    └── SystemTemplateControllerTests.cs
```

---

## Frontend Implementation

### Route
`/system-templates` — under blocks-os dashboard

### Files
```
client/app/
├── routes/dashboard/
│   └── system-templates.tsx
├── pages/system-templates/
│   ├── system-templates-page.tsx        # Table: purpose, language, last updated, active toggle
│   ├── system-template-editor.tsx       # BeeFree HTML editor + subject line + variables sidebar
│   ├── system-template-preview.tsx      # Rendered preview modal
│   └── index.ts
├── hooks/
│   └── use-system-templates.ts
├── models/
│   └── system-template.ts
└── constants/
    └── system-template-constants.ts      # Purpose labels, default variables per purpose
```

### Page Layout

```
┌──────────────────────────────────────────────────────────┐
│  📧 System Email Templates                               │
│                                                          │
│  [Purpose: All ▼] [Language: en-US ▼]                   │
│                                                          │
│  ┌──────────────┬──────────┬──────────────┬────────────┐│
│  │ Purpose      │ Language │ Last Updated │ Active     ││
│  ├──────────────┼──────────┼──────────────┼────────────┤│
│  │ Activation   │ en-US    │ 2 days ago   │ ✓          ││
│  │ Activation   │ fr       │ 1 week ago   │ ✓          ││
│  │ PasswordReset│ en-US    │ default      │ ✓          ││
│  │ Welcome      │ en-US    │ 3 hours ago  │ ✓          ││
│  └──────────────┴──────────┴──────────────┴────────────┘│
│                                                          │
│  Click row → opens BeeFree HTML editor                   │
└──────────────────────────────────────────────────────────┘
```

### Editor Layout

```
┌──────────────────────────────────────────────────────────┐
│  ← Back    Account Activation (en-US)    [Preview] [Save]│
├──────────────────────────────────────────────────────────┤
│  Subject: [Welcome to {{ProjectName}}, {{UserName}}!   ] │
│                                                          │
│  ┌─────────────────────┬──────────────────────────────┐ │
│  │ Variables            │  ┌────────────────────────┐ │ │
│  │ (drag to insert)      │  │  BeeFree HTML Editor   │ │ │
│  │                       │  │                        │ │ │
│  │ {{UserName}}          │  │  [Drag & drop blocks]  │ │ │
│  │ {{ActivationLink}}    │  │                        │ │ │
│  │ {{ProjectName}}       │  │  Logo + heading + CTA  │ │ │
│  │ {{ExpiryHours}}       │  │                        │ │ │
│  │                       │  │                        │ │ │
│  └─────────────────────┴──────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Variables auto-extraction

On save, parse `Subject` + `BodyHtml` for `{{VariableName}}` patterns and store in `Variables` list for documentation.

---

## States

| State | UI |
|---|---|
| Loading | Skeleton rows |
| Empty | "No custom templates yet. All emails use system defaults." |
| Default template | Badge: "Default" — clicking opens editor to customize |
| Custom template | Badge: "Custom" — active toggle visible |
| Save error | Toast with error |
| Preview | Modal with iframe-rendered HTML + rendered subject |

---

## Security

- `[Authorize]` + `[ProtectedEndPoint("blocks-os::system-templates::manage")]`
- Template variables sanitized before rendering (no raw JS/script injection)
- Only HTML content from BeeFree allowed (sanitized server-side)

---

## Dependencies

### NuGet
None new — variables rendered with `Regex.Replace` or Handlebars.NET if needed

### npm
- `@beefree.io/sdk` — already in `package.json` (used for email templates in blocks-utilities)

---

## Testing Plan

### Backend

| Test | Coverage |
|---|---|
| `GetByPurposeAndLanguage_ReturnsCustomTemplate` | Happy path |
| `GetByPurposeAndLanguage_ReturnsNullWhenNoCustom` | Default fallback |
| `GetByPurposeAndLanguage_FallsBackToDefaultLanguage` | Language fallback |
| `Save_OverwritesExistingForSamePurposeAndLanguage` | Idempotent save |
| `Delete_RevertsToDefault` | Deletion |
| `Preview_RendersVariables` | Variable substitution |
| `Preview_HandlesMissingVariables` | Graceful for missing |
| `ExtractVariables_FromSubjectAndBody` | Auto-extraction |

### Frontend

| Test | Coverage |
|---|---|
| Table renders templates | List view |
| Click row opens BeeFree editor | Navigation |
| Save updates template | Mutation |
| Preview modal renders | Preview |
| Empty state when no templates | Empty |

---

## Deployment

1. Create `SystemEmailTemplates` MongoDB collection
2. Seed default templates per purpose + language (embedded resources or migration)
3. Update `SendEmailConsumer` to resolve templates
4. Deploy controller + frontend
5. Add `blocks-os::system-templates::manage` permission

---

## References

- Existing `SendMail` DTO — `Purpose`, `BodyDataContext`, `SubjectDataContext`, `Language` fields already designed for template-driven emails
- Existing `MailServerConfiguration` in CloudConfiguration.DomainService — email infrastructure already exists
- Existing `@beefree.io/sdk` in package.json — drag-and-drop HTML editor already available
- Existing `IdentityAccessManagementService.SendActivationToEmailAsync` — consumer of these templates