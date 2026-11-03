# Iteration 5: Menu - GET/PUT /api/menu (auth/roles, validation), GET /api/public/menu filtering
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER = {"email": "gonabip117@digeros.com", "password": "Maison-Owner-2026"}


@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=OWNER)
    if r.status_code != 200:
        pytest.skip("owner login failed")
    yield s
    s.put(f"{BASE_URL}/api/menu", json={"categories": []})


@pytest.fixture(scope="module")
def staff(owner):
    email = f"test_menu_{uuid.uuid4().hex[:6]}@example.com"
    r = owner.post(f"{BASE_URL}/api/staff", json={"name": "TEST_MenuStaff", "email": email, "password": "Staff-Pass-123", "role": "staff"})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    s = requests.Session()
    assert s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Staff-Pass-123"}).status_code == 200
    yield s
    owner.delete(f"{BASE_URL}/api/staff/{sid}")


MENU = {"categories": [
    {"name": " TEST_Starters ", "description": "served 12-15", "items": [
        {"name": "TEST_Soup", "description": "Tomato", "price": 7.5, "tags": ["vegetarian", "vegan"]},
        {"name": "TEST_Hidden", "price": 9, "available": False},
        {"name": "TEST_NoPrice"},
    ]},
    {"name": "TEST_Secret", "items": [{"name": "TEST_H2", "available": False}]},
    {"name": "TEST_Empty", "items": []},
    {"name": "TEST_Drinks", "items": [{"name": "TEST_Negroni", "price": 12, "tags": ["signature", "spicy", "gluten_free"]}]},
]}


class TestMenuAuth:
    def test_anon_get_401(self):
        assert requests.get(f"{BASE_URL}/api/menu").status_code == 401

    def test_anon_put_401(self):
        assert requests.put(f"{BASE_URL}/api/menu", json={"categories": []}).status_code == 401

    def test_staff_get_ok(self, staff):
        r = staff.get(f"{BASE_URL}/api/menu")
        assert r.status_code == 200 and "categories" in r.json()

    def test_staff_put_403(self, staff):
        assert staff.put(f"{BASE_URL}/api/menu", json={"categories": []}).status_code == 403


class TestMenuCrud:
    def test_put_and_persist(self, owner):
        r = owner.put(f"{BASE_URL}/api/menu", json=MENU)
        assert r.status_code == 200, r.text
        cats = r.json()["categories"]
        assert len(cats) == 4
        assert cats[0]["name"] == "TEST_Starters"
        assert all(isinstance(c["id"], str) and c["id"] for c in cats)
        assert all(i["id"] for c in cats for i in c["items"])
        assert cats[0]["items"][2]["price"] is None
        g = owner.get(f"{BASE_URL}/api/menu").json()["categories"]
        assert [c["id"] for c in g] == [c["id"] for c in cats]
        assert g[0]["items"][0]["tags"] == ["vegetarian", "vegan"]
        assert "_id" not in str(g)

    def test_ids_preserved_on_resave(self, owner):
        cats = owner.get(f"{BASE_URL}/api/menu").json()["categories"]
        r = owner.put(f"{BASE_URL}/api/menu", json={"categories": list(reversed(cats))})
        assert r.status_code == 200
        out = r.json()["categories"]
        assert [c["id"] for c in out] == [c["id"] for c in reversed(cats)]

    def test_public_filtering(self, owner):
        owner.put(f"{BASE_URL}/api/menu", json=MENU)
        r = requests.get(f"{BASE_URL}/api/public/menu")
        assert r.status_code == 200
        cats = r.json()["categories"]
        names = [c["name"] for c in cats]
        assert names == ["TEST_Starters", "TEST_Drinks"], names
        items = [i["name"] for i in cats[0]["items"]]
        assert items == ["TEST_Soup", "TEST_NoPrice"]

    def test_negative_price_422(self, owner):
        r = owner.put(f"{BASE_URL}/api/menu", json={"categories": [{"name": "X", "items": [{"name": "Y", "price": -1}]}]})
        assert r.status_code == 422

    def test_blank_names_422(self, owner):
        assert owner.put(f"{BASE_URL}/api/menu", json={"categories": [{"name": "", "items": []}]}).status_code == 422
        assert owner.put(f"{BASE_URL}/api/menu", json={"categories": [{"name": "X", "items": [{"name": ""}]}]}).status_code == 422

    def test_bad_tag_422(self, owner):
        r = owner.put(f"{BASE_URL}/api/menu", json={"categories": [{"name": "X", "items": [{"name": "Y", "tags": ["halal"]}]}]})
        assert r.status_code == 422

    def test_whitespace_name(self, owner):
        # whitespace-only name passes min_length then is stripped -> report if stored blank
        r = owner.put(f"{BASE_URL}/api/menu", json={"categories": [{"name": "   ", "items": [{"name": "  "}]}]})
        print("whitespace status", r.status_code, r.text[:200])
        assert r.status_code == 422, "whitespace-only names accepted and stored as empty strings"

    def test_reset_empty(self, owner):
        r = owner.put(f"{BASE_URL}/api/menu", json={"categories": []})
        assert r.status_code == 200 and r.json()["categories"] == []
        assert requests.get(f"{BASE_URL}/api/public/menu").json()["categories"] == []
