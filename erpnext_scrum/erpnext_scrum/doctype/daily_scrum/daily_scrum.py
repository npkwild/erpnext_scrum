# Copyright (c) 2026, FaircodeNext Private Limited and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class DailyScrum(Document):
	def autoname(self):
		self.name = f"{self.team}-{self.date}"
