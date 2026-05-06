import frappe

def check_task_types():
    types = frappe.get_all("Task Type", pluck="name")
    print(f"Available Task Types: {types}")

if __name__ == "__main__":
    check_task_types()
