# design-card.md — Multi-Application Project Configuration

## 1. Project Context

### GitHub Issue Summary
**[#206](https://github.com/SELISEdigitalplatforms/blocks-os/issues/206):** `GET /api/Project/Get` returns only the first application via flat fields (`applicationDomain`, `isDomainVerified`, `cookieDomain`). The database stores multiple applications per project in `Tenant.Applications[]`. The frontend `IProject` model and Configure page need to surface all applications and support adding new ones.

### Feature Purpose
Surface all configured applications on the existing Configure page. Display domain, verification status, and provide an "Add Application" dialog.

### Scope
- Display `applications: IApplication[]` on the Configure page
- Add Application dialog → calls existing `UpdateProject` (already appends to Applications)
- Backward compatible: existing IAM config form unchanged
- **In Scope:** Read-only display + add flow
- **Out of Scope:** Delete applications, edit applications, certificate management

---

## 2. Repository Analysis

### Pages Reviewed
| Page | Path | Relevance |
|------|------|-----------|
| Configure (IAM) | `client/app/idp/iam/modules/user-management/configure/configure.tsx` | **Target page** — where the Applications section goes |
| UserDevices | `client/app/idp/iam/modules/user-management/user-devices/user-devices.tsx` | Card > Table pattern |
| UserHistories | `client/app/idp/iam/modules/user-management/user-histories/user-histories.tsx` | Card > Table + Skeleton pattern |
| Users | `client/app/idp/iam/modules/user-management/users/users.tsx` | Card > CardHeader > CardContent > Table |
| IamManagement | `client/app/idp/iam/pages/iam-management/iam-management.tsx` | Dashboard layout |

### Existing Workflows
- **IAM Config form:** Card > CardContent > Form (react-hook-form + zod) > skeleton loading > submit with success/error toast
- **Tables:** `UsersTable` uses `@tanstack/react-table` with `useMemo` columns, `Skeleton` loading rows
- **Dialogs:** `InviteUser` demonstrates `Dialog` + `Form` pattern for data entry modals
- **URL state:** `nuqs` for filter/sort query params

### Existing Components on Configure Page
`PageBreadcrumb` `Card` `CardContent` `Form` `FormField` `FormItem` `FormLabel` `FormControl` `FormMessage` `Input` `Button` `Checkbox` `Skeleton`

### Existing Layouts
```
<main className="px-4 pt-4 md:px-6 md:pt-6">
  <PageBreadcrumb breadcrumbIndex={2} />
  <h1 className="text-2xl font-semibold">User Configuration</h1>
  <Card><CardContent>...content...</CardContent></Card>
</main>
```

---

## 3. Design System Mapping

### shadcn/ui Components Available
`Accordion` `Alert` `Badge` `Button` `Calendar` `Card` `Checkbox` `Collapsible` `Command` `Dialog` `Drawer` `DropdownMenu` `Form` `HoverCard` `Input` `InputOTP` `Label` `Pagination` `Popover` `Progress` `RadioGroup` `ScrollArea` `Select` `Separator` `Sheet` `Skeleton` `Slider` `Switch` `Table` `Tabs` `Textarea` `Toast` `Tooltip`

### lucide-react Icons Available
`Globe` `ShieldCheck` `ShieldX` `Plus` `Settings` `Edit` `Undo2` `Check` `X`

### Typography Mapping
| Role | Token |
|------|-------|
| Font | DM Sans (--font-sans) |
| Page heading | `text-2xl font-semibold` |
| Section heading | `text-lg font-semibold` |
| Form labels | `text-muted-foreground` |
| Table headers | `font-bold text-medium-emphasis` |
| Table body | `text-sm` |

### Color Tokens
| Token | Light | Dark |
|-------|-------|------|
| Background | `0 0% 100%` | `222.2 84% 4.9%` |
| Card | `0 0% 100%` | `222.2 84% 4.9%` |
| Primary | `206 100% 35%` | `202 100% 43%` |
| Border | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` |
| Success | `146 79% 44%` | same |
| Destructive | `0 84.2% 60.2%` | `0 62.8% 30.6%` |
| Muted Fg | `215.4 16.3% 46.9%` | `215 20.2% 65.1%` |

### Spacing
`px-4 pt-4 md:px-6 md:pt-6` (page), `gap-6` (cards), `gap-2` (inline)

### Radius
`0.5rem` (= `rounded-lg`)

---

## 4. Pattern Discovery

### What Patterns Exist
- **Card > Content:** Every data section uses `<Card><CardContent>...</CardContent></Card>`
- **Form pattern:** `react-hook-form` + `zodResolver` + `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage`
- **Dialog pattern:** `Dialog` + `DialogContent` + `DialogHeader` + `DialogTitle` with `Form` inside
- **Toast pattern:** `showSuccessToast({ description })` / `showErrorToast({ errors })`
- **Skeleton pattern:** `<Skeleton className="h-5 w-1/2"/><Skeleton className="mt-2 h-10 w-full"/>` in grid

### What is Reused
- `Separator` for section division (used in settings pages)
- `Badge` for status display (used in Users table for active/inactive)
- `Table` for read-only data (used in UserHistories)
- `Dialog` + `Form` for data entry (used in InviteUser)

### What is Extended
- Configure page gets a second data section below the form
- `IProject` model gets `applications: IApplication[]`

### What is Avoided
- New page/route (stay on existing Configure page)
- New reusable component (compose from primitives)
- Inline table editing (complex, out of scope)

---

## 5. UI Variants

---

### Variant 1: Conservative Evolution (Table Section)

Add a `<Separator>` + section heading + `<Card>` with `<Table>` below the existing form.

```
┌──────────────────────────────────────────────────────┐
│  ← IAM / Configure                                    │
│                                                       │
│  User Configuration                                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │ [Account activation url]  [Account verif...]     │ │
│  │ [Recovery account URL]    [Activation lifetime]   │ │
│  │ [Recovery lifetime]       [☐ Logout on pw change] │ │
│  │                                [Reset] [Change]   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ─────────────────────────────────────────────────── │
│                                                       │
│  Applications                              [+ Add]    │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Domain                         │ Status          │ │
│  ├────────────────────────────────┼─────────────────┤ │
│  │ https://dbaosi.dev.blocksd...  │ 🛡 Verified     │ │
│  │ https://dev-construct.selis... │ 🛡 Verified     │ │
│  │ https://dev-api.selisebloc...  │ 🛡 Verified     │ │
│  └──────────────────────────────────────────────────┘ │
│  Showing 3 applications                               │
└──────────────────────────────────────────────────────┘
```

**UX Rationale:** Natural extension of the existing page. Users scrolling past the IAM form discover the Applications section. The table format matches `UserHistories` and `UserDevices` patterns.

**Component Mapping:**
| Element | Component | Source |
|---------|-----------|--------|
| Section divider | `<Separator>` | shadcn/ui |
| Section heading | `<h2>` + `<Button>` | inline + shadcn/ui |
| Applications card | `<Card>` + `<CardContent>` | shadcn/ui |
| Table | `<Table>` + `<TableHeader>` + `<TableBody>` + `<TableRow>` + `<TableHead>` + `<TableCell>` | shadcn/ui |
| Status badge (verified) | `<Badge>` variant="outline" + `ShieldCheck` icon + `text-success` | shadcn/ui |
| Status badge (unverified) | `<Badge>` variant="outline" + `ShieldX` icon + `text-destructive` | shadcn/ui |
| Domain text | `<span>` truncate + monospace | inline Tailwind |
| Add button | `<Button>` variant="outline" size="sm" + `Plus` icon | shadcn/ui |
| Add dialog | `<Dialog>` + `<DialogContent>` + `<DialogHeader>` + `<DialogTitle>` | shadcn/ui |
| Dialog form | `<Form>` + `<FormField>` + `<FormItem>` + `<FormLabel>` + `<FormControl>` + `<Input>` | shadcn/ui |
| Loading | `<Skeleton>` rows | shadcn/ui |

**Pros:** 100% component reuse, matches existing patterns, lowest dev effort
**Cons:** Scrolling required on long forms

---

### Variant 2: Enhanced Existing (Tabs Layout)

Split Configure page into two tabs: "IAM Settings" and "Applications".

```
┌──────────────────────────────────────────────────────┐
│  ← IAM / Configure                                    │
│                                                       │
│  [IAM Settings]  [Applications]                       │
│  ─────────────────────────────────────────────────── │
│                                                       │
│  Applications                              [+ Add]    │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Domain                         │ Status │ Cookie │ │
│  ├────────────────────────────────┼────────┼────────┤ │
│  │ dbaosi.dev.blocksdevelopers... │ ✓      │ blocks │ │
│  │ dev-construct.seliseblocks.com │ ✓      │ blocks │ │
│  │ dev-api.seliseblocks.com       │ ✓      │ blocks │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  Applications: 3 of 10 max                            │
└──────────────────────────────────────────────────────┘
```

**UX Rationale:** Separates concerns — IAM settings and application management are distinct. Tabs keep the page organized as features grow.

**Component Mapping:** Same as V1, plus `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>`.

**Pros:** Scalable (room for more sections), organized, no scrolling past forms
**Cons:** Slightly more complex, hides IAM form by default on Applications tab

---

### Variant 3: Premium (Sidebar Layout)

Persistent sidebar with navigation + main content area.

```
┌────────────┬─────────────────────────────────────────┐
│ Configure   │                                         │
│             │  Applications                [+ Add]    │
│ ◉ Settings  │  ┌────────────────────────────────────┐ │
│   General   │  │ Domain                │ Status      │ │
│ ○ Apps      │  ├───────────────────────┼─────────────┤ │
│             │  │ dbaosi.dev.blocks... │ 🛡 Verified │ │
│             │  │ dev-construct.selis..│ 🛡 Verified │ │
│             │  │ dev-api.selisebloc.. │ 🛡 Verified │ │
│             │  └────────────────────────────────────┘ │
│             │                                         │
│             │  + Add Application                      │
└─────────────┴─────────────────────────────────────────┘
```

**UX Rationale:** Premium enterprise feel. Sidebar provides persistent navigation as Configure grows more sections. Inspired by Vercel dashboard.

**Component Mapping:** Same as V1, plus custom sidebar using `<div>` + `<Button>` variant="ghost" for nav items.

**Pros:** Premium feel, scalable, persistent navigation
**Cons:** Higher dev effort (sidebar component), overkill for current 2 sections, more horizontal space

---

## 6. Responsive Design

### Variant 1 (Recommended)

**Desktop (≥1024px):**
```
[padding] [breadcrumb] [heading]
[IAM Config Card - 2 column grid]
[Separator]
[Section heading + Add btn]
[Applications Card - Table]
```

**Tablet (640-1023px):**
```
[padding] [breadcrumb] [heading]
[IAM Config Card - 1 column]
[Separator]
[Section heading + Add btn]
[Applications Card - Table with truncated domain]
```
Domain text: `truncate max-w-[200px]` + full domain in `Tooltip` on hover.

**Mobile (<640px):**
```
[padding] [breadcrumb] [heading]
[IAM Config Card - 1 column]
[Separator]
[Section heading + Add btn]
[Applications - Card stack]
Each application becomes:
┌──────────────────────────┐
│ https://dbaosi.dev...    │
│ 🛡 Verified              │
│ Cookie: blocksdevelop... │
└──────────────────────────┘
```

Table → card list at mobile. Each row becomes a `<Card>` with domain, status badge, and cookie domain.

### Variant 2

**Desktop:** Tabs + table (same as V1 desktop)
**Tablet:** Tabs + truncated table (same as V1 tablet)
**Mobile:** Tabs (scrollable) + card stack (same as V1 mobile)

### Variant 3

**Desktop:** Sidebar + table
**Tablet:** Sidebar collapses to top nav bar, table truncates
**Mobile:** Sidebar → `<Sheet>` drawer, table → card stack

---

## 7. UX Flows

### View Applications
```
User clicks "Configure" on dashboard
  → Navigate to Configure page
  → Page loads with IAM config form
  → Scroll past form (V1) / Click "Applications" tab (V2) / Click sidebar "Apps" (V3)
  → See Applications table with all domains
  → Each row shows: domain URL, verified badge, cookie domain
```

### Add Application
```
User clicks "+ Add Application"
  → Dialog opens with form:
      Domain URL input (required)
      Cookie Domain (auto-detected, read-only)
  → User enters domain (e.g., "https://dev-new.example.com")
  → Clicks "Add"
  → Calls POST /api/Project/UpdateProject with applicationDomain
  → Backend appends to Applications array (existing logic)
  → On success: dialog closes, table refreshes, toast "Application added"
  → On error: toast with error, dialog stays open
```

---

## 8. States

### Loading
```
┌──────────────────────────────────────┐
│ Applications                         │
│ ┌──────────────────────────────────┐ │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
Uses same skeleton pattern as IAM form loading:
```tsx
<div className="flex flex-col gap-3">
  {[1, 1, 1].map((_, i) => (
    <div key={i} className="flex gap-4">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-24" />
    </div>
  ))}
</div>
```

### Empty
```
┌──────────────────────────────────────┐
│ Applications              [+ Add]    │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │   [Globe icon]                   │ │
│ │   No applications configured     │ │
│ │   Add an application domain to   │ │
│ │   get started.                   │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Error
Dialog submit fails → `showErrorToast({ errors })` with backend error message. Dialog stays open for retry.

### Success
Dialog submit succeeds → `showSuccessToast({ description: "Application added successfully" })`. Query invalidation refreshes table.

### Validation
- Domain input required (`zod.string().min(1)`)
- Domain format validation (must start with `https://`)
- Backend validates duplicate domains

---

## 9. Component Mapping (Variant 1 — Recommended)

| UI Element | Existing Component | Path | New? |
|-----------|-------------------|------|------|
| Section divider | `<Separator>` | `@/components/ui-kits/separator/separator` | No |
| Section heading row | `<div>` + `<h3>` + `<Button>` | inline | No |
| Applications card | `<Card>` + `<CardContent>` | `@/components/ui-kits/card/card` | No |
| Table | `<Table>` family | `@/components/ui-kits/table/table` | No |
| Verified badge | `<Badge>` variant="outline" + `<ShieldCheck>` | existing | No |
| Unverified badge | `<Badge>` variant="destructive" + `<ShieldX>` | existing | No |
| Domain text | `<span className="truncate font-mono text-sm">` | inline Tailwind | No |
| Add button | `<Button>` variant="outline" size="sm" | `@/components/ui-kits/button/button` | No |
| Add icon | `<Plus>` | lucide-react | No |
| Add dialog | `<Dialog>` + `<DialogContent>` + `<DialogHeader>` + `<DialogTitle>` | `@/components/ui-kits/dialog/dialog` | No |
| Dialog form | `<Form>` + `<FormField>` + `<FormItem>` + `<FormLabel>` + `<FormControl>` + `<Input>` | existing | No |
| Loading skeleton | `<Skeleton>` | `@/components/ui-kits/skeleton/skeleton` | No |
| Error toast | `showErrorToast` | `@/hooks/use-toast` | No |
| Success toast | `showSuccessToast` | `@/hooks/use-toast` | No |

**New components: ZERO.** Everything composed from existing primitives.

---

## 10. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Table semantics | `<thead>`, `<tbody>`, `<th scope="col">` |
| Keyboard nav | Tab through table rows, Enter to expand (future), Tab to Add button |
| Dialog focus | `Dialog` traps focus automatically, closes on Escape |
| Icon buttons | `aria-label="Add application"` on `+` button |
| Screen reader | Status badges have text labels (not icon-only) |
| Color contrast | `text-success` + `text-destructive` meet WCAG AA on both light/dark |
| Toast | `aria-live="polite"` via Toast component |
| Focus ring | Visible on all interactive elements (Tailwind `ring` token) |

---

## 11. Comparison Matrix

| Dimension | V1: Table Section | V2: Tabs | V3: Sidebar |
|-----------|:---:|:---:|:---:|
| Consistency with existing | ★★★★★ | ★★★★ | ★★★ |
| Component reuse | 100% | 95% | 90% |
| Development effort | **~2 hours** | ~3 hours | ~5 hours |
| Files to modify | 2 | 2 | 3+ |
| UX quality | ★★★★ | ★★★★ | ★★★★★ |
| Scalability (more sections) | ★★★ | ★★★★ | ★★★★★ |
| Mobile readiness | ★★★★ | ★★★★ | ★★★★ |
| Accessibility | ★★★★★ | ★★★★★ | ★★★★ |
| Visual appeal | ★★★★ | ★★★★ | ★★★★★ |

---

## 12. Final Recommendation

**Variant 1: Conservative Evolution (Table Section).**

**Why:**
1. **100% component reuse** — every element maps to an existing shadcn/ui or project component
2. **Natural extension** — adds a second Card below the existing IAM form Card, separated by `<Separator>`
3. **Matches existing patterns** — `UserHistories` and `UserDevices` both use Card > CardContent > Table
4. **Lowest effort** — ~2 hours, modify 2 files (configure.tsx + project.model.ts), zero new files
5. **Smallest risk** — doesn't restructure existing IAM form, purely additive
6. **Future path** — if more Configure sections are added later, V2 (Tabs) or V3 (Sidebar) can be incrementally adopted

**Trade-off:** Requires scrolling past the IAM form on long pages. Mitigated by placing Applications section immediately after the form (no dead space).

---

## 13. Implementation Notes

### Files to Modify
1. **`client/app/models/project.model.ts`** — Add `IApplication` interface + `applications: IApplication[]` to `IProject`
2. **`client/app/idp/iam/modules/user-management/configure/configure.tsx`** — Add Applications section below existing form Card

### Implementation Approach
```tsx
// After the existing IAM config Card, add:

<Separator className="my-6" />

<div className="flex items-center justify-between mb-4">
  <h3 className="text-lg font-semibold">Applications</h3>
  <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
    <Plus className="mr-2 h-4 w-4" /> Add
  </Button>
</div>

<Card>
  <CardContent className="pt-6">
    {isLoading ? (
      <LoadingSkeleton />
    ) : applications.length === 0 ? (
      <EmptyState />
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Cookie Domain</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.domain}>
              <TableCell className="font-mono text-sm truncate max-w-[300px]">
                {app.domain}
              </TableCell>
              <TableCell>
                <Badge variant={app.isDomainVerified ? "outline" : "destructive"}>
                  {app.isDomainVerified ? (
                    <ShieldCheck className="mr-1 h-3 w-3 text-success" />
                  ) : (
                    <ShieldX className="mr-1 h-3 w-3 text-destructive" />
                  )}
                  {app.isDomainVerified ? "Verified" : "Unverified"}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {app.cookieDomain}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </CardContent>
</Card>
```

### Dialog Implementation
```tsx
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add Application</DialogTitle>
    </DialogHeader>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField name="domain" render={({ field }) => (
          <FormItem>
            <FormLabel>Domain URL</FormLabel>
            <FormControl>
              <Input placeholder="https://dev-new.example.com" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add"}</Button>
        </div>
      </form>
    </Form>
  </DialogContent>
</Dialog>
```

### Data Hook
Use existing `useGetProject` hook — already fetches project data. After backend enhancement, `data.applications` will be populated.

### Mutation
Use existing `useUpdateProject` mutation, passing `{ projectKey: tenantId, applicationDomain: newDomain }`. Backend already handles appending to Applications at line 435.

---

## 14. Open Questions

| Question | Assumption |
|----------|-----------|
| Delete applications? | Out of scope for v1. Backend doesn't expose delete for individual apps. |
| Edit application domain? | Out of scope. v1 is read-only display + add only. |
| Max applications limit? | No known limit. Table handles scrolling if many. |
| Cookie domain editable? | Backend auto-detects from domain. Read-only in dialog. |
| Permission required? | Same as UpdateProject — already authorized. |

---

## 15. Progress Tracker

- [x] Repository analysis (Configure page, project model, hooks, patterns)
- [x] Design system mapping (all available components, tokens, icons)
- [x] Pattern discovery (Card > Table, Form + Dialog, Skeleton, Toast)
- [x] 3 UI variants designed with layouts
- [x] Responsive strategy (desktop/tablet/mobile for all variants)
- [x] States documented (loading, empty, error, success, validation)
- [x] Component mapping (100% reuse — zero new components)
- [x] Accessibility requirements
- [x] Comparison matrix
- [x] Recommendation (Variant 1)
- [x] Implementation notes with code snippets
- [ ] Stakeholder review
- [ ] Implementation