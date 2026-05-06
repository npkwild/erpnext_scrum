import frappe

def allow_on_submit():
    # Parent: Daily Scrum
    frappe.db.sql("""UPDATE `tabDocField` SET allow_on_submit = 1 
        WHERE parent = 'Daily Scrum' AND fieldname = 'tasks'""")
    
    # Child: Scrum Task Entry
    child_fields = ['employee', 'task', 'task_title', 'project', 'task_type', 
                    'dependencies', 'expected_hours', 'is_new_task', 'timesheet_status']
    
    for field in child_fields:
        frappe.db.sql(f"""UPDATE `tabDocField` SET allow_on_submit = 1 
            WHERE parent = 'Scrum Task Entry' AND fieldname = '{field}'""")
            
    frappe.clear_cache(doctype="Daily Scrum")
    frappe.clear_cache(doctype="Scrum Task Entry")
    print("Updated allow_on_submit for Daily Scrum and Scrum Task Entry")

if __name__ == "__main__":
    allow_on_submit()
