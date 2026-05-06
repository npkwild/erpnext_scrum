import frappe

def check_task_structure():
    frappe.set_user("Administrator")
    
    # Check Task fields for assignment
    task_fields = frappe.db.sql("SHOW COLUMNS FROM `tabTask`", as_dict=True)
    relevant = [f for f in task_fields if f['Field'] in ['name', 'subject', 'project', 'assigned_to', 'status', 'exp_end_date', 'type']]
    print("Task fields:", relevant)
    
    # Check how tasks are assigned in ERPNext
    sample_tasks = frappe.db.sql("""
        SELECT name, subject, project, status, assigned_to 
        FROM `tabTask` 
        WHERE status NOT IN ('Completed', 'Cancelled')
        LIMIT 5
    """, as_dict=True)
    print("\nSample tasks:", sample_tasks)

if __name__ == "__main__":
    check_task_structure()
