# Iteration 2: verify fixes from iteration 1 (lockout via XFF, settings validation, seated-table transitions, seating date window, public validation)
import os
import uuid
from datetime import datetime, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER = {"email": "gonabip117@digeros.com", "password": "Maison-Owner-2026"}


def day(n=0):
    return (datetime.now() + timedelta(days=n)).strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=OWNER)
    if r.status_code != 200:
        pytest.skip("owner login failed")
    return s


def mk_table(owner, name):
    r = owner.post(f"{BASE_URL}/api/tables", json={"name": name, "capacity": 4, "zone": "Bar", "shape": "square"})
    assert r.status_code == 200
    return r.json()["id"]


def get_table(owner, tid):
    return [t for t in owner.get(f"{BASE_URL}/api/tables").json() if t["id"] == tid][0]


def get_res(owner, rid, date):
    return [r for r in owner.get(f"{BASE_URL}/api/reservations", params={"date": date}).json() if r["id"] == rid][0]


def mk_res(owner, date=None, table_id=None, name="TEST_It2"):
    body = {"name": name, "party_size": 2, "date": date or day(0), "time": "19:00", "phone": f"+33TEST{uuid.uuid4().hex[:5]}"}
    if table_id:
        body["table_id"] = table_id
    r = owner.post(f"{BASE_URL}/api/reservations", json=body)
    assert r.status_code == 200
    return r.json()


@pytest.fixture
def cleanup(owner):
    bag = {"tables": [], "res": [], "guests": []}
    yield bag
    for rid in bag["res"]:
        owner.delete(f"{BASE_URL}/api/reservations/{rid}")
    for gid in bag["guests"]:
        owner.delete(f"{BASE_URL}/api/guests/{gid}")
    for tid in bag["tables"]:
        owner.delete(f"{BASE_URL}/api/tables/{tid}")


# Lockout keyed on X-Forwarded-For
def test_bruteforce_lockout_public_url():
    email = f"test_lock_{uuid.uuid4().hex[:6]}@x.com"
    codes = [requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "x"}).status_code for _ in range(6)]
    assert codes == [401] * 5 + [429], codes


# Settings validation
@pytest.mark.parametrize("field,val", [("slot_start", "abc"), ("slot_end", "25:00"), ("slot_start", "9:00")])
def test_settings_bad_slot_422(owner, field, val):
    s = owner.get(f"{BASE_URL}/api/settings").json()
    r = owner.put(f"{BASE_URL}/api/settings", json=dict(s, **{field: val}))
    assert r.status_code == 422
    assert requests.get(f"{BASE_URL}/api/public/info").status_code == 200


def test_settings_start_after_end_400(owner):
    s = owner.get(f"{BASE_URL}/api/settings").json()
    r = owner.put(f"{BASE_URL}/api/settings", json=dict(s, slot_start="23:00", slot_end="12:00"))
    assert r.status_code == 400
    assert owner.get(f"{BASE_URL}/api/settings").json()["slot_start"] == s["slot_start"]


# Seated table -> free/reserved/cleaning completes reservation
@pytest.mark.parametrize("new_status", ["free", "reserved", "cleaning"])
def test_seated_table_status_change_completes(owner, cleanup, new_status):
    tid = mk_table(owner, f"TEST_S{new_status}")
    cleanup["tables"].append(tid)
    res = mk_res(owner, table_id=tid)
    cleanup["res"].append(res["id"]); cleanup["guests"].append(res["guest_id"])
    assert owner.patch(f"{BASE_URL}/api/reservations/{res['id']}", json={"status": "seated"}).status_code == 200
    t = owner.patch(f"{BASE_URL}/api/tables/{tid}", json={"status": new_status}).json()
    assert t["status"] == new_status and t["current_reservation_id"] is None
    assert get_res(owner, res["id"], day(0))["status"] == "completed"
    assert owner.get(f"{BASE_URL}/api/guests/{res['guest_id']}").json()["visits"] == 1


