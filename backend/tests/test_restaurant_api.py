# Maison Lumière restaurant API regression tests (auth, public booking, reservations, tables, guests, settings, staff, security)
import os
import uuid
from datetime import datetime, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER = {"email": "gonabip117@digeros.com", "password": "Maison-Owner-2026"}


def today():
    return datetime.now().strftime("%Y-%m-%d")


def tomorrow():
    return (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")


@pytest.fixture(scope="session")
def owner():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=OWNER)
    if r.status_code != 200:
        pytest.skip(f"owner login failed {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="session")
def tables(owner):
    return {t["name"]: t for t in owner.get(f"{BASE_URL}/api/tables").json()}


# ---------- Auth ----------
class TestAuth:
    def test_login_sets_httponly_cookies(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER)
        assert r.status_code == 200
        assert r.json()["email"] == OWNER["email"]
        assert r.json()["role"] == "admin"
        assert "password_hash" not in r.json() and "_id" not in r.json()
        sc = r.headers.get("set-cookie", "")
        assert "access_token" in sc and "refresh_token" in sc
        assert "HttpOnly" in sc and "SameSite=none" in sc.replace("None", "none")

    def test_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "TEST_nobody@x.com", "password": "bad"})
        assert r.status_code == 401

    def test_me_and_refresh(self, owner):
        assert owner.get(f"{BASE_URL}/api/auth/me").json()["email"] == OWNER["email"]
        r = owner.post(f"{BASE_URL}/api/auth/refresh")
        assert r.status_code == 200

    def test_bruteforce_lockout(self):
        email = f"test_lock_{uuid.uuid4().hex[:6]}@x.com"
        codes = [requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "x"}).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5, codes
        assert codes[5] == 429, codes

    def test_cors_credentials(self):
        origin = BASE_URL
        r = requests.options(f"{BASE_URL}/api/auth/login", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
        assert r.headers.get("access-control-allow-credentials") == "true"
        assert r.headers.get("access-control-allow-origin") == origin


# ---------- Security ----------
PROTECTED = [("get", "/api/auth/me"), ("get", "/api/reservations"), ("post", "/api/reservations"), ("get", "/api/tables"),
             ("post", "/api/tables"), ("get", "/api/guests"), ("post", "/api/guests"), ("get", "/api/settings"),
             ("put", "/api/settings"), ("get", "/api/staff"), ("post", "/api/staff"), ("get", "/api/dashboard"),
             ("patch", "/api/tables/x"), ("delete", "/api/reservations/x"), ("get", "/api/guests/x")]


@pytest.mark.parametrize("method,path", PROTECTED)
def test_requires_auth(method, path):
    r = getattr(requests, method)(f"{BASE_URL}{path}", json={})
    assert r.status_code == 401, f"{method} {path} -> {r.status_code}"


# ---------- Public booking ----------
class TestPublic:
    def test_info(self):
        d = requests.get(f"{BASE_URL}/api/public/info").json()
        assert d["name"] and "slots" in d and "19:30" in d["slots"]
        assert d["max_party_online"] == 8 and "avg_spend" not in d

    def _payload(self, **kw):
        p = {"name": "TEST_Public Guest", "email": "test_public@example.com", "phone": "+3312345678",
             "party_size": 2, "date": tomorrow(), "time": "19:30", "zone": "Terrace", "notes": "TEST"}
        p.update(kw)
        return p

    def test_past_date_rejected(self):
        r = requests.post(f"{BASE_URL}/api/public/reservations", json=self._payload(date="2020-01-01"))
        assert r.status_code == 400

    def test_invalid_slot_rejected(self):
        r = requests.post(f"{BASE_URL}/api/public/reservations", json=self._payload(time="19:17"))
        assert r.status_code == 400

    def test_party_too_big(self):
        r = requests.post(f"{BASE_URL}/api/public/reservations", json=self._payload(party_size=9))
        assert r.status_code == 400

    def test_bad_email(self):
        r = requests.post(f"{BASE_URL}/api/public/reservations", json=self._payload(email="notanemail"))
        assert r.status_code == 422

    def test_create_pending_and_guest_matched(self, owner):
        r = requests.post(f"{BASE_URL}/api/public/reservations", json=self._payload())
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "pending" and len(d["ref"]) == 6
        r2 = requests.post(f"{BASE_URL}/api/public/reservations", json=self._payload(time="20:00", name="TEST_Public Guest Again"))
        assert r2.status_code == 200
        items = owner.get(f"{BASE_URL}/api/reservations", params={"date": tomorrow(), "q": "TEST_Public"}).json()
        mine = [i for i in items if i["ref"] in (d["ref"], r2.json()["ref"])]
        assert len(mine) == 2 and mine[0]["guest_id"] == mine[1]["guest_id"]
        assert all(i["source"] == "online" and i["status"] == "pending" for i in mine)
        gid = mine[0]["guest_id"]
        g = owner.get(f"{BASE_URL}/api/guests/{gid}").json()
        assert len(g["history"]) >= 2
        for i in mine:
            owner.delete(f"{BASE_URL}/api/reservations/{i['id']}")
        owner.delete(f"{BASE_URL}/api/guests/{gid}")


# ---------- Reservation lifecycle ----------
class TestLifecycle:
    def test_full_flow(self, owner, tables):
        t = tables["P2"]
        assert t["status"] == "free", f"P2 not free: {t['status']}"
        r = owner.post(f"{BASE_URL}/api/reservations", json={"name": "TEST_Life", "email": "test_life@example.com",
                                                             "phone": "+3399999", "party_size": 3, "date": today(), "time": "19:00"})
        assert r.status_code == 200
        res = r.json()
        assert res["status"] == "confirmed" and res["source"] == "staff"
        rid, gid = res["id"], res["guest_id"]
        try:
            # seat without table
            r = owner.patch(f"{BASE_URL}/api/reservations/{rid}", json={"status": "seated"})
            assert r.status_code == 400 and "Assign a table" in r.json()["detail"]
            # assign + seat
            assert owner.patch(f"{BASE_URL}/api/reservations/{rid}", json={"table_id": t["id"]}).json()["table_id"] == t["id"]
            r = owner.patch(f"{BASE_URL}/api/reservations/{rid}", json={"status": "seated"})
            assert r.status_code == 200 and r.json()["status"] == "seated"
            tt = {x["name"]: x for x in owner.get(f"{BASE_URL}/api/tables").json()}["P2"]
            assert tt["status"] == "seated" and tt["current_reservation"]["id"] == rid
            dash = owner.get(f"{BASE_URL}/api/dashboard").json()
            assert dash["seated_covers"] >= 3 and dash["tables"]["seated"] >= 1
            # finish
            r = owner.patch(f"{BASE_URL}/api/reservations/{rid}", json={"status": "completed", "spend": 120.5})
            assert r.status_code == 200 and r.json()["status"] == "completed" and r.json()["spend"] == 120.5
            tt = {x["name"]: x for x in owner.get(f"{BASE_URL}/api/tables").json()}["P2"]
            assert tt["status"] == "cleaning" and tt["current_reservation_id"] is None
            g = owner.get(f"{BASE_URL}/api/guests/{gid}").json()
            assert g["visits"] == 1 and g["total_spend"] == 120.5 and g["last_visit"] == today()
            assert owner.get(f"{BASE_URL}/api/dashboard").json()["revenue"] >= 120.5
            # mark clean
            assert owner.patch(f"{BASE_URL}/api/tables/{t['id']}", json={"status": "free"}).json()["status"] == "free"
        finally:
            owner.delete(f"{BASE_URL}/api/reservations/{rid}")
            owner.delete(f"{BASE_URL}/api/guests/{gid}")
            owner.patch(f"{BASE_URL}/api/tables/{t['id']}", json={"status": "free"})

    def test_cancel_noshow_delete(self, owner):
        ids = []
        for st in ("cancelled", "no_show"):
            r = owner.post(f"{BASE_URL}/api/reservations", json={"name": f"TEST_{st}", "party_size": 2, "date": tomorrow(), "time": "20:00"})
            rid = r.json()["id"]
            ids.append((rid, r.json()["guest_id"]))
            assert owner.patch(f"{BASE_URL}/api/reservations/{rid}", json={"status": st}).json()["status"] == st
        for rid, gid in ids:
            assert owner.delete(f"{BASE_URL}/api/reservations/{rid}").status_code == 200
            assert all(x["id"] != rid for x in owner.get(f"{BASE_URL}/api/reservations", params={"date": tomorrow()}).json())
            owner.delete(f"{BASE_URL}/api/guests/{gid}")

    def test_invalid_date(self, owner):
        r = owner.post(f"{BASE_URL}/api/reservations", json={"name": "TEST_bad", "party_size": 2, "date": "2026-13-40", "time": "20:00"})
        assert r.status_code == 400


# ---------- Tables ----------
class TestTables:
    def test_crud_walkin(self, owner):
        r = owner.post(f"{BASE_URL}/api/tables", json={"name": "TEST_T9", "capacity": 4, "zone": "Bar", "shape": "square"})
        assert r.status_code == 200
        tid = r.json()["id"]
        try:
            assert owner.patch(f"{BASE_URL}/api/tables/{tid}", json={"x": 33.3, "y": 44.4, "capacity": 5}).json()["x"] == 33.3
            t = [x for x in owner.get(f"{BASE_URL}/api/tables").json() if x["id"] == tid][0]
            assert t["y"] == 44.4 and t["capacity"] == 5
            r = owner.post(f"{BASE_URL}/api/tables/{tid}/walk-in", json={"name": "TEST_Walk", "party_size": 2, "phone": "+33TEST1"})
            assert r.status_code == 200 and r.json()["status"] == "seated"
            wid, wg = r.json()["id"], r.json()["guest_id"]
            assert owner.post(f"{BASE_URL}/api/tables/{tid}/walk-in", json={"party_size": 2}).status_code == 400
            t = owner.patch(f"{BASE_URL}/api/tables/{tid}", json={"status": "cleaning"}).json()
            assert t["status"] == "cleaning"
            g = owner.get(f"{BASE_URL}/api/guests/{wg}").json()
            assert g["visits"] == 1
            assert owner.patch(f"{BASE_URL}/api/tables/{tid}", json={"status": "reserved"}).json()["status"] == "reserved"
            owner.delete(f"{BASE_URL}/api/reservations/{wid}")
            owner.delete(f"{BASE_URL}/api/guests/{wg}")
        finally:
            owner.delete(f"{BASE_URL}/api/tables/{tid}")
        assert all(x["id"] != tid for x in owner.get(f"{BASE_URL}/api/tables").json())


# ---------- Guests ----------
class TestGuests:
    def test_guest_crud_notes(self, owner):
        r = owner.post(f"{BASE_URL}/api/guests", json={"name": "TEST_Guest", "email": "TEST_G@x.com", "phone": "+3311"})
        assert r.status_code == 200
        gid = r.json()["id"]
        assert r.json()["email"] == "test_g@x.com"
        try:
            g = owner.patch(f"{BASE_URL}/api/guests/{gid}", json={"allergies": "nuts", "preferences": "window", "vip": True}).json()
            assert g["allergies"] == "nuts" and g["vip"] is True
            assert any(x["id"] == gid for x in owner.get(f"{BASE_URL}/api/guests", params={"vip": True}).json())
            assert any(x["id"] == gid for x in owner.get(f"{BASE_URL}/api/guests", params={"q": "TEST_Gue"}).json())
            n = owner.post(f"{BASE_URL}/api/guests/{gid}/notes", json={"text": "TEST note"}).json()
            assert owner.get(f"{BASE_URL}/api/guests/{gid}").json()["notes"][0]["text"] == "TEST note"
            owner.delete(f"{BASE_URL}/api/guests/{gid}/notes/{n['id']}")
            assert owner.get(f"{BASE_URL}/api/guests/{gid}").json()["notes"] == []
        finally:
            owner.delete(f"{BASE_URL}/api/guests/{gid}")
        assert owner.get(f"{BASE_URL}/api/guests/{gid}").status_code == 404

    def test_unknown_guest_patch(self, owner):
        r = owner.patch(f"{BASE_URL}/api/guests/doesnotexist", json={"allergies": "x"})
        assert r.status_code == 404


# ---------- Settings & staff RBAC ----------
class TestSettingsStaff:
    def test_settings_roundtrip(self, owner):
        s = owner.get(f"{BASE_URL}/api/settings").json()
        orig = s["tagline"]
        s["tagline"] = "TEST_tagline"
        assert owner.put(f"{BASE_URL}/api/settings", json=s).status_code == 200
        assert requests.get(f"{BASE_URL}/api/public/info").json()["tagline"] == "TEST_tagline"
        s["tagline"] = orig
        owner.put(f"{BASE_URL}/api/settings", json=s)

    def test_bad_slot_start(self, owner):
        s = owner.get(f"{BASE_URL}/api/settings").json()
        bad = dict(s, slot_start="abc")
        r = owner.put(f"{BASE_URL}/api/settings", json=bad)
        ok = requests.get(f"{BASE_URL}/api/public/info").status_code
        owner.put(f"{BASE_URL}/api/settings", json=s)
        assert r.status_code in (400, 422) and ok == 200, f"put={r.status_code} public_info={ok}"

    def test_staff_rbac_and_password(self, owner):
        email = f"test_staff_{uuid.uuid4().hex[:6]}@example.com"
        r = owner.post(f"{BASE_URL}/api/staff", json={"name": "TEST Staff", "email": email, "password": "Staffpass1", "role": "staff"})
        assert r.status_code == 200 and r.json()["role"] == "staff"
        uid = r.json()["id"]
        try:
            assert owner.post(f"{BASE_URL}/api/staff", json={"name": "dup", "email": email, "password": "Staffpass1"}).status_code == 400
            s = requests.Session()
            assert s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Staffpass1"}).status_code == 200
            assert s.get(f"{BASE_URL}/api/staff").status_code == 403
            st = s.get(f"{BASE_URL}/api/settings").json()
            assert s.put(f"{BASE_URL}/api/settings", json=st).status_code == 403
            assert s.get(f"{BASE_URL}/api/reservations").status_code == 200
            assert s.post(f"{BASE_URL}/api/auth/change-password", json={"current_password": "wrong", "new_password": "Newpass123"}).status_code == 400
            assert s.post(f"{BASE_URL}/api/auth/change-password", json={"current_password": "Staffpass1", "new_password": "Newpass123"}).status_code == 200
            assert requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Newpass123"}).status_code == 200
        finally:
            assert owner.delete(f"{BASE_URL}/api/staff/{uid}").status_code == 200
        assert all(u["id"] != uid for u in owner.get(f"{BASE_URL}/api/staff").json())

    def test_cannot_delete_self(self, owner):
        me = owner.get(f"{BASE_URL}/api/auth/me").json()
        assert owner.delete(f"{BASE_URL}/api/staff/{me['id']}").status_code == 400
