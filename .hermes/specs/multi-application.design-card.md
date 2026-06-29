# design-card.md — Multi-Application Project Configuration

## Executive Summary

Add an Applications management section to the existing Configure page (`/app/dashboard` → Configure button). The backend already stores multiple applications per project; this feature surfaces them in the UI and adds an "Add Application" dialog. **Conservative Evolution** — extends the existing Configure page with no new patterns.

**Status:** Complete

---

## Progress Tracker

- [x] Repository inspection
- [x] Issue analysis  
- [x] Pattern discovery
- [x] Design exploration
- [x] Component mapping
- [x] Recommendation

---

## GitHub Issue Summary

**#206 — Multi-Application Project Configuration:** `GET /api/Project/Get` returns only the first application. The database stores multiple. Enhance the API response to include `applications[]`, update the frontend `IProject` model, and add an Applications section to the Configure page.

---

## Repository Analysis

### Target Page
`client/app/idp/iam/modules/user-management/configure/configure.tsx`

### Existing Page Pattern
```
<main className="px-4 pt-4 md:px-6 md:pt-6">
  <PageBreadcrumb breadcrumbIndex={2} />
  <h1 className="text-2xl font-semibold">User Configuration</h1>
  <Card>
    <CardContent>
      {isLoading ? skeleton : <Form> ...fields... </Form>}
    </CardContent>
  </Card>
</main>
```

### Components Already Used on Configure Page
`PageBreadcrumb` `Card` `CardContent` `Form` `FormField` `FormItem` `FormLabel` `FormControl` `FormMessage` `Input` `Button` `Checkbox` `Skeleton`

### Existing Patterns Available
- `Separator` — section dividers
- `Badge` — status indicators (verified/unverified)
- `Dialog` — modal forms (for Add Application)
- `Table` — read-only data display
- `Globe` / `ShieldCheck` / `ShieldX` — lucide-react icons

---

## Design Variants

### Variant 1: Conservative Evolution (Recommended)

Add an Applications table section below the existing IAM configuration form, separated by a `<Separator>`. Uses `<Table>` for read-only display and `<Dialog>` for Add Application form.

**Desktop Layout:**

```
┌──────────────────────────────────────────────────┐
│  ← IAM / Configure                                │
│                                                   │
│  User Configuration                               │
│  ┌──────────────────────────────────────────────┐ │
│  │ [Account activation url]  [Account verif...]│ │
│  │ [Recovery account URL]   [Activation life..] │ │
│  │ [Recovery lifetime]      [☐ Logout on pw..] │ │
│  │                           [Reset] [Change]   │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ──────────────────────────────────────────────── │
│                                                   │
│  Applications                          [+ Add]    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Domain                        │ Status      │ │
│  ├───────────────────────────────┼─────────────┤ │
│  │ https://dbaosi.dev.blocks...  │ ✓ Verified  │ │
│  │ https://dev-construct.seli... │ ✓ Verified  │ │
│  │ https://dev-api.seliseblo...  │ ✓ Verified  │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Variant 2: Card-Based Applications

Replace the table with individual `<Card>` components for each application. Each card shows domain, status, and actions. Better for mobile and touch.

### Variant 3: Inline Editable Table

Editable table with inline domain editing, delete confirmations, and keyboard shortcuts. Power-user focused but higher dev effort.

---

## Comparison

| Dimension | V1: Table | V2: Cards | V3: Inline Edit |
|-----------|:---:|:---:|:---:|
| Consistency | ★★★★★ | ★★★★ | ★★★ |
| Component reuse | 100% | 95% | 90% |
| Dev effort | Lowest | Low | Medium |
| Mobile | Good | Best | Poor |
| Visual appeal | ★★★★ | ★★★★★ | ★★★ |

---

## Recommendation

**Variant 1 (Table)** — extends existing Configure page naturally. Uses `<Separator>` + `<Table>` + `<Badge>` — all existing components. Adds one `<Dialog>` for the Add Application form.

---

## Component Mapping

| UI Element | Existing Component | Path |
|-----------|-------------------|------|
| Section divider | `<Separator>` | `@/components/ui-kits/separator/separator` |
| Applications table | `<Table>` family | `@/components/ui-kits/table/table` |
| Status badge | `<Badge>` variant="outline" | `@/components/ui-kits/badge/badge` |
| Add button | `<Button>` variant="outline" size="sm" | `@/components/ui-kits/button/button` |
| Add dialog | `<Dialog>` + `<Form>` | existing |
| Dialog form fields | `<Input>` + `<FormField>` | existing |
| Loading | `<Skeleton>` | existing |
| Verified icon | `ShieldCheck` lucide-react | existing |
| Unverified icon | `ShieldX` lucide-react | existing |

**New components: None.** All composed from existing primitives.

---

## Assumptions
- Backend `applications` array added to `GetProjectResponseData`
- `IProject` model includes `applications: IApplication[]`
- `useGetProject` hook returns the enriched data

## Implementation Notes
- Edit `configure.tsx` — add Applications section below existing form
- Edit `project.model.ts` — add `IApplication` interface + `applications` field
- ~50 lines of JSX for the table + ~30 lines for the Add dialog
- No new files needed
- Effort: ~2 hours