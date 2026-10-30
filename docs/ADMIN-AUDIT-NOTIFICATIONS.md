# Admin dashboard: audit logs and notifications (next milestone)

Status 2026-10-30: **scaffold only**. Nothing below is wired into a page yet; live behaviour is unchanged.
Accent colour is the REGA red (`brand`, `brand-soft`, `brand-text`); no new colours.

## What already exists (verified in code)

- `AuditLog` table (PostgreSQL and production D1), written by `writeAudit` in [src/lib/audit.ts](../src/lib/audit.ts).
- `/dr/audit` page ([src/app/dr/audit/page.tsx](../src/app/dr/audit/page.tsx)): newest first, 30 per page, `audit.read`.
- Work queues that notifications can be derived from: `Business.status = "pending"`, `Review.status = "pending"`,
  `Report.status = "open"`, `ContactMessage.status = "new"`.

## Scaffold added

| File | Purpose |
| --- | --- |
| [src/features/admin-audit/filters.ts](../src/features/admin-audit/filters.ts) | Pure URL → filter parsing (action, entity, actor, page), Prisma `where`, pagination links |
| [src/features/admin-audit/AuditLogTable.tsx](../src/features/admin-audit/AuditLogTable.tsx) | Presentational table (same columns as today, action as a red-tinted pill) |
| [src/features/admin-audit/AuditFilters.tsx](../src/features/admin-audit/AuditFilters.tsx) | GET filter form (works without JavaScript) |
| [src/features/admin-notifications/build.ts](../src/features/admin-notifications/build.ts) | Pure: kinds, per-kind permission (same as the handling page), order, badge text |
| [src/features/admin-notifications/sources.ts](../src/features/admin-notifications/sources.ts) | Server-only read-only counts, only for the kinds the role may see |
| [src/features/admin-notifications/NotificationBell.tsx](../src/features/admin-notifications/NotificationBell.tsx) | Bell with red count badge and list; Escape/outside click closes |
| [tests/admin-scaffold.test.ts](../tests/admin-scaffold.test.ts) | Unit tests for the pure parts |

## Next steps (each needs its own verification)

1. `/dr/audit`: use `parseAuditFilters` + `auditWhere` + `AuditLogTable` + `AuditFilters`; add filter labels
   (`dashboard.filterApply`, `dashboard.filterReset`, …) to all 11 catalogues. Consider an index on
   `AuditLog(action, createdAt)` only if the filtered queries are slow (that is a migration: owner approval).
2. Notifications: render `NotificationBell` in the dashboard header (layout change: owner approval), labels in all
   catalogues, `getAdminNotifications(role)` in the dashboard layout. Counts are cheap `count()` queries.
3. Persistent notifications (read/unread, per user, e-mail): needs a new `Notification` table in PostgreSQL **and**
   D1. Do not add it before the owner approves the schema; production D1 migrations are applied manually
   (`npm run db:d1:migrate`) before the deploy that reads them.
