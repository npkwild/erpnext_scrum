import frappe

def get_context(context):
    context.no_cache = 1
    # Check if we're in development mode (if Vite dev server is running)
    # Actually, we can just load the Vite assets using a specific script
    context.dev_server = "http://127.0.0.1:8080" if frappe.conf.developer_mode else ""
