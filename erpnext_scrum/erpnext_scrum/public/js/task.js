frappe.ui.form.on('Task', {
	refresh(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__('Add to Daily Scrum'), () => {
				const dialog = new frappe.ui.Dialog({
					title: __('Add to Daily Scrum'),
					fields: [
						{
							label: __('Date'),
							fieldname: 'date',
							fieldtype: 'Date',
							default: frappe.datetime.nowdate(),
							reqd: 1
						},
						{
							label: __('Employee'),
							fieldname: 'employee',
							fieldtype: 'Link',
							options: 'Employee',
							reqd: 1
						},
						{
							label: __('Team'),
							fieldname: 'team',
							fieldtype: 'Link',
							options: 'Department',
							reqd: 1
						},
						{
							label: __('Task Type'),
							fieldname: 'task_type',
							fieldtype: 'Link',
							options: 'Task Type',
							reqd: 1,
							default: frm.doc.type
						}
					],
					primary_action_label: __('Add'),
					primary_action(values) {
						frappe.call({
							method: 'erpnext_scrum.erpnext_scrum.api.add_task_to_scrum',
							args: {
								task: frm.doc.name,
								date: values.date,
								employee: values.employee,
								team: values.team,
								task_type: values.task_type
							},
							callback(r) {
								if (r.message) {
									frappe.show_alert(__('Task added to Daily Scrum'));
									dialog.hide();
								}
							}
						});
					}
				});
				
				// Auto-fill employee and team if possible
				if (frappe.session.user) {
					frappe.db.get_value('Employee', {user_id: frappe.session.user}, ['name', 'department'], (r) => {
						if (r && r.name) {
							dialog.set_value('employee', r.name);
							if (r.department) {
								dialog.set_value('team', r.department);
							}
						}
					});
				}
				
				dialog.show();
			});
		}
	}
});
