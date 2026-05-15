import frappe
from frappe.utils import add_days, getdate, date_diff
from erpnext.setup.doctype.employee.employee import is_holiday
import json

def get_user_id_for_employee(employee):
    if not employee:
        return None
    user_id = frappe.db.get_value("Employee", employee, "user_id")
    if not user_id:
        # Fallback to matching User by Employee's company email
        email = frappe.db.get_value("Employee", employee, "company_email")
        if email:
            user_id = frappe.db.get_value("User", {"email": email}, "name")
    return user_id

@frappe.whitelist(allow_guest=True)
def get_scrum_data(date=None, department=None):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)

    if not date:
        date = frappe.utils.today()
    date = getdate(date)
    
    # Fetch enabled departments from Config
    scrum_config = frappe.get_doc("Scrum Config", "Scrum Config", ignore_permissions=True)
    config_departments = [d.department for d in scrum_config.enabled_departments]
    
    if not config_departments:
        # Fallback to all departments if config is empty
        config_departments = [d.name for d in frappe.get_all("Department", filters={"is_group": 0}, ignore_permissions=True)]
    
    # All enabled departments are available to all users
    available_departments = config_departments
    
    # Check if a scrum already exists for this date and department
    existing_scrum = None
    if department:
        existing_scrum = frappe.get_all("Daily Scrum", 
            filters={"date": date, "team": department, "docstatus": ["<", 2]},
            fields=["name", "status", "docstatus"],
            limit=1
        )
    
    scrum_doc = None
    scrum_tasks_map = {}
    if existing_scrum:
        existing_scrum = existing_scrum[0]
        scrum_doc = frappe.get_doc("Daily Scrum", existing_scrum.name)
        scrum_doc.flags.ignore_permissions = True
        for t in scrum_doc.tasks:
            if t.employee not in scrum_tasks_map:
                scrum_tasks_map[t.employee] = []
            scrum_tasks_map[t.employee].append(t)

    # Determine which employees to show
    emp_filters = {"status": "Active"}
    if department:
        emp_filters["department"] = department
    else:
        emp_filters["department"] = ("in", available_departments)

    employees = frappe.get_all(
        "Employee",
        filters=emp_filters,
        fields=["name", "employee_name", "designation", "department", "holiday_list", "image", "user_id"],
        order_by="employee_name asc",
        ignore_permissions=True
    )

    data = []
    for emp in employees:
        prev_date = add_days(date, -1)
        while True:
            try:
                if is_holiday(emp.name, prev_date, raise_exception=True):
                    prev_date = add_days(prev_date, -1)
                else:
                    break
            except Exception:
                if prev_date.weekday() >= 5:
                    prev_date = add_days(prev_date, -1)
                else:
                    break
                    
        leave_app = frappe.db.get_value("Leave Application", {
            "employee": emp.name, "docstatus": ["<", 2],
            "from_date": ("<=", date), "to_date": (">=", date)
        }, ["status", "name", "leave_type"], as_dict=True)
        
        on_leave = False
        is_wfh = False
        leave_info = None
        if leave_app:
            if leave_app.leave_type == "Work From Home":
                is_wfh = True
            else:
                on_leave = True
            
            leave_info = {
                "status": leave_app.status,
                "name": leave_app.name,
                "leave_type": leave_app.leave_type
            }
        
        yesterday_task = None
        yesterday_project = None
        
        # Pull from previous scrum if available
        scrum_tasks = frappe.db.sql("""
            SELECT child.task_title, child.project, p.project_name
            FROM `tabScrum Task Entry` child
            JOIN `tabDaily Scrum` parent ON child.parent = parent.name
            LEFT JOIN `tabProject` p ON child.project = p.name
            WHERE child.employee = %s AND parent.date = %s AND parent.docstatus < 2
            ORDER BY child.creation DESC LIMIT 1
        """, (emp.name, prev_date), as_dict=True)
        
        if scrum_tasks:
            yesterday_task = scrum_tasks[0].task_title
            yesterday_project = scrum_tasks[0].project_name or scrum_tasks[0].project
            
        timesheet_hours = frappe.db.sql("""
            SELECT SUM(total_hours) FROM `tabTimesheet` 
            WHERE employee = %s AND start_date = %s AND docstatus = 1
        """, (emp.name, prev_date))
        hours = float(timesheet_hours[0][0]) if timesheet_hours and timesheet_hours[0][0] else 0.0

        # Merge with current draft data if exists
        saved_task = scrum_tasks_map.get(emp.name)
        
        data.append({
            "employee": emp.name,
            "employee_name": emp.employee_name,
            "designation": emp.designation,
            "department": emp.department,
            "image": emp.image,
            "user_id": emp.user_id,
            "on_leave": on_leave,
            "is_wfh": is_wfh,
            "leave_info": leave_info,
            "prev_working_day": prev_date,
            "yesterday_task": yesterday_task,
            "yesterday_project": yesterday_project,
            "yesterday_hours": hours,
            # Current Scrum Data
            "tasks": [{
                "name": t.name,
                "task": t.task,
                "task_title": t.task_title,
                "project": t.project,
                "project_name": frappe.db.get_value("Project", t.project, "project_name") if t.project else "",
                "task_type": t.task_type,
                "dependencies": t.dependencies,
                "expected_hours": t.expected_hours,
                "is_new_task": t.is_new_task,
                "timesheet_status": t.timesheet_status
            } for t in scrum_tasks_map.get(emp.name, [])] or [{
                "task": None,
                "task_title": "",
                "project": "",
                "project_name": "",
                "task_type": "Development",
                "dependencies": "No",
                "expected_hours": 0.0,
                "is_new_task": 0,
                "timesheet_status": "Filled" if hours > 0 else "Missing"
            }]
        })

    user = frappe.session.user
    scrum_master_name = frappe.db.get_value("Employee", {"user_id": user}, "employee_name") or user

    # Fetch projects for default selection
    projects = frappe.get_all("Project", filters={"status": ["!=", "Cancelled"]}, fields=["name", "project_name"], order_by="modified desc", limit=100)

    return {
        "employees": data,
        "scrum_master_name": scrum_master_name,
        "scrum_name": existing_scrum.name if existing_scrum else None,
        "scrum_status": existing_scrum.status if existing_scrum else None,
        "scrum_docstatus": existing_scrum.docstatus if existing_scrum else None,
        "available_departments": available_departments,
        "projects": projects
    }

