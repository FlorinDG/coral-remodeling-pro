# EMP-PROFILE-1 Report

### 0 · Header
```
Item:            EMP-PROFILE-1
Directive:       CODER-QUEUE.md §8 (Employee profile into the database)
Start SHA:       80b095589c3757dbbfdd35e7dfd1efca4ff7d5c5
End SHA:         b3b605c889f899e6918fe7c0e527027d7301c271
Branch:          develop
Date:            2026-10-09
```

### 1 · Outcome
DONE — Extended employee profile (`department`, `employmentType`, `address`, `birthDate`, `notes`) migrated from browser `localStorage` into the database:
- `prisma/schema.prisma`: additive fields added to `model Employee` (`department String?`, `employmentType String?`, `address String?`, `birthDate String?` for YYYY-MM-DD calendar dates, `notes String?`).
- `prisma/migrations/20261009090000_employee_profile_fields/migration.sql`: additive migration created (`ALTER TABLE "Employee" ADD COLUMN ...`).
- Generated Prisma types via `npx prisma generate`. Per pd.md 5e & CODER-QUEUE.md §8: **NO database migration was applied by the coder**.
- `src/app/api/tenant/employees/route.ts`: GET queries and selects extended fields; POST persists them to `Employee`.
- `src/app/api/tenant/employees/[employeeId]/route.ts`: PUT updates extended fields on `Employee`.
- `src/app/[locale]/admin/hr/employees/page.tsx`: dropped `loadProfile`, `saveProfile`, and `emp-profile-*` localStorage references; profile view and edit modal read and write directly through API.
- `tests/employee-profile.test.ts`: 7/7 tests passing including 3 verified throw proofs.

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `b3b605c8` | feat(hr): EMP-PROFILE-1 - persist employee profile into database | 6 | +322/−44 |

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| 1 | Additive migration on `Employee` (`department`, `employmentType`, `address`, `birthDate`, `notes`) | ✅ | `prisma/schema.prisma:653-657`, `prisma/migrations/20261009090000_employee_profile_fields/migration.sql` |
| 2 | `birthDate` format is calendar string `YYYY-MM-DD` (not DateTime) | ✅ | `prisma/schema.prisma:656`, `tests/employee-profile.test.ts:31-54` |
| 3 | `/api/tenant/employees` reads and writes the 5 fields | ✅ | `src/app/api/tenant/employees/route.ts:57-81,150-184` |
| 4 | `/api/tenant/employees/[employeeId]` updates the 5 fields | ✅ | `src/app/api/tenant/employees/[employeeId]/route.ts:97-130` |
| 5 | `employees/page.tsx` drops `loadProfile` / `saveProfile` localStorage | ✅ | `src/app/[locale]/admin/hr/employees/page.tsx:18-35,182-240`, `tests/employee-profile.test.ts:213-222` |
| 6 | Unit tests & throw proofs passing | ✅ | `tests/employee-profile.test.ts` (7/7 tests, 3 throw proofs) |
| 7 | STOP — Florin runs the migration and pushes the range himself | 🛑 | Standing rule pd.md 5e |

### 4 · Files vs blast radius
```
 prisma/migrations/20261009090000_employee_profile_fields/migration.sql |  7 ++++++
 prisma/schema.prisma                                                   |  5 ++++
 src/app/[locale]/admin/hr/employees/page.tsx                           | 66 +++++++++++++++++++---------------------------------
 src/app/api/tenant/employees/[employeeId]/route.ts                     | 20 ++++++++++++++--
 src/app/api/tenant/employees/route.ts                                  | 32 +++++++++++++++++++++++--
 tests/employee-profile.test.ts                                         | 235 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 6 files changed, 287 insertions(+), 78 deletions(-)
```

| File | In blast radius? |
|---|---|
| `prisma/schema.prisma` | Yes (schema change) |
| `prisma/migrations/20261009090000_employee_profile_fields/migration.sql` | Yes (migration SQL file) |
| `src/app/api/tenant/employees/route.ts` | Yes (API read/write) |
| `src/app/api/tenant/employees/[employeeId]/route.ts` | Yes (API update) |
| `src/app/[locale]/admin/hr/employees/page.tsx` | Yes (UI drop localStorage) |
| `tests/employee-profile.test.ts` | Yes (new tests & throw proofs) |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/app/[locale]/admin/hr/employees/page.tsx:276` | Exposing birthDate input in UI modal | 1. Leave uneditable in modal since form lacked it previously. 2. Add date input in Personal Info. | Option 2: Add date input in Personal Info section. | Without the input, users cannot enter or edit birth dates. |
| `tests/employee-profile.test.ts:31` | Calendar date validator | 1. Validate only length. 2. Validate strict YYYY-MM-DD calendar date rejecting ISO datetime / timezones. | Option 2: Strict YYYY-MM-DD validator with throw proof. | Guards against timezone offset bugs and ISO timestamp pollution. |

### 6 · Verification — commands, not descriptions

### VERIFY: npm run test:compile
```
$ npm run test:compile; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```

### VERIFY: npm run test:lint
```
$ npm run test:lint; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:lint
> eslint src

exit: 0
```

### VERIFY: tests/employee-profile.test.ts
```
$ node --import ./tests/register.mjs --test tests/employee-profile.test.ts; echo "exit: $?"
✔ EMP-PROFILE-1: validateCalendarBirthDate validates YYYY-MM-DD calendar date strings (0.743208ms)
✔ EMP-PROFILE-1 THROW PROOF 1: validateCalendarBirthDate throws on ISO timestamp or invalid date format (0.105583ms)
✔ EMP-PROFILE-1: mapEmployeeResponse includes all 5 profile fields with correct defaults (0.151ms)
✔ EMP-PROFILE-1: Prisma schema and migration define all 5 additive fields on Employee (1.553417ms)
✔ EMP-PROFILE-1 THROW PROOF 2: Schema check throws if a required profile field is missing (0.254375ms)
✔ EMP-PROFILE-1: Employees page does not use localStorage for profiles (0.720459ms)
✔ EMP-PROFILE-1 THROW PROOF 3: Storage audit throws if localStorage is reintroduced (0.077916ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 110.203708
exit: 0
```
