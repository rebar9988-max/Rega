# Admin dashboard: audit logs and notifications (next milestone)

Status 2026-10-30: **wired** (branch `claude/business-profile-social-links`). `/dr/audit` uses the filters; the
dashboard layout shows the notification bell in a slim top bar for roles that handle at least one queue (SUPER_ADMIN,
ADMIN, MANAGER with `business.publish` / `review.moderate`; never EMPLOYEE or BUSINESS_OWNER). No new table.
Accent colour is the REGA red (`brand`, `brand-soft`, `brand-text`); no new colours.

## What already exists (verified in code)

- `AuditLog` table (PostgreSQL and production D1), written by `writeAudit` in [src/lib/audit.ts](../src/lib/audit.ts).
- `/dr/audit` page ([src/app/dr/audit/page.tsx](../src/app/dr/audit/page.tsx)): newest first, 30 per page, `audit.read`.
- Work queues that notifications can be derived from: `Business.status = "pending"`, `Review.status = "pending"`,
  `Report.status = "open"`, `ContactMessage.status = "new"`.

## Building blocks

| File | Purpose |
| --- | --- |
| [src/features/admin-audit/filters.ts](../src/features/admin-audit/filters.ts) | Pure URL → filter parsing (action, entity, actor, page), Prisma `where`, pagination links |
| [src/features/admin-audit/AuditLogTable.tsx](../src/features/admin-audit/AuditLogTable.tsx) | Presentational table (same columns as today, action as a red-tinted pill) |
| [src/features/admin-audit/AuditFilters.tsx](../src/features/admin-audit/AuditFilters.tsx) | GET filter form (works without JavaScript) |
| [src/features/admin-notifications/build.ts](../src/features/admin-notifications/build.ts) | Pure: kinds, per-kind permission (same as the handling page), order, badge text |
| [src/features/admin-notifications/sources.ts](../src/features/admin-notifications/sources.ts) | Server-only read-only counts, only for the kinds the role may see |
| [src/features/admin-notifications/NotificationBell.tsx](../src/features/admin-notifications/NotificationBell.tsx) | Bell with red count badge and list; Escape/outside click closes |
| [tests/admin-scaffold.test.ts](../tests/admin-scaffold.test.ts) | Unit tests for the pure parts |

## Wiring

- [src/app/dr/audit/page.tsx](../src/app/dr/audit/page.tsx): `parseAuditFilters` → `auditWhere` for count and rows;
  pagination links keep the filters (`auditHref`). Exact match on action/entity, substring on the actor e-mail.
- [src/app/dr/layout.tsx](../src/app/dr/layout.tsx): `getAdminNotifications(role)` (up to four `count()` queries per
  dashboard page); labels `dashboard.notif_*` are rendered on the server. A failed count is logged
  (`dr.notifications.failed`) and shows an empty bell; the dashboard itself never fails because of it.
- Texts: `dashboard.notifications`, `notificationsEmpty`, `notif_*`, `filterActor`, `filterApply`, `filterReset` in all
  11 catalogues. Browser test: [tests/e2e/admin-audit-notifications.spec.ts](../tests/e2e/admin-audit-notifications.spec.ts).

## Later (needs owner approval)

1. An index on `AuditLog(action, createdAt)` only if filtered queries become slow (a migration).
2. Persistent notifications (read/unread, per user, e-mail): needs a new `Notification` table in PostgreSQL **and**
   D1. Do not add it before the owner approves the schema; production D1 migrations are applied manually
   (`npm run db:d1:migrate`) before the deploy that reads them.
