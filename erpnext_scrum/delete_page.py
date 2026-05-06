import frappe

def delete_page():
    frappe.conf.developer_mode = 1
    if frappe.db.exists("Page", "daily_scrum"):
        frappe.delete_doc("Page", "daily_scrum", ignore_permissions=True, force=True)
        frappe.db.commit()
        print("Page deleted from DB")
    else:
        print("Page does not exist in DB")

if __name__ == "__main__":
    delete_page()
