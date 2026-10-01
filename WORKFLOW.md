# ERPNext Scrum - Workflow

How the `erpnext_scrum` app works end to end: who uses it, what happens at each step, which API runs, and what gets written to ERPNext.

App: `erpnext_scrum` v0.0.1, publisher FaircodeNext Private Limited, module `ERPNext Scrum`. Depends on Frappe, ERPNext (Employee, Project, Task, Timesheet) and HRMS (Leave Application).

---

## 1. What the app does

A Scrum Master runs a daily stand-up per department. For each active employee they record today's task(s), see yesterday's task and timesheet hours, and chase people who are missing updates, timesheets, or leave applications by email. Managers get a date-range dashboard and a per-project analytics view, both exportable to PDF and emailable.

## 2. Architecture

```
Browser (React SPA, HashRouter)
  /daily_scrum  or  /scrum_master      <- Frappe www pages that load the SPA bundle
      |
      |  fetch / axios, header "Authorization: token key:secret"
      v
erpnext_scrum.erpnext_scrum.api.*      <- all whitelisted methods (single file)
      |
      v
Daily Scrum (+ Scrum Task Entry rows), Scrum Config
Employee, Department, Project, Task, Task Type, ToDo, Timesheet, Leave Application, User, Email Account
```

| Layer | Location |
|---|---|
| DocTypes | `erpnext_scrum/erpnext_scrum/doctype/` |
| API (live) | `erpnext_scrum/erpnext_scrum/api.py` |
| Desk hook | `erpnext_scrum/public/js/task.js` (wired via `doctype_js` in `hooks.py`) |
| Web entry pages | `erpnext_scrum/www/daily_scrum.html`, `erpnext_scrum/www/scrum_master.html` |
| SPA source | `frontend/src/` (React 19, Vite 8, Tailwind 4, jsPDF) |
| SPA build output | `erpnext_scrum/public/frontend/` (committed, served at `/assets/erpnext_scrum/frontend/`) |

## 3. Data model

### Daily Scrum (submittable)
- Name: `{team}-{date}` (set in `autoname`), so one scrum per department per day.
- Fields: `date` (default Today), `scrum_master` (Employee, required), `team` (Department), `status` (Draft / Submitted / Closed), `scrum_open_time`, `scrum_close_time`, `notes`, `submission_time`, `tasks` (child table, editable after submit).

### Scrum Task Entry (child of Daily Scrum)
- One row per employee per task. An employee can have several rows.
- Fields: `employee`, `employee_name` (fetched), `task` (Link Task), `task_title` (required), `project`, `task_type`, `dependencies` (No/Yes), `yesterday_task`, `yesterday_hours`, `timesheet_status` (Filled / Missing / On Leave), `is_new_task`, `expected_hours`.
- Almost every field is `allow_on_submit`, so rows can be edited after the scrum is submitted.

### Scrum Config (single)
- `enabled_departments` (Table MultiSelect of Scrum Config Department) - drives the department dropdown on the board. Empty means all non-group departments.
- `scrum_start_time` 09:30, `scrum_end_time` 10:30, `grace_period_minutes` 60, `eod_reminder_time` 17:00, `escalation_time` 18:30, `cc_project_managers` 1.
- Only `enabled_departments` is read by code. The time and CC fields are not used anywhere (no scheduler is configured).

## 4. Login and access

1. User opens `/daily_scrum` (or `/scrum_master`). The www page loads the built bundle; in developer mode `/daily_scrum` loads from the Vite dev server at `127.0.0.1:8080` instead.
2. No token in `localStorage` -> Login screen.
3. Login posts to `/api/method/login` (session cookie), then calls `get_my_api_keys`.
4. `get_my_api_keys` creates an `api_key` if missing and **generates a new `api_secret` every time**, then returns both.
5. SPA stores `key:secret` in `localStorage.frappe_token` and sends it as `Authorization: token ...` on every request.
6. Any 401 clears the token and reloads to the login screen.

Every API method is `allow_guest=True` but throws `PermissionError` for Guest, so in practice any logged-in user can call all of them. Most methods use `ignore_permissions`, so ERPNext role permissions do not restrict who can read or edit scrums.

Home (`#/`) has three tiles: Daily Scrum, Admin Dashboard, Project Analytics.

## 5. Daily Scrum flow (`#/scrum`)

```
Open board -> pick date + department
   |
   v
get_scrum_data ---- no scrum yet ----> read-only grid + [Start Scrum]
   |                                         |
   | scrum exists                            v
   |                                    start_scrum  (creates Draft)
   v                                         |
Editable grid (auto-save per row, 1s debounce) <-+
   |
   |  remind: missing updates / timesheets / leave
   v
[Submit Scrum] -> optional bulk reminder -> flush pending saves -> submit_scrum
   |
   v
Submitted (docstatus 1). Rows still editable and auto-saved.
```

