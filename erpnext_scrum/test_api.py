import frappe
import json
from erpnext_scrum.erpnext_scrum.api import get_scrum_data, submit_scrum

def test():
    frappe.set_user("Administrator")
    print("Testing get_scrum_data...")
    data = get_scrum_data()
    print(f"Data returned: {len(data['employees'])} employees found.")
    
    # Check if we got any employees
    if not data['employees']:
        print("Warning: No employees found. Please ensure Scrum Config has enabled departments.")

    print("\nAPI Test Completed Successfully!")

if __name__ == "__main__":
    test()