@frappe.whitelist(allow_guest=True)
def start_scrum(date, department):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
        
    user = frappe.session.user
    scrum_master = frappe.db.get_value("Employee", {"user_id": user}, "name")
    
    if not scrum_master:
        frappe.throw("You must be linked to an Employee record to start the Daily Scrum.")

    # Check if already exists
    exists = frappe.db.exists("Daily Scrum", {"date": date, "team": department, "docstatus": ["<", 2]})
    if exists:
        return exists

    scrum = frappe.new_doc("Daily Scrum")
    scrum.date = date
    scrum.team = department
    scrum.scrum_master = scrum_master
    scrum.status = "Draft"
    scrum.insert()
    return scrum.name

@frappe.whitelist(allow_guest=True)
def save_scrum_entry(scrum_name, task_data):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
        
    task_data = json.loads(task_data)
    scrum = frappe.get_doc("Daily Scrum", scrum_name)
    
    if scrum.docstatus == 1:
        scrum.flags.ignore_validate_update_after_submit = True

    found = False
    row_name = task_data.get("name")
    employee = task_data.get("employee")
    new_task = task_data.get("task")
    new_title = task_data.get("task_title")
    
    saved_row_name = None
    old_task = None
    
    # Try to find existing row
    for row in scrum.tasks:
        if row.employee == employee:
            # Match by name if provided
            if row_name and row.name == row_name:
                found = True
            # If name not provided, match by task ID if it exists and is same
            elif not row_name and new_task and row.task == new_task:
                found = True
            # If still not found and no task ID, match by title (for typed tasks)
            elif not row_name and not new_task and row.task_title == new_title:
                found = True
            
            if found:
                old_task = row.task
                
                # If adding a new task to an already submitted scrum
                if scrum.docstatus == 1 and task_data.get("is_new_task") and not new_task:
                    new_task_doc = frappe.new_doc("Task")
                    new_task_doc.subject = new_title
                    new_task_doc.project = task_data.get("project")
                    new_task_doc.type = task_data.get("task_type")
                    new_task_doc.insert(ignore_permissions=True)
                    new_task = new_task_doc.name
                    task_data["task"] = new_task
                    
                row.task = new_task
                row.task_title = new_title
                row.project = task_data.get("project")
                row.task_type = task_data.get("task_type")
                row.dependencies = task_data.get("dependencies")
                row.expected_hours = task_data.get("expected_hours")
                row.is_new_task = 1 if task_data.get("is_new_task") else 0
                row.timesheet_status = task_data.get("timesheet_status")
                saved_row_name = row.name
                break
            
    if not found:
        # If adding a new task to an already submitted scrum
        if scrum.docstatus == 1 and task_data.get("is_new_task") and not new_task:
            new_task_doc = frappe.new_doc("Task")
            new_task_doc.subject = new_title
            new_task_doc.project = task_data.get("project")
            new_task_doc.type = task_data.get("task_type")
            new_task_doc.insert(ignore_permissions=True)
            new_task = new_task_doc.name
            
        new_row = scrum.append("tasks", {
            "employee": employee,
            "task": new_task,
            "task_title": new_title,
            "project": task_data.get("project"),
            "task_type": task_data.get("task_type"),
            "dependencies": task_data.get("dependencies"),
            "expected_hours": task_data.get("expected_hours"),
            "is_new_task": 1 if task_data.get("is_new_task") else 0,
            "timesheet_status": task_data.get("timesheet_status")
        })
        saved_row_name = new_row.name
        
    scrum.save(ignore_permissions=True)
    frappe.db.commit()
    
    # Handle ToDo Assignments
    if employee and (old_task != new_task):
        user_id = get_user_id_for_employee(employee)
        if user_id:
            current_user = frappe.session.user
            frappe.set_user("Administrator")
            try:
                from frappe.desk.form.assign_to import add as assign_to, remove as remove_assign
                
                # Remove old assignment if it exists
                if old_task:
                    try:
                        remove_assign("Task", old_task, user_id)
                    except Exception:
                        pass # Ignore if assignment didn't exist
                
                # Add new assignment
                if new_task:
                    assign_to({
                        "assign_to": [user_id],
                        "doctype": "Task",
                        "name": new_task,
                        "description": task_data.get("task_title") or new_task,
                        "reassign": True
                    })
            finally:
                frappe.set_user(current_user)

    return { "name": scrum.name, "saved_row_name": saved_row_name }


