import frappe

def check_child_meta():
    meta = frappe.get_meta("Scrum Task Entry")
    print(f"Fields in Scrum Task Entry:")
    for df in meta.fields:
        print(f"- {df.fieldname}: {df.fieldtype}")

if __name__ == "__main__":
    check_child_meta()
