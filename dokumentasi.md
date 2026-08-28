 ### 1. Mengenai Proyek Ini (Overview)                                                                                                                      
                                                                                                                                                             
  Proyek ini adalah ALI Workspace (Akses Legal Indonesia Workspace), sebuah sistem manajemen pekerjaan dan operasional internal berbasis Kanban ala Trello   
  yang dirancang khusus untuk alur kerja legalitas & perizinan.                                                                                              
                                                                                                                                                             
  • Arsitektur Utama:                                                                                                                                        
      • Backend (backend): FastAPI (Python), MongoDB (Motor async driver), JWT Authentication (HttpOnly Cookie + Bearer), WebSockets real-time               
      (server.py:28-49), serta seeding data otomatis.                                                                                                        
      • Frontend (frontend): React 19, CRACO, Tailwind CSS, Radix UI / shadcn components, @dnd-kit (drag & drop), @tanstack/react-query, dan Sonner toast.   
  • Fitur-Fitur Kunci:                                                                                                                                       
      • Kanban Board Multi-Divisi: Board untuk CS (Dedes, Devi, Dewi, Julia), Admin Draf Input, Admin Pajak, Admin Perizinan, dan Desain & Konten.           
      • Central Work Item & Card Mirroring: Satu pekerjaan (work item) bisa di-mirror ke board divisi lain secara 2 arah dan tersinkronisasi real-time.      
      • Bank Data: Manajemen inbox pekerjaan per divisi, klaim pekerjaan oleh staff, dan workload monitoring.                                                
      • Board Harian & Global Skor: Alur HARI 1–7 dengan validasi syarat berkas (stage gates) dan auto-advance harian.                                       
      • Otomasi Alur Kerja (Butler-like Rules): Trigger otomatis saat kartu dibuat/dipindah/di-mirror.                                                       
      • Sistem Hak Akses (RBAC): super_admin, admin, supervisor, staff, dan viewer.                                                                          
                                                                                                                                                             
  ──────                                                                                                                                                     
  ### 2. Apa Saja yang Perlu Di-Install (Prerequisites)                                                                                                      
                                                                                                                                                             
  Untuk menjalankan proyek ini di komputer Anda (Windows), berikut hal yang wajib disiapkan:                                                                 
                                                                                                                                                             
   Komponen      │ Status di Komputer Anda                         │ Rekomendasi / Yang Harus Di-install
  ───────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────
   Node.js & npm │ ✅ Sudah terpasang (Node v24.15.0, npm 11.15.0) │ Sudah siap. Disarankan install Yarn: npm install -g yarn
   Python        │ ❌ Belum terkonfigurasi di PATH                 │ Install Python 3.10 atau 3.11 dari python.org[1]. (⚠️ PENTING: Centang opsi "Add
                 │                                                 │ python.exe to PATH" saat instalasi)
   MongoDB       │ ❌ Belum terpasang                              │ Gunakan salah satu:1. Docker (Docker sudah ada di sistem Anda): docker run -d -p
                 │                                                 │ 27017:27017 --name mongodb mongo:latest2. MongoDB Community Server (Download dari
                 │                                                 │ mongodb.com)3. MongoDB Atlas (Cloud Database gratis)                                    
                                                                                                                                                             
  [1]: python.org https://www.python.org/downloads/                                                                                                          
  ──────                                                                                                                                                     
  ### 3. Konfigurasi Environment Variables (.env)                                                                                                            
                                                                                                                                                             
  Sebelum menjalankan aplikasi, buat file .env di direktori backend dan frontend:                                                                            
                                                                                                                                                             
  #### A. File .env Backend: .env                                                                                                                            
                                                                                                                                                             
  Buat file baru di dalam folder backend/ bernama .env dengan isi:                                                                                           
                                                                                                                                                             
    MONGO_URL=mongodb://localhost:27017                                                                                                                      
    DB_NAME=ali_workspace                                                                                                                                    
    JWT_SECRET=rahasia_kunci_jwt_super_aman_123456                                                                                                           
    ADMIN_EMAIL=info.akseslegal.id@gmail.com                                                                                                                 
    ADMIN_PASSWORD=Admin123!                                                                                                                                 
    FRONTEND_URL=http://localhost:3000                                                                                                                       
    WEBHOOK_CRON_SECRET=cron_secret_ali_2026                                                                                                                 
                                                                                                                                                             
  #### B. File .env Frontend: .env                                                                                                                           
                                                                                                                                                             
  Buat file baru di dalam folder frontend/ bernama .env dengan isi:                                                                                          
                                                                                                                                                             
    REACT_APP_BACKEND_URL=http://localhost:8001                                                                                                              
  ──────                                                                                                                                                     
  ### 4. Cara Menjalankan Proyek (Langkah demi Langkah)                                                                                                      
                                                                                                                                                             
  Buka terminal PowerShell/Command Prompt:                                                                                                                   
                                                                                                                                                             
  #### Langkah 1: Jalankan Database MongoDB                                                                                                                  
                                                                                                                                                             
  Jika menggunakan Docker yang sudah ada di PC Anda:                                                                                                         
                                                                                                                                                             
    docker run -d -p 27017:27017 --name mongodb mongo:latest                                                                                                 
  ──────                                                                                                                                                     
  #### Langkah 2: Setup & Jalankan Backend (FastAPI)                                                                                                         
                                                                                                                                                             
  Buka terminal baru:                                                                                                                                        
                                                                                                                                                             
    # 1. Masuk ke direktori backend                                                                                                                          
    cd D:\GIANT-APPS\backend                                                                                                                                 
                                                                                                                                                             
    # 2. Buat virtual environment python                                                                                                                     
    python -m venv venv                                                                                                                                      
                                                                                                                                                             
    # 3. Aktifkan virtual environment                                                                                                                        
    .\venv\Scripts\Activate.ps1                                                                                                                              
                                                                                                                                                             
    # 4. Install dependencies backend                                                                                                                        
    pip install -r requirements.txt                                                                                                                          
                                                                                                                                                             
    # 5. Jalankan server FastAPI pada port 8001                                                                                                              
    uvicorn server:app --reload --port 8001                                                                                                                  
                                                                                                                                                             
  │ Catatan: Saat pertama kali dijalankan, backend otomatis membuat index MongoDB dan mengisi data demo (seed akun, board, divisi, dan kartu contoh).        
  ──────                                                                                                                                                     
  #### Langkah 3: Setup & Jalankan Frontend (React)                                                                                                          
                                                                                                                                                             
  Buka terminal baru lainnya:                                                                                                                                
                                                                                                                                                             
    # 1. Masuk ke direktori frontend                                                                                                                         
    cd D:\GIANT-APPS\frontend
  
    # 2. Install dependencies frontend (gunakan yarn atau npm)
    yarn install
    # Atau jika menggunakan npm:
    # npm install --legacy-peer-deps
  
    # 3. Jalankan aplikasi web
    yarn start
    # Atau:
    # npm start
  
  Frontend akan otomatis terbuka di browser Anda pada alamat: http://localhost:3000
  ──────
  ### 5. Akun Default untuk Login (Hasil Seeding)
  
  Anda dapat langsung mencoba login menggunakan akun demo berikut:
  
  1. Super Admin (Akses Penuh):
      • Email: info.akseslegal.id@gmail.com (atau sesuai ADMIN_EMAIL di .env)
      • Password: Admin123!
  2. Akun Staff / Supervisor Demo (Password semua sama: Staff123!):
      • Supervisor Perizinan: andi@ali.id
      • CS: dedes@ali.id, devi@ali.id, dewi@ali.id, julia@ali.id
      • Admin Draf Input: elis@ali.id, anti@ali.id
      • Admin Pajak: amel@ali.id
      • Desain: rina@ali.id