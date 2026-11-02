# PRD — Restaurant/Bar Management App

## Original problem statement
"build me an app for my restaurant/bar. I want to be able to manage my bookings, tables etc and everything that has to do with a restaurant and a client"

Follow-up: "redesign the app to have a more modern vibe and style. I want it to look like a startup feel look alike. I want primary color white and secondary #120092"

User choices: staff back office + public booking page; email/password login; bookings calendar, live floor plan, guest CRM (history, notes, allergies, VIP); Euro; restaurant name not given (placeholder "Maison Lumière", editable in Settings).

## Architecture
- FastAPI + MongoDB (single server.py), JWT in httpOnly cookies (access 15 min + refresh 7 days), bcrypt, brute-force lockout (X-Forwarded-For IP + email).
- Collections: users, settings, tables, reservations, guests (notes embedded), login_attempts.
- React (CRA + shadcn), routes: `/` public booking, `/staff/login`, `/staff` (Today), `/staff/reservations`, `/staff/floor`, `/staff/guests`, `/staff/settings`.
- Design: white base, #120092 brand, Bricolage Grotesque + Manrope.

## User personas
- Owner (admin): everything plus settings and staff accounts.
- Staff: runs service (reservations, floor, guests); read-only settings.
- Guest (public): requests a table online.

## Core requirements
- Online booking requests (pending) with reference code; staff confirm, assign a table, seat, then finish with a bill total.
- Live floor plan: free, reserved, seated (with timer) and needs cleaning; walk-ins; drag to arrange; add, edit and delete tables.
- Guest CRM: automatically matched by email or phone; visits, lifetime spend, allergies, preferences, VIP, staff notes, history.
- Dashboard for today; settings (restaurant info, booking slots, max online party size); staff accounts.

## Implemented
- 2026-11-02: MVP built (all of the above). Iteration 1 tests: 34/36 backend pass, all frontend flows pass.
- 2026-11-02: Startup-style light redesign (white + #120092), calendar date picker on public page, mobile bottom sheet for the floor plan, bottom-right toasts, € with 2 decimals. Fixed: lockout behind proxy, settings time validation, seated-table edge cases (status change, move, delete), seat window, zone/past-time validation, atomic table move, last_visit date. Iteration 2 tests: 49/50 backend pass (remaining one fixed afterwards), all frontend flows pass.

- 2026-11-02: Owner-only customization (Settings tabs: General, Booking page, Today layout, Seating areas, Team & password). Today page: show/hide, reorder and retitle widgets. Seating areas: add, rename (safe swaps), remove (blocked while tables are in it). Booking page: badge, button label, texts, headings, section toggles, photo uploads (stored in MongoDB `assets`). Iteration 3 tests: 71/72 backend pass; both bugs found were fixed afterwards (rename swap, blank names) and checked with curl.
- 2026-11-02: Reservations date picker is now a 3D rotating drum (spins on arrows, click, mouse wheel, drag/swipe); the reservation list slides in the matching direction.

## Backlog
- P1: Email/SMS booking confirmations to guests
- P1: Replace native date/time inputs in staff screens with the shadcn calendar and 24h time picker
- P2: Menu and per-table orders/bill; daily reports; deposits and payments; table availability check against capacity per slot

## Next tasks
- Confirmation emails to guests; capacity-aware slot availability.
