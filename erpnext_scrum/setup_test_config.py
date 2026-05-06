import frappe

def setup_config():
    frappe.set_user("Administrator")
    
    # Enable all departments for testing
    departments = frappe.get_all("Department", fields=["name"])
    
    config = frappe.get_single("Scrum Config")
    config.enabled_departments = []
    
    for d in departments:
        config.append("enabled_departments", {"department": d.name})
        
    config.save(ignore_permissions=True)
    frappe.db.commit()
    print("Scrum Config updated with all departments!")

if __name__ == "__main__":
    setup_config()
