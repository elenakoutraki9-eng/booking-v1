from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import base64
import random
import string
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

JWT_ALGORITHM = "HS256"
TABLE_STATUSES = ["free", "reserved", "seated", "cleaning"]
RES_STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"]
DASHBOARD_KEYS = ["stat_bookings", "stat_covers", "stat_seated", "stat_pending", "stat_revenue", "upcoming", "floor"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def clean(doc):
    if doc:
        doc.pop("_id", None)
        doc.pop("password_hash", None)
    return doc


# ---------- Auth ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(user_id: str, kind: str, delta: timedelta) -> str:
    payload = {"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str):
    response.set_cookie("access_token", make_token(user_id, "access", timedelta(minutes=15)),
                        httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", make_token(user_id, "refresh", timedelta(days=7)),
                        httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    return clean(user)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Owner access required")
    return user


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "x")
    idents = [(f"{ip}:{email}", 5), (f"email:{email}", 10)]
    for ident, limit in idents:
        att = await db.login_attempts.find_one({"identifier": ident})
        if att and att.get("count", 0) >= limit:
            locked_until = datetime.fromisoformat(att["last"]) + timedelta(minutes=15)
            if datetime.now(timezone.utc) < locked_until:
                raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
            await db.login_attempts.delete_one({"identifier": ident})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        for ident, _ in idents:
            await db.login_attempts.update_one({"identifier": ident},
                                               {"$inc": {"count": 1}, "$set": {"last": now_iso()}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_many({"identifier": {"$in": [i for i, _ in idents]}})
    set_auth_cookies(response, user["id"])
    return clean(user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    response.delete_cookie("refresh_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    set_auth_cookies(response, user["id"])
    return clean(user)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


@api.post("/auth/change-password")
async def change_password(body: PasswordChange, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.current_password, full["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


# ---------- Staff accounts (owner only) ----------
class StaffIn(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Literal["admin", "staff"] = "staff"


@api.get("/staff")
async def list_staff(_: dict = Depends(require_admin)):
    return [clean(u) for u in await db.users.find({}).sort("created_at", 1).to_list(500)]


@api.post("/staff")
async def create_staff(body: StaffIn, _: dict = Depends(require_admin)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "A user with this email already exists")
    doc = {"id": new_id(), "name": body.name, "email": email, "role": body.role,
           "password_hash": hash_password(body.password), "created_at": now_iso()}
    await db.users.insert_one(doc)
    return clean(doc)


@api.delete("/staff/{uid}")
async def delete_staff(uid: str, admin: dict = Depends(require_admin)):
    if uid == admin["id"]:
        raise HTTPException(400, "You cannot remove your own account")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# ---------- Settings ----------
DEFAULT_SETTINGS = {
    "key": "main",
    "name": "Maison Lumière",
    "tagline": "Kitchen & Cocktail Bar",
    "description": "Seasonal plates, natural wines and late-night cocktails. Reserve your table below.",
    "address": "[Your street address, City]",
    "phone": "[+00 000 000 000]",
    "email": "[reservations@yourrestaurant.com]",
    "hours": "Tue–Sun · 12:00–15:00 & 18:00–23:30",
    "slot_start": "12:00",
    "slot_end": "22:30",
    "slot_interval": 30,
    "max_party_online": 8,
    "avg_spend": 45,
    "zones": ["Main Dining", "Bar", "Terrace"],
    "dashboard_title": "Today's service",
    "dashboard": [{"key": k, "visible": True} for k in DASHBOARD_KEYS],
    "hero_badge": "Now taking reservations",
    "hero_image": "/images/hero.jpg",
    "cta_label": "Reserve a table",
    "show_hero_cards": True,
    "booking_title": "Book in under a minute.",
    "booking_text": "Pick a date, time and party size. Our team reviews every request and confirms by email or phone.",
    "show_steps": True,
    "show_gallery": True,
    "gallery_1": "/images/dish.jpg",
    "gallery_2": "/images/bar.jpg",
    "show_visit": True,
    "visit_title": "Find your way here.",
}


class DashboardWidget(BaseModel):
    key: Literal["stat_bookings", "stat_covers", "stat_seated", "stat_pending", "stat_revenue", "upcoming", "floor"]
    visible: bool = True


class SettingsIn(BaseModel):
    name: str = Field("Restaurant", min_length=1, max_length=80)
    tagline: str = ""
    description: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    hours: str = ""
    slot_start: str = Field("12:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    slot_end: str = Field("22:30", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    slot_interval: int = Field(30, ge=15, le=120)
    max_party_online: int = Field(8, ge=1, le=50)
    avg_spend: float = Field(45, ge=0)
    dashboard_title: str = Field("Today's service", max_length=80)
    dashboard: Optional[List[DashboardWidget]] = None
    hero_badge: str = Field("", max_length=80)
    hero_image: str = Field("", max_length=500)
    cta_label: str = Field("Reserve a table", min_length=1, max_length=40)
    show_hero_cards: bool = True
    booking_title: str = Field("", max_length=120)
    booking_text: str = Field("", max_length=600)
    show_steps: bool = True
    show_gallery: bool = True
    gallery_1: str = Field("", max_length=500)
    gallery_2: str = Field("", max_length=500)
    show_visit: bool = True
    visit_title: str = Field("", max_length=120)


class ZoneItem(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    original: Optional[str] = None


class ZonesIn(BaseModel):
    zones: List[ZoneItem] = Field(min_length=1)


async def get_settings_doc():
    s = await db.settings.find_one({"key": "main"})
    if not s:
        s = dict(DEFAULT_SETTINGS)
        await db.settings.insert_one(dict(s))
    s = {**DEFAULT_SETTINGS, **clean(s)}
    known = [w for w in s["dashboard"] if w["key"] in DASHBOARD_KEYS]
    have = {w["key"] for w in known}
    s["dashboard"] = known + [{"key": k, "visible": True} for k in DASHBOARD_KEYS if k not in have]
    return s


def build_slots(s):
    h1, m1 = map(int, s["slot_start"].split(":"))
    h2, m2 = map(int, s["slot_end"].split(":"))
    t, end, out = h1 * 60 + m1, h2 * 60 + m2, []
    while t <= end:
        out.append(f"{t // 60:02d}:{t % 60:02d}")
        t += s["slot_interval"]
    return out


@api.get("/public/info")
async def public_info():
    s = await get_settings_doc()
    s["slots"] = build_slots(s)
    for k in ("avg_spend", "dashboard", "dashboard_title"):
        s.pop(k, None)
    return s


@api.get("/settings")
async def get_settings(_: dict = Depends(get_current_user)):
    return await get_settings_doc()


@api.put("/settings")
async def update_settings(body: SettingsIn, _: dict = Depends(require_admin)):
    if body.slot_start > body.slot_end:
        raise HTTPException(400, "First booking time must be before the last booking time")
    await get_settings_doc()
    data = body.model_dump(exclude_unset=True)
    if data.get("dashboard") is None:
        data.pop("dashboard", None)
    await db.settings.update_one({"key": "main"}, {"$set": data})
    return await get_settings_doc()


@api.put("/settings/zones")
async def update_zones(body: ZonesIn, _: dict = Depends(require_admin)):
    names = [z.name.strip() for z in body.zones]
    if any(not n for n in names):
        raise HTTPException(400, "Seating area names cannot be empty")
    if len(set(n.lower() for n in names)) != len(names):
        raise HTTPException(400, "Seating area names must be unique")
    current = (await get_settings_doc())["zones"]
    kept = {z.original for z in body.zones if z.original} | set(names)
    for gone in [c for c in current if c not in kept]:
        n = await db.tables.count_documents({"zone": gone})
        if n:
            raise HTTPException(400, f"Move the {n} table(s) out of '{gone}' before removing it")
    renames = [(z.original, z.name.strip()) for z in body.zones if z.original and z.original != z.name.strip()]
    for coll in (db.tables, db.reservations):
        for old, _new in renames:
            await coll.update_many({"zone": old}, {"$set": {"zone": f"__rename__{old}"}})
        for old, new in renames:
            await coll.update_many({"zone": f"__rename__{old}"}, {"$set": {"zone": new}})
    await db.settings.update_one({"key": "main"}, {"$set": {"zones": names}})
    return await get_settings_doc()


class AssetIn(BaseModel):
    data_url: str


@api.post("/assets")
async def upload_asset(body: AssetIn, _: dict = Depends(require_admin)):
    try:
        header, b64 = body.data_url.split(",", 1)
        mime = header.split(";")[0].split(":")[1]
        raw = base64.b64decode(b64)
    except (ValueError, IndexError):
        raise HTTPException(400, "Invalid image")
    if mime not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Use a JPG, PNG or WEBP image")
    if len(raw) > 3 * 1024 * 1024:
        raise HTTPException(400, "Image is too large (max 3 MB)")
    aid = new_id()
    await db.assets.insert_one({"id": aid, "mime": mime, "data": raw, "created_at": now_iso()})
    return {"url": f"/api/public/assets/{aid}"}


@api.get("/public/assets/{aid}")
async def get_asset(aid: str):
    a = await db.assets.find_one({"id": aid})
    if not a:
        raise HTTPException(404, "Not found")
    return Response(content=a["data"], media_type=a["mime"], headers={"Cache-Control": "public, max-age=31536000"})


# ---------- Guests ----------
class GuestIn(BaseModel):
    name: str = Field(min_length=1)
    email: Optional[str] = ""
    phone: Optional[str] = ""
    allergies: Optional[str] = ""
    preferences: Optional[str] = ""
    vip: bool = False
    tags: List[str] = []


class GuestUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    allergies: Optional[str] = None
    preferences: Optional[str] = None
    vip: Optional[bool] = None
    tags: Optional[List[str]] = None


class NoteIn(BaseModel):
    text: str = Field(min_length=1)


async def find_or_create_guest(name, email, phone):
    email = (email or "").strip().lower()
    phone = (phone or "").strip()
    q = []
    if email:
        q.append({"email": email})
    if phone:
        q.append({"phone": phone})
    if q:
        g = await db.guests.find_one({"$or": q})
        if g:
            return g
    g = {"id": new_id(), "name": name, "email": email, "phone": phone, "allergies": "", "preferences": "",
         "vip": False, "tags": [], "notes": [], "visits": 0, "total_spend": 0, "last_visit": None,
         "created_at": now_iso()}
    await db.guests.insert_one(dict(g))
    return g


@api.get("/guests")
async def list_guests(q: str = "", vip: bool = False, _: dict = Depends(get_current_user)):
    filt = {}
    if q:
        rx = {"$regex": q, "$options": "i"}
        filt["$or"] = [{"name": rx}, {"email": rx}, {"phone": rx}]
    if vip:
        filt["vip"] = True
    return [clean(g) for g in await db.guests.find(filt).sort("name", 1).to_list(1000)]


@api.post("/guests")
async def create_guest(body: GuestIn, _: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["email"] = (doc["email"] or "").lower()
    doc.update({"id": new_id(), "notes": [], "visits": 0, "total_spend": 0, "last_visit": None, "created_at": now_iso()})
    await db.guests.insert_one(dict(doc))
    return clean(doc)


@api.get("/guests/{gid}")
async def get_guest(gid: str, _: dict = Depends(get_current_user)):
    return await fetch_guest(gid)


async def fetch_guest(gid: str):
    g = await db.guests.find_one({"id": gid})
    if not g:
        raise HTTPException(404, "Guest not found")
    g = clean(g)
    g["history"] = [clean(r) for r in await db.reservations.find({"guest_id": gid}).sort([("date", -1), ("time", -1)]).to_list(500)]
    return g


@api.patch("/guests/{gid}")
async def update_guest(gid: str, body: GuestUpdate, _: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "email" in upd:
        upd["email"] = upd["email"].lower()
    await db.guests.update_one({"id": gid}, {"$set": upd})
    if "name" in upd:
        await db.reservations.update_many({"guest_id": gid}, {"$set": {"guest_name": upd["name"]}})
    return await fetch_guest(gid)


@api.post("/guests/{gid}/notes")
async def add_note(gid: str, body: NoteIn, user: dict = Depends(get_current_user)):
    note = {"id": new_id(), "text": body.text, "author": user.get("name") or user["email"], "created_at": now_iso()}
    await db.guests.update_one({"id": gid}, {"$push": {"notes": note}})
    return note


@api.delete("/guests/{gid}/notes/{nid}")
async def delete_note(gid: str, nid: str, _: dict = Depends(get_current_user)):
    await db.guests.update_one({"id": gid}, {"$pull": {"notes": {"id": nid}}})
    return {"ok": True}


@api.delete("/guests/{gid}")
async def delete_guest(gid: str, _: dict = Depends(require_admin)):
    await db.guests.delete_one({"id": gid})
    return {"ok": True}


# ---------- Tables ----------
class TableIn(BaseModel):
    name: str = Field(min_length=1)
    capacity: int = Field(ge=1, le=30)
    zone: str = "Main Dining"
    shape: Literal["round", "square", "rect"] = "round"
    x: float = 10
    y: float = 10


class TableUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    zone: Optional[str] = None
    shape: Optional[Literal["round", "square", "rect"]] = None
    x: Optional[float] = None
    y: Optional[float] = None
    status: Optional[Literal["free", "reserved", "seated", "cleaning"]] = None


class WalkInIn(BaseModel):
    name: str = "Walk-in"
    party_size: int = Field(ge=1, le=30)
    phone: Optional[str] = ""


@api.get("/tables")
async def list_tables(_: dict = Depends(get_current_user)):
    tables = [clean(t) for t in await db.tables.find({}).sort("name", 1).to_list(500)]
    res_ids = [t["current_reservation_id"] for t in tables if t.get("current_reservation_id")]
    res_map = {}
    if res_ids:
        for r in await db.reservations.find({"id": {"$in": res_ids}}).to_list(500):
            res_map[r["id"]] = clean(r)
    for t in tables:
        t["current_reservation"] = res_map.get(t.get("current_reservation_id"))
    return tables


async def check_zone(zone):
    if zone is not None and zone not in (await get_settings_doc())["zones"]:
        raise HTTPException(400, "Unknown seating area")


@api.post("/tables")
async def create_table(body: TableIn, _: dict = Depends(get_current_user)):
    await check_zone(body.zone)
    doc = body.model_dump()
    doc.update({"id": new_id(), "status": "free", "current_reservation_id": None, "seated_at": None})
    await db.tables.insert_one(dict(doc))
    return clean(doc)


@api.patch("/tables/{tid}")
async def update_table(tid: str, body: TableUpdate, _: dict = Depends(get_current_user)):
    t = await db.tables.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Table not found")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "zone" in upd and upd["zone"] != t.get("zone"):
        await check_zone(upd["zone"])
    new_status = upd.get("status")
    if new_status and new_status != "seated":
        was_seated = t.get("status") == "seated"
        if was_seated and t.get("current_reservation_id"):
            await complete_reservation(t["current_reservation_id"])
        if new_status != "reserved" or was_seated:
            upd.update({"current_reservation_id": None, "seated_at": None})
    await db.tables.update_one({"id": tid}, {"$set": upd})
    return clean(await db.tables.find_one({"id": tid}))


@api.delete("/tables/{tid}")
async def delete_table(tid: str, _: dict = Depends(get_current_user)):
    t = await db.tables.find_one({"id": tid})
    if t and t.get("status") == "seated" and t.get("current_reservation_id"):
        await complete_reservation(t["current_reservation_id"])
    await db.tables.delete_one({"id": tid})
    await db.reservations.update_many({"table_id": tid}, {"$set": {"table_id": None}})
    return {"ok": True}


@api.post("/tables/{tid}/walk-in")
async def walk_in(tid: str, body: WalkInIn, _: dict = Depends(get_current_user)):
    t = await db.tables.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Table not found")
    if t["status"] != "free":
        raise HTTPException(400, "Table is not free")
    guest = await find_or_create_guest(body.name, "", body.phone) if body.phone else None
    now = datetime.now()
    r = {"id": new_id(), "ref": make_ref(), "guest_id": guest["id"] if guest else None, "guest_name": body.name,
         "email": "", "phone": body.phone or "", "party_size": body.party_size, "date": now.strftime("%Y-%m-%d"),
         "time": now.strftime("%H:%M"), "zone": t.get("zone"), "notes": "", "source": "walk-in", "status": "seated",
         "table_id": tid, "duration": 90, "created_at": now_iso(), "seated_at": now_iso()}
    await db.reservations.insert_one(dict(r))
    await db.tables.update_one({"id": tid}, {"$set": {"status": "seated", "current_reservation_id": r["id"], "seated_at": now_iso()}})
    return clean(r)


# ---------- Reservations ----------
def make_ref():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


class PublicReservationIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=40)
    party_size: int = Field(ge=1, le=50)
    date: str
    time: str
    zone: Optional[str] = ""
    notes: Optional[str] = Field("", max_length=1000)


class ReservationIn(BaseModel):
    name: str = Field(min_length=1)
    email: Optional[str] = ""
    phone: Optional[str] = ""
    party_size: int = Field(ge=1, le=50)
    date: str
    time: str
    zone: Optional[str] = ""
    notes: Optional[str] = ""
    table_id: Optional[str] = None
    status: Literal["pending", "confirmed"] = "confirmed"
    duration: int = 90


class ReservationUpdate(BaseModel):
    party_size: Optional[int] = None
    date: Optional[str] = None
    time: Optional[str] = None
    zone: Optional[str] = None
    notes: Optional[str] = None
    table_id: Optional[str] = None
    status: Optional[Literal["pending", "confirmed", "seated", "completed", "cancelled", "no_show"]] = None
    spend: Optional[float] = None
    duration: Optional[int] = None


def validate_date_time(date: str, time: str):
    try:
        datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
    except ValueError:
        raise HTTPException(400, "Invalid date or time")


async def complete_reservation(rid: str, spend: Optional[float] = None):
    r = await db.reservations.find_one({"id": rid})
    if not r or r["status"] == "completed":
        return
    upd = {"status": "completed", "completed_at": now_iso()}
    if spend is not None:
        upd["spend"] = spend
    await db.reservations.update_one({"id": rid}, {"$set": upd})
    if r.get("guest_id"):
        await db.guests.update_one({"id": r["guest_id"]}, {"$inc": {"visits": 1, "total_spend": spend or r.get("spend") or 0},
                                                           "$set": {"last_visit": min(r["date"], datetime.now().strftime("%Y-%m-%d"))}})


VISIT_MINUTES = 90
ACTIVE_STATUSES = ["pending", "confirmed", "seated"]


def to_min(hm):
    h, m = map(int, hm.split(":"))
    return h * 60 + m


def can_seat(tables, overlapping, party_size, zone):
    """Bipartite match: every overlapping booking plus the new party gets its own table."""
    by_id = {t["id"]: t for t in tables}
    reqs = []
    for r in overlapping:
        if r.get("table_id") in by_id:
            reqs.append([r["table_id"]])
        else:
            reqs.append([t["id"] for t in tables if t["capacity"] >= r["party_size"]])
    reqs.append([t["id"] for t in tables if t["capacity"] >= party_size and (not zone or t.get("zone") == zone)])
    owner = {}

    def assign(i, seen):
        for tid in reqs[i]:
            if tid in seen:
                continue
            seen.add(tid)
            if tid not in owner or assign(owner[tid], seen):
                owner[tid] = i
                return True
        return False

    new_idx = len(reqs) - 1
    for i in range(new_idx):
        assign(i, set())
    return assign(new_idx, set())


async def slot_availability(s, date, party_size, zone):
    tables = await db.tables.find({}, {"_id": 0, "id": 1, "capacity": 1, "zone": 1}).to_list(500)
    booked = await db.reservations.find({"date": date, "status": {"$in": ACTIVE_STATUSES}},
                                        {"_id": 0, "time": 1, "duration": 1, "party_size": 1, "table_id": 1}).to_list(2000)
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    out = []
    for slot in build_slots(s):
        if date < today or (date == today and slot <= now.strftime("%H:%M")):
            continue
        start = to_min(slot)
        end = start + VISIT_MINUTES
        spans = [(to_min(r["time"]), to_min(r["time"]) + (r.get("duration") or VISIT_MINUTES), r) for r in booked]
        points = [start] + [a for a, _, _ in spans if start < a < end]
        ok = all(can_seat(tables, [r for a, b, r in spans if a <= p < b], party_size, zone) for p in points)
        out.append({"time": slot, "available": ok})
    return out


@api.get("/public/availability")
async def public_availability(date: str, party_size: int, zone: str = ""):
    validate_date_time(date, "12:00")
    s = await get_settings_doc()
    if party_size < 1 or party_size > s["max_party_online"]:
        raise HTTPException(400, f"Online bookings are for 1 to {s['max_party_online']} guests")
    return {"date": date, "party_size": party_size, "slots": await slot_availability(s, date, party_size, zone if zone in s["zones"] else "")}


@api.post("/public/reservations")
async def public_reserve(body: PublicReservationIn):
    validate_date_time(body.date, body.time)
    s = await get_settings_doc()
    if body.party_size > s["max_party_online"]:
        raise HTTPException(400, f"For parties larger than {s['max_party_online']}, please call us.")
    now = datetime.now()
    if body.date < now.strftime("%Y-%m-%d"):
        raise HTTPException(400, "Please choose a date in the future")
    if body.time not in build_slots(s) or (body.date == now.strftime("%Y-%m-%d") and body.time <= now.strftime("%H:%M")):
        raise HTTPException(400, "Please choose one of the available times")
    if body.zone and body.zone not in s["zones"]:
        raise HTTPException(400, "Unknown seating area")
    slots = {x["time"]: x["available"] for x in await slot_availability(s, body.date, body.party_size, body.zone or "")}
    if not slots.get(body.time):
        raise HTTPException(409, "Sorry, that time is fully booked. Please choose another time.")
    guest = await find_or_create_guest(body.name, body.email, body.phone)
    r = {"id": new_id(), "ref": make_ref(), "guest_id": guest["id"], "guest_name": body.name, "email": body.email.lower(),
         "phone": body.phone, "party_size": body.party_size, "date": body.date, "time": body.time, "zone": body.zone or "",
         "notes": body.notes or "", "source": "online", "status": "pending", "table_id": None, "duration": 90,
         "created_at": now_iso()}
    await db.reservations.insert_one(dict(r))
    return {"ref": r["ref"], "date": r["date"], "time": r["time"], "party_size": r["party_size"], "name": r["guest_name"], "status": "pending"}


@api.get("/reservations")
async def list_reservations(date: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None,
                            status: Optional[str] = None, q: str = "", _: dict = Depends(get_current_user)):
    filt = {}
    if date:
        filt["date"] = date
    elif start and end:
        filt["date"] = {"$gte": start, "$lte": end}
    if status:
        filt["status"] = {"$in": status.split(",")}
    if q:
        rx = {"$regex": q, "$options": "i"}
        filt["$or"] = [{"guest_name": rx}, {"email": rx}, {"phone": rx}, {"ref": rx}]
    items = [clean(r) for r in await db.reservations.find(filt).sort([("date", 1), ("time", 1)]).to_list(2000)]
    gids = list({r["guest_id"] for r in items if r.get("guest_id")})
    gmap = {g["id"]: g for g in await db.guests.find({"id": {"$in": gids}}).to_list(2000)}
    tmap = {t["id"]: t["name"] for t in await db.tables.find({}).to_list(500)}
    for r in items:
        g = gmap.get(r.get("guest_id"))
        r["vip"] = bool(g and g.get("vip"))
        r["allergies"] = (g or {}).get("allergies", "")
        r["table_name"] = tmap.get(r.get("table_id"))
    return items


@api.post("/reservations")
async def create_reservation(body: ReservationIn, _: dict = Depends(get_current_user)):
    validate_date_time(body.date, body.time)
    guest = await find_or_create_guest(body.name, body.email, body.phone)
    r = {"id": new_id(), "ref": make_ref(), "guest_id": guest["id"], "guest_name": body.name,
         "email": (body.email or "").lower(), "phone": body.phone or "", "party_size": body.party_size,
         "date": body.date, "time": body.time, "zone": body.zone or "", "notes": body.notes or "", "source": "staff",
         "status": body.status, "table_id": body.table_id, "duration": body.duration, "created_at": now_iso()}
    await db.reservations.insert_one(dict(r))
    return clean(r)


@api.patch("/reservations/{rid}")
async def update_reservation(rid: str, body: ReservationUpdate, _: dict = Depends(get_current_user)):
    r = await db.reservations.find_one({"id": rid})
    if not r:
        raise HTTPException(404, "Reservation not found")
    upd = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if "date" in upd or "time" in upd:
        validate_date_time(upd.get("date", r["date"]), upd.get("time", r["time"]))
    new_status = upd.get("status")
    table_id = upd.get("table_id", r.get("table_id"))
    if r["status"] == "seated" and "table_id" in upd and upd["table_id"] != r.get("table_id") and new_status in (None, "seated"):
        if not upd["table_id"]:
            raise HTTPException(400, "A seated booking needs a table")
        nt = await db.tables.find_one({"id": upd["table_id"]})
        if not nt:
            raise HTTPException(404, "Table not found")
        if nt["status"] == "seated" and nt.get("current_reservation_id") != rid:
            raise HTTPException(400, f"{nt['name']} is already occupied")
        if r.get("table_id"):
            await db.tables.update_one({"id": r["table_id"], "current_reservation_id": rid},
                                       {"$set": {"status": "cleaning", "current_reservation_id": None, "seated_at": None}})
        new_status = upd["status"] = "seated"
    if new_status == "seated":
        if not table_id:
            raise HTTPException(400, "Assign a table before seating")
        res_day = datetime.strptime(upd.get("date", r["date"]), "%Y-%m-%d").date()
        if abs((res_day - datetime.now().date()).days) > 1:
            raise HTTPException(400, "Only today's bookings can be seated")
        t = await db.tables.find_one({"id": table_id})
        if not t:
            raise HTTPException(404, "Table not found")
        if t["status"] == "seated" and t.get("current_reservation_id") != rid:
            raise HTTPException(400, f"{t['name']} is already occupied")
        upd["seated_at"] = now_iso()
        await db.tables.update_one({"id": table_id}, {"$set": {"status": "seated", "current_reservation_id": rid, "seated_at": now_iso()}})
    if new_status == "completed":
        spend = upd.pop("spend", None)
        upd.pop("status")
        if upd:
            await db.reservations.update_one({"id": rid}, {"$set": upd})
        await complete_reservation(rid, spend)
        if table_id:
            await db.tables.update_one({"id": table_id, "current_reservation_id": rid},
                                       {"$set": {"status": "cleaning", "current_reservation_id": None, "seated_at": None}})
        return clean(await db.reservations.find_one({"id": rid}))
    if new_status in ("cancelled", "no_show") and r.get("table_id"):
        await db.tables.update_one({"id": r["table_id"], "current_reservation_id": rid},
                                   {"$set": {"status": "free", "current_reservation_id": None, "seated_at": None}})
    await db.reservations.update_one({"id": rid}, {"$set": upd})
    return clean(await db.reservations.find_one({"id": rid}))


@api.delete("/reservations/{rid}")
async def delete_reservation(rid: str, _: dict = Depends(get_current_user)):
    await db.tables.update_many({"current_reservation_id": rid},
                                {"$set": {"status": "free", "current_reservation_id": None, "seated_at": None}})
    await db.reservations.delete_one({"id": rid})
    return {"ok": True}


# ---------- Dashboard ----------
@api.get("/dashboard")
async def dashboard(date: Optional[str] = None, _: dict = Depends(get_current_user)):
    date = date or datetime.now().strftime("%Y-%m-%d")
    res = await db.reservations.find({"date": date}).to_list(2000)
    active = [r for r in res if r["status"] not in ("cancelled", "no_show")]
    tables = await db.tables.find({}).to_list(500)
    counts = {s: 0 for s in TABLE_STATUSES}
    for t in tables:
        counts[t["status"]] = counts.get(t["status"], 0) + 1
    seated_covers = sum(r["party_size"] for r in res if r["status"] == "seated")
    return {
        "date": date,
        "bookings": len(active),
        "covers": sum(r["party_size"] for r in active),
        "pending": len([r for r in res if r["status"] == "pending"]),
        "seated_covers": seated_covers,
        "no_shows": len([r for r in res if r["status"] == "no_show"]),
        "revenue": sum((r.get("spend") or 0) for r in res if r["status"] == "completed"),
        "tables": counts,
        "total_tables": len(tables),
        "pending_total": await db.reservations.count_documents({"status": "pending", "date": {"$gte": datetime.now().strftime("%Y-%m-%d")}}),
    }


# ---------- Startup ----------
SEED_TABLES = [
    ("T1", 2, "Main Dining", "round", 8, 12), ("T2", 2, "Main Dining", "round", 22, 12),
    ("T3", 4, "Main Dining", "square", 36, 12), ("T4", 4, "Main Dining", "square", 8, 40),
    ("T5", 6, "Main Dining", "rect", 24, 40), ("T6", 8, "Main Dining", "rect", 8, 68),
    ("B1", 2, "Bar", "round", 62, 12), ("B2", 2, "Bar", "round", 76, 12), ("B3", 4, "Bar", "square", 62, 40),
    ("P1", 4, "Terrace", "square", 62, 70), ("P2", 4, "Terrace", "square", 78, 70),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.reservations.create_index("date")
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({"id": new_id(), "email": admin_email, "name": "Owner", "role": "admin",
                                   "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]), "created_at": now_iso()})
    await get_settings_doc()
    if await db.tables.count_documents({}) == 0:
        await db.tables.insert_many([{"id": new_id(), "name": n, "capacity": c, "zone": z, "shape": s, "x": x, "y": y,
                                      "status": "free", "current_reservation_id": None, "seated_at": None}
                                     for n, c, z, s, x, y in SEED_TABLES])


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ["FRONTEND_URL"]],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
