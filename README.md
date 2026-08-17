# VeriTix — QR E-Ticket Tahan Pemalsuan

VeriTix adalah sistem e-ticket berbasis web yang dikembangkan untuk mengatasi
pemalsuan, duplikasi, dan manipulasi tiket digital. Proyek ini dibuat untuk
memenuhi tugas UAS mata kuliah Kriptografi, Teknik Informatika,
Universitas Bina Insani.

## Fitur Keamanan

- **SHA-256** — menghasilkan nilai hash unik dari setiap data tiket.
- **RSA Digital Signature (2048-bit)** — menandatangani hash tiket dengan
  private key server, diverifikasi menggunakan public key saat scan.
- **Dynamic Time-Based Token** — token pada QR Code berubah setiap 60 detik
  sehingga tidak bisa dipakai ulang lewat screenshot atau salinan.

## Tech Stack

- **Frontend:** React.js (Vite)
- **Backend:** Node.js, Express.js
- **Database:** SQLite
- **Email:** Nodemailer
- **Tunneling (untuk akses scan dari HP panitia):** ngrok

## Struktur Folder

```
qr-eticket/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example      # salin jadi .env dan isi sendiri
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

> Catatan: `backend/.env`, `backend/rsa-keys.json` (RSA private key), dan
> `backend/tickets.db` (data peserta asli) **tidak** disertakan di repo ini
> karena berisi data sensitif. Lihat bagian *Environment Variables* di bawah.

## Environment Variables

Buat file `backend/.env` (lihat `.env.example`) dengan isi:

```
GMAIL_USER=email_pengirim_kamu@gmail.com
GMAIL_PASS=app_password_gmail_kamu
BASE_URL=http://localhost:3001
```

`GMAIL_PASS` menggunakan **App Password** Gmail (bukan password akun biasa).

RSA key pair (`rsa-keys.json`) di-generate otomatis oleh backend saat pertama
kali dijalankan jika file tersebut belum ada.

## Cara Menjalankan

Dibutuhkan 3 terminal berjalan bersamaan.

**1. Install dependencies**

```bash
cd backend
npm install

cd ../frontend
npm install
```

**2. Jalankan backend** (Terminal 1)

```bash
cd backend
node server.js
```

Berhasil jika muncul: `✓ Backend running at http://localhost:3001`

**3. Jalankan frontend** (Terminal 2)

```bash
cd frontend
npm run dev -- --host
```

Berhasil jika muncul: `➜ Local: http://localhost:5173/`

**4. Jalankan ngrok** (Terminal 3) — dibutuhkan agar halaman verifikasi
admin bisa diakses dari kamera HP

```bash
ngrok config add-authtoken <AUTHTOKEN_KAMU>
ngrok http 3001
```

Salin URL `Forwarding` yang muncul (contoh: `https://xxxx.ngrok-free.app`),
lalu buka `<url>/admin` dari HP untuk melakukan scan QR.

> Dapatkan authtoken kamu sendiri gratis di https://dashboard.ngrok.com

## Alur Penggunaan

1. Buka `http://localhost:5173` di browser.
2. Isi nama acara, lalu registrasi peserta.
3. Klik "acc dan kirim link QR" ke peserta.
4. Peserta membuka email, klik "Buka QR Tiket Saya".
5. Panitia membuka `<ngrok-url>/admin` di HP untuk scan QR peserta.
6. Sistem memverifikasi hash SHA-256, RSA signature, dan token waktu.
   Jika valid, tiket diubah statusnya menjadi "used".

Dosen Pengampu: Dr. Ir. Saludin Muis, M.Kom
