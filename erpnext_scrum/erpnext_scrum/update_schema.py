import frappe

def update_task_type_field():
    # Find the child table doctype for Daily Scrum
    scrum_doctype = frappe.get_meta("Daily Scrum")
    tasks_field = next((f for f in scrum_doctype.fields if f.fieldname == "tasks"), None)
    
    if not tasks_field:
        print("Could not find 'tasks' field in Daily Scrum")
        return
    
    child_doctype_name = tasks_field.options
    print(f"Child Doctype: {child_doctype_name}")
    
    # Update the child doctype
    child_doc = frappe.get_doc("DocType", child_doctype_name)
    for field in child_doc.fields:
        if field.fieldname == "task_type":
            field.fieldtype = "Link"
            field.options = "Task Type"
            print(f"Updated {child_doctype_name}.task_type to Link (Task Type)")
            break
    else:
        print(f"Could not find 'task_type' field in {child_doctype_name}")
        return
    
    child_doc.save(ignore_permissions=True)
    frappe.db.commit()
    print("Schema updated successfully")

if __name__ == "__main__":
    update_task_type_field()
