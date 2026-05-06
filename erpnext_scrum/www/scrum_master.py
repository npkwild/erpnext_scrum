import frappe

def get_context(context):
    context.no_sidebar = 1
    context.full_width = 1
    context.show_sidebar = 0
    context.hide_standard_header_footer = 1
