# Iteration 4: Live availability - /api/public/availability, 409 on fully booked, staff overbooking
import os
from datetime import datetime, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER = {"email": "gonabip117@digeros.com", "password": "Maison-Owner-2026"}
CREATED = []


def fdate(days):
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


def avail(date, n, zone=None):
    p = {"date": date, "party_size": n}
    if zone is not None:
        p["zone"] = zone
    r = requests.get(f"{BASE_URL}/api/public/availability", params=p)
    assert r.status_code == 200, r.text
    return {s["time"]: s["available"] for s in r.json()["slots"]}


@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=OWNER)
    if r.status_code != 200:
        pytest.skip("owner login failed")
    yield s
    # cleanup TEST_ reservations + guests
    for r in s.get(f"{BASE_URL}/api/reservations", params={"q": "TEST_"}).json():
        s.delete(f"{BASE_URL}/api/reservations/{r['id']}")
    for g in s.get(f"{BASE_URL}/api/guests", params={"q": "TEST_"}).json():
        if g.get("name", "").startswith("TEST_"):
            s.delete(f"{BASE_URL}/api/guests/{g['id']}")


def staff_book(owner, date, time, n, table_id=None, status="confirmed", name="TEST_Staff"):
    r = owner.post(f"{BASE_URL}/api/reservations", json={"name": name, "party_size": n, "date": date, "time": time,
                                                        "table_id": table_id, "status": status})
    assert r.status_code == 200, r.text
    CREATED.append(r.json()["id"])
    return r.json()


def pub_book(date, time, n, zone="", name="TEST_Public"):
    return requests.post(f"{BASE_URL}/api/public/reservations", json={
        "name": name, "email": "test_avail@example.com", "phone": "5551234", "party_size": n,
        "date": date, "time": time, "zone": zone})


class TestAvailabilityBasics:
    def test_tables_seed(self, owner):
        t = {x["name"]: (x["capacity"], x["zone"]) for x in owner.get(f"{BASE_URL}/api/tables").json()}
        print(t)
        assert t.get("T6", (0,))[0] == 8 and t.get("T5", (0,))[0] == 6

    def test_shape_future_date(self, owner):
        r = requests.get(f"{BASE_URL}/api/public/availability", params={"date": fdate(30), "party_size": 2})
        assert r.status_code == 200
        d = r.json()
        assert d["slots"][0] == {"time": "12:00", "available": True}
        assert len(d["slots"]) == 22 and all(s["available"] for s in d["slots"])

    def test_today_excludes_past(self):
        now = datetime.now().strftime("%H:%M")
        r = requests.get(f"{BASE_URL}/api/public/availability", params={"date": fdate(0), "party_size": 2})
        assert r.status_code == 200
        assert all(s["time"] > now for s in r.json()["slots"])

    def test_past_date_empty(self):
        r = requests.get(f"{BASE_URL}/api/public/availability", params={"date": fdate(-2), "party_size": 2})
        assert r.status_code == 200 and r.json()["slots"] == []

    @pytest.mark.parametrize("n", [9, 0, -1])
    def test_party_size_bounds(self, n):
        r = requests.get(f"{BASE_URL}/api/public/availability", params={"date": fdate(30), "party_size": n})
        assert r.status_code == 400

    def test_bad_date(self):
        r = requests.get(f"{BASE_URL}/api/public/availability", params={"date": "2026-13-45", "party_size": 2})
        assert r.status_code == 400

    def test_missing_params(self):
        r = requests.get(f"{BASE_URL}/api/public/availability", params={"date": fdate(30)})
        assert r.status_code == 422

    def test_unknown_zone_ignored(self):
        a = avail(fdate(30), 2, "Nowhere")
        assert all(a.values())


class TestAvailabilityRules:
    def test_8_guest_blocks_window(self, owner):
        d = fdate(40)
        staff_book(owner, d, "19:00", 8)
        a8, a2 = avail(d, 8), avail(d, 2)
        blocked = [t for t, v in a8.items() if not v]
        assert blocked == ["18:00", "18:30", "19:00", "19:30", "20:00"], blocked
        assert all(a2.values())

    def test_zone_restriction(self, owner):
        d = fdate(41)
        # fill both terrace 4-tops with pinned bookings
        tables = {x["name"]: x for x in owner.get(f"{BASE_URL}/api/tables").json()}
        staff_book(owner, d, "13:00", 4, tables["P1"]["id"])
        staff_book(owner, d, "13:00", 4, tables["P2"]["id"])
        assert avail(d, 2, "Terrace")["13:00"] is False
        assert avail(d, 2)["13:00"] is True
        assert avail(d, 2, "Terrace")["15:00"] is True

    def test_six_tables_for_5plus(self, owner):
        d = fdate(42)
        staff_book(owner, d, "20:00", 6)  # T5 or T6
        assert avail(d, 6)["20:00"] is True
        staff_book(owner, d, "20:00", 5)
        assert avail(d, 5)["20:00"] is False
        assert avail(d, 4)["20:00"] is True

    def test_cancelled_not_counted(self, owner):
        d = fdate(43)
        r = staff_book(owner, d, "19:00", 8)
        assert avail(d, 8)["19:00"] is False
        owner.patch(f"{BASE_URL}/api/reservations/{r['id']}", json={"status": "cancelled"})
        assert avail(d, 8)["19:00"] is True

    def test_public_409_and_success(self, owner):
        d = fdate(44)
        ok = pub_book(d, "19:00", 8)
        assert ok.status_code == 200 and len(ok.json()["ref"]) > 0
        r = pub_book(d, "19:30", 7)
        assert r.status_code == 409
        assert r.json()["detail"].startswith("Sorry, that time is fully booked")
        assert pub_book(d, "19:30", 2).status_code == 200

    def test_staff_can_overbook_and_counts(self, owner):
        d = fdate(45)
        staff_book(owner, d, "19:00", 8)
        staff_book(owner, d, "19:00", 8)  # overbook - allowed
        assert avail(d, 8)["19:00"] is False

    def test_pinned_table_kept(self, owner):
        d = fdate(46)
        tables = {x["name"]: x for x in owner.get(f"{BASE_URL}/api/tables").json()}
        # 2-guest booking pinned on T6 occupies the 8-top
        staff_book(owner, d, "19:00", 2, tables["T6"]["id"])
        assert avail(d, 8)["19:00"] is False
        assert avail(d, 7)["19:00"] is False
        assert avail(d, 6)["19:00"] is True

    def test_full_house_2(self, owner):
        d = fdate(47)
        for _ in range(12):
            staff_book(owner, d, "18:00", 2)
        a = avail(d, 1)
        assert a["18:00"] is False and a["16:30"] is True and a["19:30"] is True
        assert pub_book(d, "18:00", 1).status_code == 409
