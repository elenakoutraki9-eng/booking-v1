# Iteration 3: owner customization - settings tabs RBAC, dashboard layout, zones CRUD, booking page content, assets
import os
import base64
import uuid
from datetime import datetime, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER = {"email": "gonabip117@digeros.com", "password": "Maison-Owner-2026"}
DEFAULT_ZONES = ["Main Dining", "Bar", "Terrace"]
DASH_KEYS = ["stat_bookings", "stat_covers", "stat_seated", "stat_pending", "stat_revenue", "upcoming", "floor"]
CONTENT_DEFAULTS = {
    "tagline": "Kitchen & Cocktail Bar",
    "description": "Seasonal plates, natural wines and late-night cocktails. Reserve your table below.",
    "hero_badge": "Now taking reservations", "hero_image": "/images/hero.jpg", "cta_label": "Reserve a table",
    "show_hero_cards": True, "booking_title": "Book in under a minute.",
    "booking_text": "Pick a date, time and party size. Our team reviews every request and confirms by email or phone.",
    "show_steps": True, "show_gallery": True, "gallery_1": "/images/dish.jpg", "gallery_2": "/images/bar.jpg",
    "show_visit": True, "visit_title": "Find your way here.",
    "dashboard_title": "Today's service", "dashboard": [{"key": k, "visible": True} for k in DASH_KEYS],
}
# 1x1 PNG
PNG = "data:image/png;base64," + base64.b64encode(bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")).decode()
UPLOADED = []


@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=OWNER)
    if r.status_code != 200:
        pytest.skip("owner login failed")
    yield s
    # restore everything
    s.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": z, "original": z} for z in DEFAULT_ZONES]})
    s.put(f"{BASE_URL}/api/settings", json=CONTENT_DEFAULTS)


@pytest.fixture(scope="module")
def staff(owner):
    email = f"test_staff_{uuid.uuid4().hex[:6]}@example.com"
    r = owner.post(f"{BASE_URL}/api/staff", json={"name": "TEST_Staff", "email": email, "password": "TestStaff-2026", "role": "staff"})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    s = requests.Session()
    assert s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "TestStaff-2026"}).status_code == 200
    yield s
    owner.delete(f"{BASE_URL}/api/staff/{sid}")


# --- RBAC ---
class TestRBAC:
    def test_staff_can_read_settings(self, staff):
        r = staff.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200 and "dashboard" in r.json()

    def test_staff_put_settings_403(self, staff):
        assert staff.put(f"{BASE_URL}/api/settings", json={"dashboard_title": "Hack"}).status_code == 403

    def test_staff_put_zones_403(self, staff):
        assert staff.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": "X"}]}).status_code == 403

    def test_staff_upload_asset_403(self, staff):
        assert staff.post(f"{BASE_URL}/api/assets", json={"data_url": PNG}).status_code == 403

    def test_anon_put_settings_401(self):
        assert requests.put(f"{BASE_URL}/api/settings", json={"dashboard_title": "x"}).status_code == 401


# --- Dashboard layout ---
class TestDashboardLayout:
    def test_reorder_hide_and_title_persist(self, owner):
        layout = [{"key": k, "visible": k != "stat_bookings"} for k in reversed(DASH_KEYS)]
        r = owner.put(f"{BASE_URL}/api/settings", json={"dashboard_title": "TEST_Title", "dashboard": layout})
        assert r.status_code == 200
        g = owner.get(f"{BASE_URL}/api/settings").json()
        assert g["dashboard_title"] == "TEST_Title"
        assert [w["key"] for w in g["dashboard"]] == list(reversed(DASH_KEYS))
        assert [w for w in g["dashboard"] if w["key"] == "stat_bookings"][0]["visible"] is False
        # other tab's fields untouched
        assert g["name"] == "Maison Lumière" and g["hero_badge"] == "Now taking reservations"

    def test_partial_layout_gets_missing_keys_appended(self, owner):
        r = owner.put(f"{BASE_URL}/api/settings", json={"dashboard": [{"key": "floor", "visible": True}]})
        assert r.status_code == 200
        keys = [w["key"] for w in r.json()["dashboard"]]
        assert keys[0] == "floor" and sorted(keys) == sorted(DASH_KEYS)

    def test_invalid_widget_key_422(self, owner):
        assert owner.put(f"{BASE_URL}/api/settings", json={"dashboard": [{"key": "bogus", "visible": True}]}).status_code == 422

    def test_dashboard_hidden_from_public_info(self, owner):
        d = requests.get(f"{BASE_URL}/api/public/info").json()
        assert "dashboard" not in d and "avg_spend" not in d

    def test_restore_layout(self, owner):
        r = owner.put(f"{BASE_URL}/api/settings", json={"dashboard_title": "Today's service", "dashboard": CONTENT_DEFAULTS["dashboard"]})
        assert r.status_code == 200 and r.json()["dashboard_title"] == "Today's service"


