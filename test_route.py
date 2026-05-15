import requests
res = requests.get('http://127.0.0.1:8000/api/method/frappe.auth.get_logged_user')
print(res.text)
