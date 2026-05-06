import frappe

def test_quick_create():
    frappe.set_user("Administrator")
    try:
        task = frappe.new_doc("Task")
        task.subject = "Test Quick Create"
        task.project = None
        task.status = "Open"
        task.insert(ignore_permissions=True)
        frappe.db.commit()
        print(f"Task created: {task.name}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_quick_create()
