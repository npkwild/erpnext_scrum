import frappe
from frappe.utils import add_days, getdate, date_diff

def get_dashboard_metrics(start_date, end_date, department=None, employee=None, project=None):
    start_date = getdate(start_date)
    end_date = getdate(end_date)
    
    # 1. Fetch Employees
    emp_filters = {"status": "Active"}
    if department:
        emp_filters["department"] = department
    if employee:
        emp_filters["name"] = employee

    employees = frappe.get_all(
        "Employee",
        filters=emp_filters,
        fields=["name", "employee_name", "department", "holiday_list", "image", "designation"],
        order_by="employee_name asc"
    )

    # Calculate total days in range
    total_days = date_diff(end_date, start_date) + 1
    dates_in_range = [add_days(start_date, i) for i in range(total_days)]

    # Fetch Leave Applications in range
    leaves = frappe.db.sql("""
        SELECT employee, from_date, to_date, leave_type
        FROM `tabLeave Application`
        WHERE docstatus = 1 AND status = 'Approved'
        AND to_date >= %s AND from_date <= %s
    """, (start_date, end_date), as_dict=True)

    # Fetch Timesheets in range
    # Assuming start_date of timesheet falls in the range
    timesheets = frappe.db.sql("""
        SELECT employee, start_date, SUM(total_hours) as hours
        FROM `tabTimesheet`
        WHERE docstatus = 1
        AND start_date BETWEEN %s AND %s
        GROUP BY employee, start_date
    """, (start_date, end_date), as_dict=True)

    # Fetch Daily Scrum Tasks in range
    scrum_tasks = frappe.db.sql("""
        SELECT parent.date, child.employee, child.task, child.project
        FROM `tabScrum Task Entry` child
        JOIN `tabDaily Scrum` parent ON child.parent = parent.name
        WHERE parent.docstatus < 2
        AND parent.date BETWEEN %s AND %s
    """, (start_date, end_date), as_dict=True)

    # Organize data
    from collections import defaultdict
    ts_map = defaultdict(lambda: defaultdict(float))
    for ts in timesheets:
        ts_map[ts.employee][ts.start_date] = ts.hours

    scrum_map = defaultdict(lambda: defaultdict(list))
    for st in scrum_tasks:
        scrum_map[st.employee][st.date].append(st)

    # Process per employee
    from erpnext.setup.doctype.employee.employee import is_holiday

    result = []
    aggregate = {
        "present": 0,
        "leave": 0,
        "missed_ts": 0,
        "missed_scrum": 0,
        "wfh": 0
    }

    for emp in employees:
        emp_data = {
            "name": emp.name,
            "employee_name": emp.employee_name,
            "department": emp.department,
            "image": emp.image,
            "designation": emp.designation,
            "total_ts_hours": 0.0,
            "total_leaves": 0,
            "wfh_days": 0,
            "missed_ts_days": 0,
            "missed_scrum_days": 0,
            "attended_tasks": set(),
            "attended_projects": set()
        }

        # Determine leaves and WFH for this employee
        emp_leaves = [l for l in leaves if l.employee == emp.name]

        for d in dates_in_range:
            # Check if it's a holiday
            # Note: is_holiday might be slow to call in a loop for 100 employees * 30 days = 3000 calls.
            # It caches internally in frappe.flags, but we can optimize.
            # Let's use is_holiday
            try:
                if is_holiday(emp.name, d, raise_exception=True):
                    continue
            except Exception:
                if d.weekday() >= 5: # Saturday/Sunday fallback
                    continue
            
            # Check leave
            on_leave = False
            is_wfh = False
            for l in emp_leaves:
                if getdate(l.from_date) <= d <= getdate(l.to_date):
                    if l.leave_type == "Work From Home":
                        is_wfh = True
                    else:
                        on_leave = True
                    break
            
            if on_leave:
                emp_data["total_leaves"] += 1
                continue
            
            if is_wfh:
                emp_data["wfh_days"] += 1
                
            # Timesheet check
            ts_hours = ts_map[emp.name].get(d, 0.0)
            emp_data["total_ts_hours"] += ts_hours
            if ts_hours < 5:
                emp_data["missed_ts_days"] += 1
                
            # Scrum check
            day_scrum = scrum_map[emp.name].get(d, [])
            if not day_scrum:
                emp_data["missed_scrum_days"] += 1
            else:
                for task in day_scrum:
                    if task.task:
                        emp_data["attended_tasks"].add(task.task)
                    if task.project:
                        emp_data["attended_projects"].add(task.project)

        # Convert sets to lengths
        emp_data["total_tasks"] = len(emp_data["attended_tasks"])
        emp_data["total_projects"] = len(emp_data["attended_projects"])
        del emp_data["attended_tasks"]
        del emp_data["attended_projects"]

        # Aggregate for summary cards
        if emp_data["total_leaves"] > 0:
            aggregate["leave"] += 1
        else:
            aggregate["present"] += 1
            
        if emp_data["missed_ts_days"] > 0:
            aggregate["missed_ts"] += 1
        if emp_data["missed_scrum_days"] > 0:
            aggregate["missed_scrum"] += 1
        if emp_data["wfh_days"] > 0:
            aggregate["wfh"] += 1

        result.append(emp_data)

    return {
        "aggregate": aggregate,
        "employees": result
    }
