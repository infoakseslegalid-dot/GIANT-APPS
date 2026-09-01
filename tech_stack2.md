# Tech Stack ali-app (Panduan Migrasi untuk Project Emergent)

Dokumen ini berisi rangkuman teknologi yang digunakan pada aplikasi `ali-app`. Tujuannya adalah sebagai panduan untuk tim/developer yang akan mengerjakan fitur baru di *project* terpisah (emergent) agar _tech stack_-nya selaras, sehingga proses migrasi kembali ke `ali-app` nantinya dapat dilakukan dengan mulus.

## 1. Core Framework & Bahasa Pemrograman
- **Framework Utama:** Next.js (versi 16.1.6)
- **Library UI Utama:** React (versi 19.2.3)
- **Bahasa Pemrograman:** TypeScript
- **Runtime:** Node.js (dengan `tsx` untuk eksekusi file TS)

## 2. Backend & API
- **API Framework:** Hono (`hono` & `@hono/node-server`)
- **Custom Server:** Menggunakan server Node custom (`server.mjs`) yang berjalan berdampingan dengan Next.js.
- **Websocket:** `ws` (digunakan di dalam custom server, contoh: untuk fitur Konsultasi Live).

## 3. Database & ORM
- **Database Utama:** PostgreSQL
- **ORM:** Prisma (`@prisma/client` v6.19.2)


## 4. Authentication & Keamanan
- **Autentikasi:** Auth.js / NextAuth.js (v5 beta: `next-auth@5.0.0-beta.30`)
- **Hashing/Enkripsi:** `bcryptjs`
- **Keamanan Tambahan:** Google reCAPTCHA (`react-google-recaptcha`)

## 5. Styling & Animasi
- **CSS Framework:** Tailwind CSS (v4)
- **Pre-processor:** Sass / SCSS
- **Komponen UI Tambahan:** Base UI (`@base-ui/react`), Radix UI (`@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`)
- **Ikon:** Lucide React (`lucide-react`)
- **Animasi:** 
  - Framer Motion (`framer-motion`)
  - GSAP (`gsap`)
  - Lottie (`@lottiefiles/dotlottie-react`)
- **Scrolling:** Lenis (`lenis` untuk _smooth scrolling_)

## 6. Mobile App (Cross-Platform)
- **Wrapper:** Capacitor (v8)
- Mendukung *build* ke **Android** dan **iOS** (`@capacitor/android`, `@capacitor/ios`).
- **Plugin Capacitor yang digunakan:** Push Notifications, Haptics, Keyboard, Splash Screen, Status Bar, Browser, Network.

## 7. Editor & Form
- **Rich Text Editor:** Tiptap (lengkap dengan berbagai _extensions_ untuk format teks, gambar, dll).

## 8. Utilitas Lainnya
- **Manajemen Tanggal:** `date-fns` & `react-day-picker`
- **Email:** Nodemailer (untuk pengiriman email/notifikasi sistem)
- **Carousel/Slider:** Swiper (`swiper`)
- **Upload/Crop Gambar:** `react-easy-crop`
- **Linter/Formatter:** ESLint

## 9. Docker & Deployment
Aplikasi ini dikontainerisasi menggunakan Docker untuk mempermudah pengembangan dan *deployment* (*production*).
- **Dockerfile Utama:** `Dockerfile` (untuk *build* Next.js/Hono *app*).
- **Dockerfile Database:** `Dockerfile.postgres` (kemungkinan konfigurasi *custom* PostgreSQL/PostGIS).
- **Docker Compose:** Terdapat pengaturan orkestrasi untuk berbagai *environment*:
  - `docker-compose.yml` (konfigurasi dasar)
  - `docker-compose.dev.yml` (untuk mode *development*)
  - `docker-compose.prod.yml` (untuk mode *production*)
- **Entrypoint:** Menggunakan script `docker-entrypoint.sh` saat inisialisasi kontainer.

## 10. Struktur Folder Utama (`/src`)
- `app/` : Router dan halaman utama Next.js (App Router).
- `components/` : Komponen UI yang dapat digunakan kembali (*reusable*).
- `data/` : Logika untuk memanggil API atau database.
- `hooks/` : Custom React Hooks.
- `lib/` : Fungsi utilitas atau konfigurasi pihak ketiga.
- `styles/` : File global CSS/SCSS.
- `types/` : Definisi _interface_ & _type_ TypeScript.

## Kesimpulan & Saran untuk Project Emergent
Untuk memastikan kemudahan migrasi nantinya, pastikan project "emergent" menggunakan setidaknya *core stack* berikut:
1. **Next.js + React 19** menggunakan **TypeScript**.
2. Desain komponen menggunakan **Tailwind CSS v4** (+ Base UI/Radix UI jika butuh komponen kompleks).
3. Jika membutuhkan database dan API, gunakan **Prisma + PostgreSQL** dan bisa membuat *route* API menggunakan **Hono** atau Next.js Route Handlers.
4. Hindari penggunaan pustaka pihak ketiga yang tumpang tindih fungsinya dengan yang sudah ada (misalnya: jika butuh _rich text editor_, usahakan pakai **Tiptap**).
