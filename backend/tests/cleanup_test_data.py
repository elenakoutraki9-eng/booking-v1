# Utility: delete all TEST_ reservations and guests via API
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
s = requests.Session()
s.post(f"{BASE_URL}/api/auth/login", json={"email": "gonabip117@digeros.com", "password": "Maison-Owner-2026"}).raise_for_status()
res = [r for r in s.get(f"{BASE_URL}/api/reservations", params={"q": "TEST_"}).json() if r["guest_name"].startswith("TEST_")]
for r in res:
    s.delete(f"{BASE_URL}/api/reservations/{r['id']}")
gs = [g for g in s.get(f"{BASE_URL}/api/guests", params={"q": "TEST_"}).json() if g.get("name", "").startswith("TEST_")]
for g in gs:
    s.delete(f"{BASE_URL}/api/guests/{g['id']}")
print("deleted", len(res), "reservations", len(gs), "guests")
print("left:", len(s.get(f"{BASE_URL}/api/reservations", params={"q": "TEST_"}).json()))