@frappe.whitelist(allow_guest=True)
def remove_scrum_entry(scrum_name, row_name=None, employee=None, row_id=None):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
        
    scrum = frappe.get_doc("Daily Scrum", scrum_name)
    if scrum.docstatus == 1:
        scrum.flags.ignore_validate_update_after_submit = True
        
    # If we have the specific row name
    if row_name:
        for row in scrum.tasks:
            if row.name == row_name:
                scrum.remove(row)
                break
    elif employee:
        # Fallback: remove by employee (could be multiple, but we try to find the one matching the frontend logic)
        # It's better if frontend passes the row_name it got from save_scrum_entry.
        pass
        
    scrum.save(ignore_permissions=True)
    frappe.db.commit()
    return True

@frappe.whitelist(allow_guest=True)
def submit_scrum(scrum_name):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
        
    scrum = frappe.get_doc("Daily Scrum", scrum_name)
    if scrum.docstatus == 0:
        # Create new tasks if marked as is_new_task
        for row in scrum.tasks:
            if row.is_new_task and not row.task:
                new_task = frappe.new_doc("Task")
                new_task.subject = row.task_title
                new_task.project = row.project
                new_task.type = row.task_type
                new_task.insert(ignore_permissions=True)
                row.task = new_task.name
        
        scrum.flags.ignore_permissions = True
        scrum.submit()
    return scrum.name

