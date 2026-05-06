import json
import os

def update_json(path, fieldnames):
    with open(path, 'r') as f:
        data = json.load(f)
    
    for field in data.get('fields', []):
        if field.get('fieldname') in fieldnames:
            field['allow_on_submit'] = 1
            
    with open(path, 'w') as f:
        json.dump(data, f, indent=1, sort_keys=True)
    print(f"Updated {path}")

parent_path = "/home/npk/frappe16-bench/apps/erpnext_scrum/erpnext_scrum/erpnext_scrum/doctype/daily_scrum/daily_scrum.json"
child_path = "/home/npk/frappe16-bench/apps/erpnext_scrum/erpnext_scrum/erpnext_scrum/doctype/scrum_task_entry/scrum_task_entry.json"

update_json(parent_path, ['tasks'])
update_json(child_path, ['employee', 'task', 'task_title', 'project', 'task_type', 
                         'dependencies', 'expected_hours', 'is_new_task', 'timesheet_status'])
