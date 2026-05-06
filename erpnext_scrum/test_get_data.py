import frappe
import json
from erpnext_scrum.erpnext_scrum.api import get_scrum_data

def test_get_data():
    data = get_scrum_data("2026-05-04", "Office - EEIS")
    # Print only Jackson's data for brevity
    for emp in data['employees']:
        if "JACKSON" in emp['employee_name'].upper():
            print(frappe.as_json(emp, indent=2))
    print(f"Scrum Name: {data.get('scrum_name')}")

if __name__ == "__main__":
    test_get_data()