### 5.1 Load - `get_scrum_data(date, department)`
- Departments: from Scrum Config, else all leaf departments. First one is auto-selected.
- Finds an existing non-cancelled Daily Scrum for that date + team.
- For each active employee in the department it computes:
  - **Previous working day**: walk back from `date` skipping holidays from the employee's Holiday List; if no list, skip Sat/Sun.
  - **Leave today**: any Leave Application with docstatus < 2 covering `date` (includes drafts and pending). Leave type `Work From Home` marks WFH, anything else marks On Leave.
  - **Yesterday's task**: latest Scrum Task Entry for that employee on the previous working day.
  - **Yesterday's hours**: sum of submitted Timesheet `total_hours` where `start_date` = previous working day.
  - **Today's rows**: saved rows from the current scrum, else one blank row (type Development, timesheet status Filled if hours > 0 else Missing).
- Scrum Master name: the scrum's `scrum_master`, else the logged-in user's Employee name.

### 5.2 Start - `start_scrum(date, department)`
- Logged-in user must be linked to an Employee (`user_id`), else it throws.
- Returns the existing scrum if one exists; otherwise inserts a Draft with the user as `scrum_master`.
- Until a scrum exists the grid is read-only.

### 5.3 Fill rows
Per employee the board shows: today's task(s), yesterday's task + project, yesterday's hours, project, add-row button.

Ways to set a row:
- **Pick an existing task** (autocomplete -> `get_employee_tasks`). Default search: open tasks assigned to the employee (`_assign`, owner, or open ToDo). Toggle to search all tasks, or filter by project. Max 100 results.
- **Create a task** (+ button -> Quick Create modal -> `quick_create_task`). Requires subject, project, start date, end date, expected time. Creates an Open Task, sets owner to the employee's user, and assigns it to them.
- **No task today** (ban icon): saves a row with title `[No Task Today]`, type Other.
- **Clear / remove** (x): calls `remove_scrum_entry` with the saved row name.

Typing free text without selecting a task or using Quick Create saves nothing, despite the "Search or type task" placeholder.

### 5.4 Auto-save - `save_scrum_entry(scrum_name, task_data)`
- Fires 1 second after the last change on a row.
- Row matching: by child row `name`, else same employee + same Task, else same employee + same title. No match appends a new row.
- On a submitted scrum it sets `ignore_validate_update_after_submit` and saves anyway.
- If the linked Task changed: removes the old Task assignment for that employee's user and assigns the new Task (runs as Administrator).
- User lookup for an employee: `Employee.user_id`, else a User whose email matches `company_email`.

### 5.5 Reminders (emails sent immediately, `delayed=False`)
| Trigger on board | Who it targets | API | Email |
|---|---|---|---|
| Bell on a row | that employee, shown when yesterday hours <= 4 | `send_individual_reminder` | "URGENT: Timesheet Not Submitted", adds a leave nudge if no leave application exists for yesterday |
| Calendar icon on a row | that employee, shown when not on leave / WFH | `send_leave_reminder` | "URGENT: Leave Application Missing" |
| Remind Timesheets (N) | not on leave and yesterday hours <= 4 | `send_timesheet_reminders` | same as row bell, one per employee |
| Remind Missing (N) | not on leave and no task row filled | `send_timesheet_reminders` | same as row bell |

Sender: if the Scrum Master's user has an enabled outgoing Email Account, mail goes from that account; otherwise the default outgoing account sends with reply-to set to the Scrum Master. Note "yesterday" in `send_individual_reminder` is calendar yesterday, not the previous working day.

### 5.6 Submit - `submit_scrum(scrum_name)`
1. If anyone is missing updates, a dialog offers: Send & Submit, Just Submit, Cancel.
2. Pending debounced saves are flushed.
3. Server: for any row with `is_new_task` and no Task, creates the Task; then submits (docstatus 1).
4. The `status` field is not updated (stays Draft); the UI shows "Submitted" from docstatus.

After submit the grid stays editable and saves continue to write to the submitted document.

## 6. Desk entry point - "Add to Daily Scrum" on Task

On any saved Task form, a custom button opens a dialog (date, employee, team, task type; employee and team prefilled from the current user). It calls `add_task_to_scrum`, which:
- finds the scrum for date + team, or creates a Draft via `start_scrum` (so the current user must be linked to an Employee),
- appends a row for that employee if the same Task is not already there (timesheet status hard-coded to Filled).

## 7. Admin Dashboard (`#/dashboard`)

- Filters: period (daily / monthly / yearly, which sets start date to today / 1st of month / 1st Jan), start and end date, department, name search.
- API: `get_dashboard_metrics(start_date, end_date, department)`.
- Per employee, for each working day in range (holidays skipped, same fallback as 5.1):
  - Approved, submitted leave -> leave day (day skipped). WFH leave type -> WFH day.
  - Timesheet hours < 5 -> missed timesheet day.
  - No scrum row that day -> missed scrum day.
  - Collects distinct tasks, projects and a task list.
