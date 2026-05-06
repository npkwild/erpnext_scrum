import frappe

def check_task_meta():
    meta = frappe.get_meta("Task")
    print(f"Fields in Task:")
    for df in meta.fields:
        if df.fieldname in ["type", "task_type", "subject", "project"]:
            print(f"- {df.fieldname}: {df.fieldtype} ({df.options})")

if __name__ == "__main__":
    check_task_meta()
