# Auth testing
- Users stored in `users` collection with string `id`, bcrypt `password_hash` ($2b$).
- Login: POST /api/auth/login {email,password} -> sets httpOnly access_token + refresh_token cookies, returns user.
- GET /api/auth/me with cookies returns user. POST /api/auth/refresh issues new cookies. POST /api/auth/logout clears.
- 5 failed attempts per ip:email -> 429 for 15 minutes.
- Credentials: see /app/memory/test_credentials.md
