# Utility: reset menu to empty and delete TEST_ reservations/guests/staff via API
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
s = requests.Session()
s.post(f"{BASE_URL}/api/auth/login", json={"email": "gonabip117@digeros.com", "password": "Maison-Owner-2026"}).raise_for_status()
print("menu reset", s.put(f"{BASE_URL}/api/menu", json={"categories": []}).status_code)
res = [r for r in s.get(f"{BASE_URL}/api/reservations", params={"q": "TEST_"}).json() if r["guest_name"].startswith("TEST_")]
for r in res:
    s.delete(f"{BASE_URL}/api/reservations/{r['id']}")
gs = [g for g in s.get(f"{BASE_URL}/api/guests", params={"q": "TEST_"}).json() if g.get("name", "").startswith("TEST_")]
for g in gs:
    s.delete(f"{BASE_URL}/api/guests/{g['id']}")
st = [u for u in s.get(f"{BASE_URL}/api/staff").json() if u.get("name", "").startswith("TEST_") or u["email"].startswith("test_")]
for u in st:
    s.delete(f"{BASE_URL}/api/staff/{u['id']}")
print("deleted", len(res), "reservations", len(gs), "guests", len(st), "staff")
print("public menu:", s.get(f"{BASE_URL}/api/public/menu").json())
