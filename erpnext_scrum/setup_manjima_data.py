import frappe
from frappe.utils import add_days, today, getdate

def setup_test_data():
    frappe.init(site="eeis.com")
    frappe.connect()
    frappe.set_user("Administrator")
    
    # 1. Find Manjima
    emp = frappe.get_value("Employee", {"employee_name": ["like", "%Manjima%"]}, ["name", "employee_name", "user_id"], as_dict=True)
    if not emp:
        print("Employee Manjima not found!")
        return

    yesterday = add_days(today(), -1)
    
    # 2. Find any valid Scrum Master
    scrum_master = frappe.get_all("Employee", filters={"status": "Active"}, limit=1)[0].name
    
    # 3. Create Daily Scrum for yesterday
    task = frappe.get_all("Task", limit=1, fields=["name", "subject"])[0]
    
    scrum = frappe.new_doc("Daily Scrum")
    scrum.date = yesterday
    scrum.scrum_master = scrum_master
    scrum.status = "Submitted"
    scrum.append("tasks", {
        "employee": emp.name,
        "task": task.name,
        "task_title": task.subject,
        "task_type": "Development"
    })
    scrum.insert(ignore_permissions=True)
    scrum.submit()
    print(f"Created Daily Scrum: {scrum.name}")

    # 4. Create Timesheet for yesterday
    ts = frappe.new_doc("Timesheet")
    ts.employee = emp.name
    ts.append("time_logs", {
        "activity_type": "Development",
        "from_time": f"{yesterday} 09:00:00",
        "to_time": f"{yesterday} 17:00:00",
        "hours": 8.0,
        "description": "Working on Login Page"
    })
    ts.insert(ignore_permissions=True)
    ts.submit()
    print(f"Created Timesheet: {ts.name} with 8 hours")

    frappe.db.commit()
    print("Test data setup complete!")

if __name__ == "__main__":
    setup_test_data()