# Move seated reservation to another table
def test_move_seated_reservation(owner, cleanup):
    a, b = mk_table(owner, "TEST_MA"), mk_table(owner, "TEST_MB")
    cleanup["tables"] += [a, b]
    res = mk_res(owner, table_id=a)
    cleanup["res"].append(res["id"]); cleanup["guests"].append(res["guest_id"])
    owner.patch(f"{BASE_URL}/api/reservations/{res['id']}", json={"status": "seated"})
    r = owner.patch(f"{BASE_URL}/api/reservations/{res['id']}", json={"table_id": b})
    assert r.status_code == 200 and r.json()["status"] == "seated" and r.json()["table_id"] == b
    ta, tb = get_table(owner, a), get_table(owner, b)
    assert ta["status"] == "cleaning" and ta["current_reservation_id"] is None
    assert tb["status"] == "seated" and tb["current_reservation_id"] == res["id"]


# Moving seated reservation onto an occupied table should fail WITHOUT touching the old table
def test_move_seated_to_occupied_table_is_atomic(owner, cleanup):
    a, b = mk_table(owner, "TEST_OA"), mk_table(owner, "TEST_OB")
    cleanup["tables"] += [a, b]
    r1 = mk_res(owner, table_id=a); r2 = mk_res(owner, table_id=b, name="TEST_It2b")
    cleanup["res"] += [r1["id"], r2["id"]]; cleanup["guests"] += [r1["guest_id"], r2["guest_id"]]
    owner.patch(f"{BASE_URL}/api/reservations/{r1['id']}", json={"status": "seated"})
    owner.patch(f"{BASE_URL}/api/reservations/{r2['id']}", json={"status": "seated"})
    r = owner.patch(f"{BASE_URL}/api/reservations/{r1['id']}", json={"table_id": b})
    assert r.status_code == 400
    ta = get_table(owner, a)
    assert ta["status"] == "seated" and ta["current_reservation_id"] == r1["id"], f"old table corrupted: {ta['status']} {ta['current_reservation_id']}"


# Seating window
def test_seat_far_future_rejected(owner, cleanup):
    tid = mk_table(owner, "TEST_FF")
    cleanup["tables"].append(tid)
    res = mk_res(owner, date=day(3), table_id=tid)
    cleanup["res"].append(res["id"]); cleanup["guests"].append(res["guest_id"])
    r = owner.patch(f"{BASE_URL}/api/reservations/{res['id']}", json={"status": "seated"})
    assert r.status_code == 400
    assert get_table(owner, tid)["status"] == "free"


# Delete seated table completes its reservation
def test_delete_seated_table_completes(owner, cleanup):
    tid = mk_table(owner, "TEST_DS")
    res = mk_res(owner, table_id=tid)
    cleanup["res"].append(res["id"]); cleanup["guests"].append(res["guest_id"])
    owner.patch(f"{BASE_URL}/api/reservations/{res['id']}", json={"status": "seated"})
    assert owner.delete(f"{BASE_URL}/api/tables/{tid}").status_code == 200
    r = get_res(owner, res["id"], day(0))
    assert r["status"] == "completed" and r["table_id"] is None


# Public validation
def _pub(**kw):
    p = {"name": "TEST_Pub2", "email": "test_pub2@example.com", "phone": "+3312345678", "party_size": 2,
         "date": day(1), "time": "19:30", "zone": "Terrace"}
    p.update(kw)
    return requests.post(f"{BASE_URL}/api/public/reservations", json=p)


def test_public_unknown_zone():
    assert _pub(zone="Rooftop").status_code == 400


def test_public_past_time_today():
    now = datetime.now()
    if now.hour < 12 or (now.hour == 12 and now.minute == 0):
        pytest.skip("no past slot yet today")
    assert _pub(date=day(0), time="12:00").status_code == 400
