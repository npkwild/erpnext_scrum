import frappe
from frappe.auth import LoginManager

def get_session():
    frappe.set_user("Administrator")
    lm = LoginManager()
    lm.login_as("Administrator")
    frappe.db.commit()
    print(f"SESSION_ID={frappe.session.sid}")

if __name__ == "__main__":
    get_session()
