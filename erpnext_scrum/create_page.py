import frappe

def create_page():
    frappe.conf.developer_mode = 1
    frappe.flags.in_install = True
    frappe.flags.in_migrate = True

    if not frappe.db.exists("Page", "daily_scrum"):
        doc = frappe.get_doc({
            "doctype": "Page",
            "page_name": "daily_scrum",
            "title": "Daily Scrum",
            "module": "ERPNext Scrum",
            "standard": "Yes"
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        print("Page created successfully")
    else:
        print("Page already exists")

if __name__ == "__main__":
    create_page()
