# Auth Testing Playbook — ALI Workspace

Auth: custom email/password + JWT (httpOnly cookie `access_token`, fallback Bearer header).

## Kredensial
Lihat /app/memory/test_credentials.md. Admin: info.akseslegal.id@gmail.com / Admin123!

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "super_admin"}).pretty()
db.users.findOne({role: "super_admin"}, {password_hash: 1})
```
Verifikasi: hash bcrypt diawali `$2b$`, index unik di users.email, index login_attempts.identifier.

## Step 2: API Testing
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"info.akseslegal.id@gmail.com","password":"Admin123!"}'
cat cookies.txt
curl -b cookies.txt http://localhost:8001/api/auth/me
```
Login harus mengembalikan objek user + token, dan set cookie `access_token` + `refresh_token`. `/me` mengembalikan user yang sama.

## Step 3: Proteksi
- `curl http://localhost:8001/api/users` tanpa cookie → 401.
- Login salah 5x → 429 (lockout 15 menit).
- `POST /api/users` sebagai staff → 403.