- Summary cards (daily period only): Present, On Leave, Missed Timesheet (yesterday hours < 1), Missed Scrum, WFH. Cards count employees, not days.
- PDF detail columns: Sr, Employee, Employee Name, Task, Task Title, Project, Expected Time (Hrs) (from `Task.expected_time`, blank when no Task is linked), Timesheet Status.
- **Export PDF** (landscape A4, jsPDF) or **Email** it: PDF is generated in the browser, uploaded as multipart to `send_report_email` with To, CC (picked from `get_active_users`) and message.

## 8. Project Analytics (`#/project-analytics`)

- Project picker from `get_all_projects` (non-cancelled), filterable by status and search.
- `get_project_analytics(project_name)` returns: project header, all tasks with status counts, total logged hours and top contributors from submitted Timesheet Details, Milestones (if the doctype exists), submitted Sales Invoices.
- Task table filter by status. Export PDF or email via `send_report_email`, same as the dashboard.

## 9. API reference (`erpnext_scrum.erpnext_scrum.api`)

| Method | Writes | Used by |
|---|---|---|
| `get_scrum_data` | - | Board load |
| `start_scrum` | Daily Scrum | Board, `add_task_to_scrum` |
| `save_scrum_entry` | Scrum Task Entry, Task assignment (ToDo) | Board auto-save |
| `remove_scrum_entry` | Scrum Task Entry | Board clear row |
| `submit_scrum` | Task (new), Daily Scrum submit | Board submit |
| `send_individual_reminder` | Email | Board row bell |
| `send_leave_reminder` | Email | Board row calendar |
| `send_timesheet_reminders` | Email (loop) | Board bulk buttons |
| `get_employee_tasks` | - | Task autocomplete |
| `get_projects_for_employee` | - | Quick Create (returns all projects, ignores employee) |
| `get_task_types` | - | Quick Create |
| `quick_create_task` | Task, assignment | Quick Create |
| `add_task_to_scrum` | Daily Scrum / row | Task form button |
| `get_dashboard_metrics` | - | Dashboard |
| `send_report_email` | Email with PDF | Dashboard, Project Analytics |
| `get_all_projects` | - | Project Analytics |
| `get_project_analytics` | - | Project Analytics |
| `get_active_users` | - | Email To/CC pickers |
| `get_my_api_keys` | User api_key / api_secret | Login |

## 10. Developer workflow

```bash
# backend
cd ~/frappe-bench
bench --site <site> migrate          # after doctype JSON changes
bench start                          # Frappe on :8000

# frontend dev (developer_mode on, open /daily_scrum)
cd apps/erpnext_scrum/frontend
npm install
npm run dev                          # Vite on :8080, proxies /api /assets /files /private to :8000

# frontend release
npm run build                        # outputs to erpnext_scrum/public/frontend (commit it)
bench build --app erpnext_scrum      # or bench clear-cache so /assets picks it up
```

- Only `/daily_scrum` switches to the Vite dev server; `/scrum_master` always loads the built bundle.
- Lint/format via pre-commit: ruff, eslint, prettier, pyupgrade.
- Tests: `test_daily_scrum.py` and `test_scrum_config.py` are empty stubs.

## 11. Known gaps and risks

Ranked roughly by impact. These are observations from the code, not yet fixed.

1. **Login rotates the API secret every time.** Logging in on a second device or tab invalidates the first one (401 -> forced logout), and breaks any other integration using that user's keys.
2. **No authorization beyond "logged in".** `ignore_permissions` on reads and writes means any user can start, edit, submit, or delete rows on any department's scrum, list all users' emails, and email arbitrary recipients via `send_report_email`.
3. **Scrum Config times are dead.** Start/end time, grace period, EOD reminder, escalation and CC-PM settings exist but nothing reads them; there are no scheduled reminders or escalations.
4. **Free-text tasks are not saved** and the `is_new_task` create-on-submit path is unreachable from the UI (the frontend always sends `is_new_task: false`).
5. **Inconsistent timesheet thresholds**: row turns red under 5 hrs, reminder buttons appear at <= 4, dashboard "missed" uses < 5 per day but the daily card uses < 1.
6. **Inconsistent leave rules**: board treats draft/open leave as on leave; dashboard counts only approved, submitted leave.
7. **Date in UTC**: board and dashboard default the date with `toISOString()`, so in IST between 00:00 and 05:30 the default date is yesterday.
8. **`status` never leaves Draft**, and `submission_time`, `scrum_open_time`, `scrum_close_time`, `notes` are never written.
9. **Submitted scrums stay editable** through the API, so the submitted record is not a fixed snapshot.
10. **Performance**: `get_scrum_data` runs several queries per employee plus a holiday walk; `get_dashboard_metrics` calls `is_holiday` per employee per day. Fine for one team, slow for yearly ranges across the company.
11. **Dead / stray code**: `erpnext_scrum/api.py` (old, unwhitelisted copy of dashboard metrics), `erpnext_scrum/erpnext_scrum/scratch/test_api.py`, `erpnext_scrum/erpnext_scrum/patch.py` (imports a function that does not exist in the module it targets), root `test_route.py`, `scratch/check_meta.py`.
12. **Hard-coded org details** in reminder emails: `hr@faircodetech.com` and fallback company name "Faircode Technologies".
