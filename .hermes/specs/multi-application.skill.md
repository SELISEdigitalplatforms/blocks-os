# skill.md — AI Implementation Guide: Multi-Application Project Configuration

## Project Context

**Feature:** Multi-Application Project Configuration
**Issue:** [#206](https://github.com/SELISEdigitalplatforms/blocks-os/issues/206)
**Design Card:** `.hermes/specs/multi-application.design-card.md`
**Design Spec:** `.hermes/specs/multi-application.design.md`

### What to build
Add an Applications management section to the existing Configure page at `client/app/idp/iam/modules/user-management/configure/configure.tsx`. Display all `project.applications` in a table, add an "Add Application" dialog.

### Related pages (study first)
- `client/app/idp/iam/modules/user-management/configure/configure.tsx` — target page
- `client/app/models/project.model.ts` — model to update
- `client/app/hooks/use-project.ts` — data hook
- `client/app/idp/iam/modules/user-management/user-devices/user-devices.tsx` — similar Card > Table pattern

### Existing patterns (MUST follow)
- Card > CardContent > content (used on Configure page)
- `<Skeleton className="h-5 w-1/2"/>` + `<Skeleton className="mt-2 h-10 w-full"/>` for loading
- `Separator` for section division
- `showSuccessToast` / `showErrorToast` for feedback

---

## Design Principles

1. **Extend existing page.** Add section below IAM form; don't restructure.
2. **Reuse before creating.** All components exist — just compose them.
3. **Match form patterns.** Follow the existing `FormField` + `FormItem` structure in the Add dialog.

---

## Component Rules

### ✅ Use for Applications Section
- `Card` + `CardContent` from `@/components/ui-kits/card/card`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui-kits/table/table`
- `Badge` from `@/components/ui-kits/badge/badge`
- `Button` from `@/components/ui-kits/button/button`
- `Separator` from `@/components/ui-kits/separator/separator`
- `Skeleton` from `@/components/ui-kits/skeleton/skeleton`

### ✅ Use for Add Dialog
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from `@/components/ui-kits/dialog/dialog`
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from `@/components/ui-kits/form/form`
- `Input` from `@/components/ui-kits/input/input`

### ❌ Never
- Raw HTML tables (use shadcn/ui `Table`)
- Inline styles with colors (use Tailwind tokens)
- Custom dialog (use `Dialog`)

---

## Icon Rules

### ✅ Use
- `Globe` — section icon
- `ShieldCheck` — verified status
- `ShieldX` — unverified status
- `Plus` — add button

---

## Styling Rules

### ✅ Always
- `text-muted-foreground` for section headings
- `font-bold text-medium-emphasis` for table headers
- `text-sm` for table body
- `rounded-lg` for cards
- `gap-6` for section spacing

---

## Responsive Rules

- **Desktop:** Table with full domain text
- **Tablet:** `md:truncate` on domain cells
- **Mobile:** Stack cards vertically

---

## Accessibility Rules

- `<th scope="col">` on table headers
- `Dialog` traps focus automatically
- `aria-label="Add application"` on icon-only button
- Toast announces success/failure via `aria-live`

---

## Implementation Checklist

- [ ] Added `IApplication` interface to `project.model.ts`
- [ ] Added `applications: IApplication[]` to `IProject`
- [ ] Added Applications section to `configure.tsx` below existing form
- [ ] Separator between IAM form and Applications section
- [ ] Table renders all `project.applications`
- [ ] Empty state when array is empty/null
- [ ] Loading skeleton when `isLoading`
- [ ] Add Application dialog with domain input
- [ ] Dialog submits via `useUpdateProject` mutation
- [ ] Success toast on add
- [ ] Error toast on failure
- [ ] Light mode renders correctly
- [ ] Dark mode renders correctly
- [ ] Responsive at tablet and mobile
- [ ] No new components created
- [ ] No new packages added