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
- 2026-11-02: Smooth tab transitions: each staff page fades, rises and un-blurs as it comes in; the sidebar and Settings tab highlights glide between items; Settings tab content slides in. (An exit animation was removed because nested animations left the page blank.)
- 2026-11-02: Staff pages now change like scrolling: going down the menu, the old page moves up and the new one comes in from below; going up reverses it. Built as a small custom page stack (PageStack.js), because framer-motion's AnimatePresence never removed pages that had left.
- 2026-11-03: Public home page simplified to just the booking form plus basic restaurant info (name, tagline, description, hours, address, phone, email, small staff-login link). The photo, steps, gallery and "Visit us" sections were removed, and Settings → Booking page now only edits tagline, description, form heading and form text.
- 2026-11-03: Live availability: GET /api/public/availability. Each active booking holds a table for 90 min; a time is offered online only if, at every moment of the new visit, all bookings active then plus the new party can each get their own fitting table (in the chosen area). POST /api/public/reservations returns 409 if the time is full. Staff can still overbook. Booking form shows only available times. Iteration 4 tests: 18/18 pass. Afterwards: availability made less cautious (bookings that don't overlap each other can share a table), login lockout now also counts per email (10 tries), booking form shown first on mobile.
- 2026-11-03: Menu: owner types the menu in Settings → Menu (categories, items, € prices, descriptions, tags, hide/show, reorder). The public page has Book a table / Menu tabs (?view=menu opens the menu). Iteration 5 tests passed (whitespace-only names were then rejected by the API). The Book/Menu switch now animates: the highlight springs across with a squash, the icon wiggles, and the content slides in with a blur from the side it was picked.
- 2026-11-03: Book/Menu now switch with a push slide (PushSlider.js): both cards sit side by side and the track slides, the height adjusts smoothly, and the card going off screen fades and shrinks. The booking form keeps whatever was typed while the guest looks at the menu.
- 2026-11-03: Swipe left/right on phones (touch only) to switch between Book and Menu, with elastic feedback at the ends. The booking form is now 3 slides with a progress bar: 1 Date & guests (+ area), 2 Time (picking a time moves on automatically), 3 Your details (with a summary and "Change" link). Back/Next buttons; a 409 "fully booked" sends the guest back to the Time slide with refreshed times. Fixed a mobile overflow (grid-cols-1 + min-w-0).

## Backlog
- P1: Email/SMS booking confirmations to guests
- P1: Replace native date/time inputs in staff screens with the shadcn calendar and 24h time picker
- P2: Menu and per-table orders/bill; daily reports; deposits and payments; table availability check against capacity per slot

## Next tasks
- Confirmation emails to guests; capacity-aware slot availability.