@frappe.whitelist(allow_guest=True)
def send_individual_reminder(employee):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
        
    user_id = get_user_id_for_employee(employee)
    if user_id:
        emp_name = frappe.db.get_value("Employee", employee, "employee_name")
        yesterday = frappe.utils.add_days(frappe.utils.today(), -1)
        formatted_date = frappe.utils.getdate(yesterday).strftime("%d-%m-%Y")
        
        # Get sender info
        sm_user = frappe.session.user
        sm_name = frappe.db.get_value("Employee", {"user_id": sm_user}, "employee_name") or "Scrum Master"
        company = frappe.defaults.get_global_default("company") or "Faircode Technologies"
        
        # Check if they have ANY leave application for yesterday
        leave_app = frappe.db.get_value("Leave Application", {
            "employee": employee, "docstatus": ["<", 2],
            "from_date": ("<=", yesterday), "to_date": (">=", yesterday)
        }, "name")
        
        leave_nudge = ""
        if not leave_app:
            leave_nudge = """
            <div style="background-color: #fff9db; border: 1px solid #ffec99; padding: 12px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 0; font-size: 13px;"><b>Note:</b> If you were on leave yesterday but have not yet submitted an application, please <b>apply for leave immediately</b> via the HR portal.</p>
            </div>
            """
        
        message = f"""
        <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
            <p>Hi {emp_name},</p>
            <p>This is an urgent reminder regarding your <b>Daily Scrum updates</b>:</p>
            <ul>
                <li><b>Yesterday's Timesheet ({formatted_date}):</b> Still missing or incomplete.</li>
                <li><b>Today's Tasks:</b> Not yet updated for the scrum meeting.</li>
            </ul>
            <p>Failure to provide these updates promptly results in:</p>
            <ul>
                <li>Delayed or withheld payroll for this period</li>
                <li>Project billing discrepancies that affect the entire team</li>
                <li>Escalation to HR Manager</li>
            </ul>
            <p>Please update both your <b>timesheet</b> and <b>today's tasks</b> immediately via the Daily Scrum portal.</p>
            {leave_nudge}
            <p>If there is a reason you have been unable to submit, contact <b>HR Manager</b> at <b>hr@faircodetech.com</b> right away — do not wait.</p>
            <p>This requires your attention today.</p>
            <br>
            <p>Best Regards,<br>
            <b>{sm_name}</b><br>
            Scrum Master | {company}</p>
        </div>
        """
        
        frappe.sendmail(
            recipients=[user_id],
            subject="URGENT: Timesheet Not Submitted – Immediate Action Required",
            message=message,
            delayed=False
        )
        return True
    return False

@frappe.whitelist(allow_guest=True)
def send_leave_reminder(employee):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
        
    user_id = get_user_id_for_employee(employee)
    if user_id:
        emp_name = frappe.db.get_value("Employee", employee, "employee_name")
        
        # Get sender info
        sm_user = frappe.session.user
        sm_name = frappe.db.get_value("Employee", {"user_id": sm_user}, "employee_name") or "Scrum Master"
        company = frappe.defaults.get_global_default("company") or "Faircode Technologies"
        
        message = f"""
        <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
            <p>Hi {emp_name},</p>
            <p>Our records show that you are absent today, but <b>no leave application</b> has been submitted for your absence.</p>
            <p>If you are on leave, please <b>apply for leave immediately</b> via the HR portal to avoid payroll discrepancies.</p>
            <p>If you are unable to access the portal, please contact the <b>HR Manager</b> at <b>hr@faircodetech.com</b> right away.</p>
            <p>This requires your immediate attention.</p>
            <br>
            <p>Best Regards,<br>
            <b>{sm_name}</b><br>
            Scrum Master | {company}</p>
        </div>
        """
        
        frappe.sendmail(
            recipients=[user_id],
            subject="URGENT: Leave Application Missing",
            message=message,
            delayed=False
        )
        return True
    return False

@frappe.whitelist(allow_guest=True)
def send_timesheet_reminders(employees):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
    employees = json.loads(employees)
    for emp_id in employees:
        send_individual_reminder(emp_id)
    return True

@frappe.whitelist()
def get_employee_tasks(employee, search=None, all_tasks=False, project=None):
    """Get tasks. If all_tasks=True, searches all system tasks."""
    user_id = get_user_id_for_employee(employee)
    
    conditions = ["t.status NOT IN ('Completed', 'Cancelled')"]
    params = {}

    if not all_tasks and user_id:
        # Check assigned to, owner, or in assignments (tabToDo)
        conditions.append("""(
            t._assign LIKE %(user_like)s 
            OR t.owner = %(user_id)s 
            OR t.name IN (SELECT reference_name FROM `tabToDo` WHERE reference_type='Task' AND allocated_to=%(user_id)s AND status='Open')
        )""")
        params["user_like"] = f"%{user_id}%"
        params["user_id"] = user_id

    if project:
        conditions.append("t.project = %(project)s")
        params["project"] = project

    if search:
        conditions.append("(t.subject LIKE %(search)s OR t.name LIKE %(search)s OR p.project_name LIKE %(search)s)")
        params["search"] = f"%{search}%"

    where_clause = " AND ".join(conditions)
    tasks = frappe.db.sql(f"""
        SELECT t.name, t.subject, t.project, p.project_name, t.status, t.type
        FROM `tabTask` t
        LEFT JOIN `tabProject` p ON t.project = p.name
        WHERE {where_clause}
        ORDER BY t.modified DESC LIMIT 100
    """, params, as_dict=True)
    return tasks

