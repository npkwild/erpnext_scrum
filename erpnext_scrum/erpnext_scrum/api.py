import frappe
from frappe.utils import add_days, getdate
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
            SELECT child.task_title, child.project 
            FROM `tabScrum Task Entry` child
            JOIN `tabDaily Scrum` parent ON child.parent = parent.name
            WHERE child.employee = %s AND parent.date = %s AND parent.docstatus < 2
            ORDER BY child.creation DESC LIMIT 1
        """, (emp.name, prev_date), as_dict=True)
        
        if scrum_tasks:
            yesterday_task = scrum_tasks[0].task_title
            yesterday_project = scrum_tasks[0].project
            
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
                "task_type": t.task_type,
                "dependencies": t.dependencies,
                "expected_hours": t.expected_hours,
                "is_new_task": t.is_new_task,
                "timesheet_status": t.timesheet_status
            } for t in scrum_tasks_map.get(emp.name, [])] or [{
                "task": None,
                "task_title": "",
                "project": "",
                "task_type": "Development",
                "dependencies": "No",
                "expected_hours": 0.0,
                "is_new_task": 0,
                "timesheet_status": "Filled" if hours > 0 else "Missing"
            }]
        })

    user = frappe.session.user
    scrum_master_name = frappe.db.get_value("Employee", {"user_id": user}, "employee_name") or user

    return {
        "employees": data,
        "scrum_master_name": scrum_master_name,
        "scrum_name": existing_scrum.name if existing_scrum else None,
        "scrum_status": existing_scrum.status if existing_scrum else None,
        "scrum_docstatus": existing_scrum.docstatus if existing_scrum else None,
        "available_departments": available_departments
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
        frappe.throw("Cannot update a submitted scrum.")

    # Find if row exists by name or employee
    found = False
    row_name = task_data.get("name")
    employee = task_data.get("employee")
    new_task = task_data.get("task")
    
    saved_row_name = None
    old_task = None
    
    for row in scrum.tasks:
        if (row_name and row.name == row_name) or (not row_name and row.employee == employee):
            old_task = row.task
            row.task = new_task
            row.task_title = task_data.get("task_title")
            row.project = task_data.get("project")
            row.task_type = task_data.get("task_type")
            row.dependencies = task_data.get("dependencies")
            row.expected_hours = task_data.get("expected_hours")
            row.is_new_task = 1 if task_data.get("is_new_task") else 0
            row.timesheet_status = task_data.get("timesheet_status")
            saved_row_name = row.name
            found = True
            break
            
    if not found:
        new_row = scrum.append("tasks", {
            "employee": employee,
            "task": new_task,
            "task_title": task_data.get("task_title"),
            "project": task_data.get("project"),
            "task_type": task_data.get("task_type"),
            "dependencies": task_data.get("dependencies"),
            "expected_hours": task_data.get("expected_hours"),
            "is_new_task": 1 if task_data.get("is_new_task") else 0,
            "timesheet_status": task_data.get("timesheet_status")
        })
        saved_row_name = new_row.name
        
    scrum.save(ignore_permissions=True)
    
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
def get_employee_tasks(employee, search=None, all_tasks=False):
    """Get tasks. If all_tasks=True, searches all system tasks."""
    user_id = get_user_id_for_employee(employee)
    
    conditions = ["t.status NOT IN ('Completed', 'Cancelled')"]
    params = {}

    if not all_tasks and user_id:
        conditions.append("(t._assign LIKE %(user_like)s OR t.owner = %(user_id)s)")
        params["user_like"] = f"%{user_id}%"
        params["user_id"] = user_id

    if search:
        conditions.append("(t.subject LIKE %(search)s OR t.name LIKE %(search)s)")
        params["search"] = f"%{search}%"

    where_clause = " AND ".join(conditions)
    tasks = frappe.db.sql(f"""
        SELECT t.name, t.subject, t.project, t.status, t.type
        FROM `tabTask` t WHERE {where_clause}
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
        scrum.save(ignore_permissions=True)
        return True
    return False