# --- Zones ---
class TestZones:
    def test_add_rename_delete_flow(self, owner):
        # create a TEST table in a new zone + reservation in it
        r = owner.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": z, "original": z} for z in DEFAULT_ZONES] + [{"name": "TEST_Garden", "original": None}]})
        assert r.status_code == 200 and r.json()["zones"][-1] == "TEST_Garden"
        assert "TEST_Garden" in requests.get(f"{BASE_URL}/api/public/info").json()["zones"]
        t = owner.post(f"{BASE_URL}/api/tables", json={"name": "TEST_G1", "capacity": 2, "zone": "TEST_Garden"}).json()
        day = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        res = owner.post(f"{BASE_URL}/api/reservations", json={"name": "TEST_ZoneRes", "party_size": 2, "date": day, "time": "19:00", "zone": "TEST_Garden", "phone": "+33TESTZ1"}).json()
        try:
            # rename
            r = owner.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": z, "original": z} for z in DEFAULT_ZONES] + [{"name": "TEST_Patio", "original": "TEST_Garden"}]})
            assert r.status_code == 200 and "TEST_Patio" in r.json()["zones"] and "TEST_Garden" not in r.json()["zones"]
            tt = [x for x in owner.get(f"{BASE_URL}/api/tables").json() if x["id"] == t["id"]][0]
            assert tt["zone"] == "TEST_Patio"
            rr = [x for x in owner.get(f"{BASE_URL}/api/reservations", params={"date": day}).json() if x["id"] == res["id"]][0]
            assert rr["zone"] == "TEST_Patio"
            # delete blocked while table inside
            r = owner.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": z, "original": z} for z in DEFAULT_ZONES]})
            assert r.status_code == 400 and "table" in r.json()["detail"].lower()
            assert "TEST_Patio" in owner.get(f"{BASE_URL}/api/settings").json()["zones"]
        finally:
            owner.delete(f"{BASE_URL}/api/tables/{t['id']}")
            owner.delete(f"{BASE_URL}/api/reservations/{res['id']}")
        r = owner.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": z, "original": z} for z in DEFAULT_ZONES]})
        assert r.status_code == 200 and r.json()["zones"] == DEFAULT_ZONES

    def test_duplicate_names_rejected(self, owner):
        r = owner.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": z, "original": z} for z in DEFAULT_ZONES] + [{"name": "bar"}]})
        assert r.status_code == 400

    def test_empty_list_rejected(self, owner):
        assert owner.put(f"{BASE_URL}/api/settings/zones", json={"zones": []}).status_code == 422

    def test_whitespace_name_rejected(self, owner):
        r = owner.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": z, "original": z} for z in DEFAULT_ZONES] + [{"name": "   "}]})
        ok = r.status_code in (400, 422)
        if not ok:
            owner.put(f"{BASE_URL}/api/settings/zones", json={"zones": [{"name": z, "original": z} for z in DEFAULT_ZONES]})
        assert ok, f"whitespace-only zone accepted: {r.json().get('zones')}"

    def test_public_booking_validates_zone(self):
        day = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        r = requests.post(f"{BASE_URL}/api/public/reservations", json={"name": "TEST_Pub", "email": "test_pub@example.com", "phone": "+33TESTP1", "party_size": 2, "date": day, "time": "19:00", "zone": "Nowhere"})
        assert r.status_code == 400 and "seating" in r.json()["detail"].lower()


# --- Booking page content + assets ---
class TestBookingContent:
    def test_content_saves_and_public_reflects(self, owner):
        r = owner.put(f"{BASE_URL}/api/settings", json={"hero_badge": "", "cta_label": "TEST_Book", "show_steps": False, "show_gallery": False, "show_visit": False, "show_hero_cards": False, "booking_title": "TEST_BT", "visit_title": "TEST_VT"})
        assert r.status_code == 200
        p = requests.get(f"{BASE_URL}/api/public/info").json()
        assert p["hero_badge"] == "" and p["cta_label"] == "TEST_Book" and p["show_steps"] is False and p["show_visit"] is False
        assert p["booking_title"] == "TEST_BT" and p["visit_title"] == "TEST_VT"
        assert p["name"] == "Maison Lumière" and p["slot_start"] == "12:00"  # general untouched

    def test_general_save_does_not_touch_content(self, owner):
        cur = owner.get(f"{BASE_URL}/api/settings").json()
        general = {k: cur[k] for k in ["name", "address", "hours", "phone", "email", "slot_start", "slot_end", "slot_interval", "max_party_online"]}
        r = owner.put(f"{BASE_URL}/api/settings", json=general)
        assert r.status_code == 200 and r.json()["cta_label"] == "TEST_Book" and r.json()["dashboard_title"] == "Today's service"

    def test_empty_cta_rejected(self, owner):
        assert owner.put(f"{BASE_URL}/api/settings", json={"cta_label": ""}).status_code == 422

    def test_upload_and_serve_asset(self, owner):
        r = owner.post(f"{BASE_URL}/api/assets", json={"data_url": PNG})
        assert r.status_code == 200
        url = r.json()["url"]
        assert url.startswith("/api/public/assets/")
        UPLOADED.append(url.rsplit("/", 1)[1])
        g = requests.get(f"{BASE_URL}{url}")
        assert g.status_code == 200 and g.headers["content-type"].startswith("image/png") and g.content[:4] == b"\x89PNG"
        assert owner.put(f"{BASE_URL}/api/settings", json={"hero_image": url}).status_code == 200
        assert requests.get(f"{BASE_URL}/api/public/info").json()["hero_image"] == url

    def test_upload_rejects_bad_mime_and_garbage(self, owner):
        assert owner.post(f"{BASE_URL}/api/assets", json={"data_url": "data:text/plain;base64,aGVsbG8="}).status_code == 400
        assert owner.post(f"{BASE_URL}/api/assets", json={"data_url": "garbage"}).status_code == 400

    def test_missing_asset_404(self):
        assert requests.get(f"{BASE_URL}/api/public/assets/nope-{uuid.uuid4().hex}").status_code == 404

    def test_restore_content(self, owner):
        r = owner.put(f"{BASE_URL}/api/settings", json=CONTENT_DEFAULTS)
        assert r.status_code == 200
        d = r.json()
        for k, v in CONTENT_DEFAULTS.items():
            assert d[k] == v, k