@frappe.whitelist()
def get_projects_for_employee(employee):
    return frappe.get_all("Project", filters={"status": ["!=", "Cancelled"]}, fields=["name", "project_name"], order_by="modified desc", limit=100)

@frappe.whitelist()
def get_my_api_keys():
    user = frappe.session.user
    if user == "Guest": frappe.throw("Must be logged in")
    user_doc = frappe.get_doc("User", user)
    if not user_doc.api_key:
        user_doc.api_key = frappe.generate_hash(length=15)
        user_doc.save(ignore_permissions=True)
    api_secret = frappe.generate_hash(length=15)
    user_doc.api_secret = api_secret
    user_doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"api_key": user_doc.api_key, "api_secret": api_secret, "username": user_doc.full_name or user}

@frappe.whitelist()
def get_task_types():
    return [d.name for d in frappe.get_all("Task Type", order_by="name")]

@frappe.whitelist(allow_guest=True)
def quick_create_task(subject, project=None, task_type=None, employee=None, exp_start_date=None, exp_end_date=None, expected_time=None):
    if frappe.session.user == "Guest": frappe.throw("Authentication required", frappe.PermissionError)
    task = frappe.new_doc("Task")
    task.subject = subject
    task.project = project
    if task_type:
        task.type = task_type
    if exp_start_date:
        task.exp_start_date = exp_start_date
    if exp_end_date:
        task.exp_end_date = exp_end_date
    if expected_time:
        task.expected_time = expected_time
    if employee:
        user_id = get_user_id_for_employee(employee)
        if user_id:
            task.owner = user_id
            
    task.status = "Open"
    task.insert(ignore_permissions=True)
    
    if employee and user_id:
        current_user = frappe.session.user
        frappe.set_user("Administrator")
        try:
            from frappe.desk.form.assign_to import add as assign_to
            assign_to({
                "assign_to": [user_id],
                "doctype": "Task",
                "name": task.name,
                "description": task.subject,
            })
        finally:
            frappe.set_user(current_user)
    
    frappe.db.commit()
    res = task.as_dict()
    res["employee"] = employee
    return res

@frappe.whitelist()
def add_task_to_scrum(task, date, employee, team, task_type=None):
    if frappe.session.user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
        
    # Find existing scrum
    scrum_name = frappe.db.get_value("Daily Scrum", {"date": date, "team": team, "docstatus": ["<", 2]}, "name")
    
    if not scrum_name:
        # Create a new draft if not found
        scrum_name = start_scrum(date, team)
        
    scrum = frappe.get_doc("Daily Scrum", scrum_name)
    
    # Check if employee already has this task in this scrum
    exists = any(t.task == task and t.employee == employee for t in scrum.tasks)
    if not exists:
        task_doc = frappe.get_doc("Task", task)
        scrum.append("tasks", {
            "employee": employee,
            "task": task,
            "task_title": task_doc.subject,
            "project": task_doc.project,
            "task_type": task_type or task_doc.type or "Development",
            "dependencies": "No",
            "expected_hours": 0.0,
            "timesheet_status": "Filled"
        })
        
        if scrum.docstatus == 1:
            scrum.flags.ignore_validate_update_after_submit = True
            
        scrum.save(ignore_permissions=True)
        frappe.db.commit()
        return True
    return False
