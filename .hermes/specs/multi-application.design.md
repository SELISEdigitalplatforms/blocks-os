# design.md — Multi-Application Project Configuration

## Overview

Add an Applications management section to the existing Configure page at `/app/dashboard`. The backend already supports multiple applications per project via `Tenant.Applications[]`; this design surfaces them in the UI and enables adding new applications through the existing `UpdateProject` endpoint.

## Goals
- Display all configured applications with domain, verification status
- Add Application dialog calling existing `POST /api/Project/UpdateProject`
- Backward compatible — no changes to existing IAM configuration form
- Zero new components — all composed from existing shadcn/ui

---

## User Flows

### View Applications
1. Navigate to `/app/dashboard` → click Configure button
2. Scroll past IAM configuration form
3. See Applications section with table of all configured domains

### Add Application
1. Click "+ Add Application" button
2. Dialog opens with Domain URL input
3. Submit → calls `UpdateProject` with new `applicationDomain`
4. Backend appends to `Applications` array (existing logic at line 435)
5. On success: dialog closes, table refreshes, toast

---

## Screen: Configure Page (Enhanced)

### Component Hierarchy

```
Configure (existing, enhanced)
├── PageBreadcrumb
├── h1 "User Configuration"
├── Card (IAM config — existing, unchanged)
│   └── CardContent
│       └── Form (existing fields)
├── Separator (NEW)
├── Section heading: "Applications" + Add button (NEW)
└── Card (NEW — Applications table)
    └── CardContent
        ├── Table
        │   ├── TableHeader (Domain, Status)
        │   └── TableBody (rows)
        └── Empty state (conditional)
```

### States

#### Populated
```
┌──────────────────────────────────────────┐
│  Applications                  [+ Add]   │
│  ┌──────────────────────┬──────────────┐ │
│  │ Domain               │ Status       │ │
│  ├──────────────────────┼──────────────┤ │
│  │ https://dbaosi.dev.. │ 🛡 Verified  │ │
│  │ https://dev-constru..│ 🛡 Verified  │ │
│  └──────────────────────┴──────────────┘ │
└──────────────────────────────────────────┘
```

#### Empty
```
┌──────────────────────────────────────────┐
│  Applications                  [+ Add]   │
│  ┌──────────────────────────────────────┐ │
│  │                                      │ │
│  │   No applications configured         │ │
│  │   Add an application to get started  │ │
│  │                                      │ │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

#### Loading
```
┌──────────────────────────────────────────┐
│  Applications                            │
│  ┌──────────────────────────────────────┐ │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Add Application Dialog

```
┌──────────────────────────────────────┐
│         Add Application              │
│                                      │
│  Domain URL                          │
│  ┌──────────────────────────────────┐│
│  │ https://dev-new.example.com      ││
│  └──────────────────────────────────┘│
│                                      │
│  Cookie Domain (auto-detected)       │
│  ┌──────────────────────────────────┐│
│  │ blocksdevelopers.com             ││
│  └──────────────────────────────────┘│
│                                      │
│         [Cancel]    [Add]            │
└──────────────────────────────────────┘
```

---

## Reused Components

| Component | Usage |
|-----------|-------|
| `Separator` | Divide IAM config from Applications |
| `Card` + `CardContent` | Applications section container |
| `Table` family | Read-only application list |
| `Badge` variant="outline" | Verified/unverified status |
| `Button` variant="outline" size="sm" | Add button |
| `Dialog` | Add Application modal |
| `Form` + `FormField` + `FormItem` | Dialog form |
| `Input` | Domain URL field |
| `Skeleton` | Loading state |
| `ShieldCheck` / `ShieldX` (lucide-react) | Status icons |
| `Globe` (lucide-react) | Section icon |

**New components: None.**

---

## Design Tokens Used
All from `globals.css`:
- `text-muted-foreground` — form labels
- `text-sm` — table body
- `font-bold text-medium-emphasis` — table headers
- `rounded-lg` (= `var(--radius)`) — card radius
- `gap-6` — card spacing
- `h-12 rounded-xl` — skeleton rows
- `text-success` / `text-destructive` — badge variants

---

## Responsive Behavior
- **Desktop:** Table with full-width domain column
- **Tablet:** Table with truncated domain text
- **Mobile:** Card-based layout (each app becomes a `<Card>`)

---

## Accessibility
- `<Table>` provides semantic structure
- Dialog traps focus, closes on Escape
- `aria-label` on icon-only Add button
- Toast announces success/failure
- Keyboard: Tab through form, Enter to submit

---

## Edge Cases
- Applications array empty → empty state with helper text
- Applications array null/missing (backward compat) → empty state
- Add fails → error toast, dialog stays open
- Domain already exists → backend validation error shown in dialog

---

## Acceptance Criteria
- [ ] Applications section renders below IAM config form
- [ ] Table shows all applications from `project.applications`
- [ ] Verified/unverified badge renders correctly
- [ ] "+ Add Application" opens dialog with domain input
- [ ] Submit calls `UpdateProject` and refreshes
- [ ] Empty state renders when no applications
- [ ] Loading state shows skeletons
- [ ] Error shows toast
- [ ] Dark mode renders correctly
- [ ] Responsive at tablet and mobile

---

## Implementation Notes
- Files to modify: `configure.tsx` (add section), `project.model.ts` (add `IApplication`)
- Files to create: None
- Estimated effort: ~2 hours
- Pattern: Follow existing form structure (Card > CardContent > content)