@frappe.whitelist()
def get_dashboard_metrics(start_date, end_date, department=None, employee=None, project=None):
    start_date = getdate(start_date)
    end_date = getdate(end_date)
    
    # 1. Fetch Employees
    emp_filters = {"status": "Active"}
    if department:
        emp_filters["department"] = department
    if employee:
        emp_filters["name"] = employee

    employees = frappe.get_all(
        "Employee",
        filters=emp_filters,
        fields=["name", "employee_name", "department", "holiday_list", "image", "designation"],
        order_by="employee_name asc"
    )

    # Calculate total days in range
    total_days = date_diff(end_date, start_date) + 1
    dates_in_range = [add_days(start_date, i) for i in range(total_days)]

    # Fetch Leave Applications in range
    leaves = frappe.db.sql("""
        SELECT employee, from_date, to_date, leave_type
        FROM `tabLeave Application`
        WHERE docstatus = 1 AND status = 'Approved'
        AND to_date >= %s AND from_date <= %s
    """, (start_date, end_date), as_dict=True)

    # Fetch Timesheets in range
    # Assuming start_date of timesheet falls in the range
    timesheets = frappe.db.sql("""
        SELECT employee, start_date, SUM(total_hours) as hours
        FROM `tabTimesheet`
        WHERE docstatus = 1
        AND start_date BETWEEN %s AND %s
        GROUP BY employee, start_date
    """, (start_date, end_date), as_dict=True)

    # Fetch Daily Scrum Tasks in range
    scrum_tasks = frappe.db.sql("""
        SELECT parent.date, child.employee, child.task, child.project
        FROM `tabScrum Task Entry` child
        JOIN `tabDaily Scrum` parent ON child.parent = parent.name
        WHERE parent.docstatus < 2
        AND parent.date BETWEEN %s AND %s
    """, (start_date, end_date), as_dict=True)

    # Organize data
    from collections import defaultdict
    ts_map = defaultdict(lambda: defaultdict(float))
    for ts in timesheets:
        ts_map[ts.employee][ts.start_date] = ts.hours

    scrum_map = defaultdict(lambda: defaultdict(list))
    for st in scrum_tasks:
        scrum_map[st.employee][st.date].append(st)

    # Process per employee
    from erpnext.setup.doctype.employee.employee import is_holiday

    result = []
    aggregate = {
        "present": 0,
        "leave": 0,
        "missed_ts": 0,
        "missed_scrum": 0,
        "wfh": 0
    }

    for emp in employees:
        emp_data = {
            "name": emp.name,
            "employee_name": emp.employee_name,
            "department": emp.department,
            "image": emp.image,
            "designation": emp.designation,
            "total_ts_hours": 0.0,
            "total_leaves": 0,
            "wfh_days": 0,
            "missed_ts_days": 0,
            "missed_scrum_days": 0,
            "attended_tasks": set(),
            "attended_projects": set()
        }

        # Determine leaves and WFH for this employee
        emp_leaves = [l for l in leaves if l.employee == emp.name]

        for d in dates_in_range:
            # Check if it's a holiday
            # Note: is_holiday might be slow to call in a loop for 100 employees * 30 days = 3000 calls.
            # It caches internally in frappe.flags, but we can optimize.
            # Let's use is_holiday
            try:
                if is_holiday(emp.name, d, raise_exception=True):
                    continue
            except Exception:
                if d.weekday() >= 5: # Saturday/Sunday fallback
                    continue
            
            # Check leave
            on_leave = False
            is_wfh = False
            for l in emp_leaves:
                if getdate(l.from_date) <= d <= getdate(l.to_date):
                    if l.leave_type == "Work From Home":
                        is_wfh = True
                    else:
                        on_leave = True
                    break
            
            if on_leave:
                emp_data["total_leaves"] += 1
                continue
            
            if is_wfh:
                emp_data["wfh_days"] += 1
                
            # Timesheet check
            ts_hours = ts_map[emp.name].get(d, 0.0)
            emp_data["total_ts_hours"] += ts_hours
            if ts_hours < 5:
                emp_data["missed_ts_days"] += 1
                
            # Scrum check
            day_scrum = scrum_map[emp.name].get(d, [])
            if not day_scrum:
                emp_data["missed_scrum_days"] += 1
            else:
                for task in day_scrum:
                    if task.task:
                        emp_data["attended_tasks"].add(task.task)
                    if task.project:
                        emp_data["attended_projects"].add(task.project)

        # Convert sets to lengths
        emp_data["total_tasks"] = len(emp_data["attended_tasks"])
        emp_data["total_projects"] = len(emp_data["attended_projects"])
        del emp_data["attended_tasks"]
        del emp_data["attended_projects"]

        # Aggregate for summary cards
        if emp_data["total_leaves"] > 0:
            aggregate["leave"] += 1
        else:
            aggregate["present"] += 1
            
        if emp_data["missed_ts_days"] > 0:
            aggregate["missed_ts"] += 1
        if emp_data["missed_scrum_days"] > 0:
            aggregate["missed_scrum"] += 1
        if emp_data["wfh_days"] > 0:
            aggregate["wfh"] += 1

        result.append(emp_data)

    return {
        "aggregate": aggregate,
        "employees": result
    }
