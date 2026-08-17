require('dotenv').config();
const express = require('express');
const cors = require('cors');
const forge = require('node-forge');
const QRCode = require('qrcode');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

const db = new Database('tickets.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    event TEXT NOT NULL,
    date TEXT NOT NULL,
    hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const KEY_FILE = './rsa-keys.json';

let privateKeyPem, publicKeyPem;

// Baca logo sebagai base64
const logoPath = path.join(__dirname, '../frontend/public/icontitle.png');
const logoBase64 = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
  : null;

if (fs.existsSync(KEY_FILE)) {
  const keys = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  privateKeyPem = keys.privateKeyPem;
  publicKeyPem = keys.publicKeyPem;
  console.log('✓ RSA key pair loaded from file');
} else {
  const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048);
  privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  publicKeyPem = forge.pki.publicKeyToPem(publicKey);
  fs.writeFileSync(KEY_FILE, JSON.stringify({ privateKeyPem, publicKeyPem }));
  console.log('✓ RSA key pair generated and saved');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

function getLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function simpleHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x9e3779b9);
    h2 = Math.imul(h2 ^ c, 0x5c4dd124);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b) ^ Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 0x85ebca6b) ^ Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35);
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  let result = a + b;
  let seed = result;
  while (result.length < 64) {
    let acc = 0;
    for (let i = 0; i < seed.length; i++) acc = (acc * 31 + seed.charCodeAt(i)) >>> 0;
    seed = (acc >>> 0).toString(16).padStart(8, '0') + seed.slice(0, 8);
    result += seed.slice(0, 64 - result.length);
  }
  return result;
}

function generateDynamicToken(sha256Hash, w) {
  const raw = `${w}|${sha256Hash.slice(0, 32)}`;
  return simpleHash(raw).slice(0, 32);
}

function verifyDynamicToken(sha256Hash, token) {
  const w = Math.floor(Date.now() / 60000);
  for (let i = 0; i <= 1; i++) {
    if (generateDynamicToken(sha256Hash, w - i) === token) return true;
  }
  return false;
}

// ─── POST /generate ───────────────────────────────────────────────────────────
app.post('/generate', (req, res) => {
  const { name, email, event, date } = req.body;
  if (!name || !email || !event || !date)
    return res.status(400).json({ error: 'Semua field wajib diisi' });

  const ticketId = crypto.randomUUID();
  const ticketData = `${ticketId}|${name}|${event}|${date}`;

  const md = forge.md.sha256.create();
  md.update(ticketData, 'utf8');
  const hash = md.digest().toHex();

  const privateKeyObj = forge.pki.privateKeyFromPem(privateKeyPem);
  const mdSign = forge.md.sha256.create();
  mdSign.update(ticketData, 'utf8');
  const signature = forge.util.encode64(privateKeyObj.sign(mdSign));

  db.prepare(`INSERT INTO tickets (id, name, email, event, date, hash, signature, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`)
    .run(ticketId, name, email, event, date, hash, signature);

  res.json({ ticketId, name, email, event, date, hash, signature, status: 'pending' });
});

// ─── POST /approve/:id ────────────────────────────────────────────────────────
app.post('/approve/:id', async (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  if (ticket.status !== 'pending') return res.status(400).json({ error: 'Tiket sudah diproses sebelumnya' });

  db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run('active', ticket.id);
  const ticketUrl = `${process.env.BASE_URL}/ticket/${ticket.id}`;

  try {
    await transporter.sendMail({
      from: `"Veritix" <${process.env.GMAIL_USER}>`,
      to: ticket.email,
      subject: `Tiket Kamu untuk ${ticket.event} Sudah Aktif! 🎫`,
      html: `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Tiket Kamu Sudah Aktif – VeriTix</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f0eeff; font-family: 'Outfit', 'Helvetica Neue', Arial, sans-serif; }
</style>
</head>
<body style="background:#f0eeff; padding: 40px 16px 60px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px; margin:0 auto;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr>
          <td align="center" style="padding: 32px 0 20px;">
  <img src="https://i.imgur.com/t0Rrc2A.png" alt="VeriTix" width="100" height="100"
  style="border-radius:20px; display:block; margin:0 auto 12px;" />
</td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#ffffff; border-radius:24px; border:1.5px solid #ede9fe; overflow:hidden; box-shadow:0 16px 60px rgba(124,58,237,0.12);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 60%,#0ea5e9 100%); height:5px;"></td></tr>
        <tr>
          <td style="padding: 36px 36px 0;">
            <div style="font-size:26px; font-weight:800; color:#1e1b4b; letter-spacing:-0.5px; line-height:1.2; margin-bottom:10px;">
              Tiket Kamu<br/>Sudah Aktif! 🎉
            </div>
            <div style="font-size:14px; color:#9ca3af; font-weight:500; margin-bottom:32px; line-height:1.6;">
              Pembayaran telah dikonfirmasi oleh panitia.<br/>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#faf9ff; border-radius:16px; border:1.5px solid #ede9fe; margin-bottom:28px;">
              <tr><td style="padding: 20px 22px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid #f0eeff;">
                  <tr>
                    <td style="font-size:11px; color:#a78bfa; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Nama Peserta</td>
                    <td align="right" style="font-size:14px; font-weight:700; color:#1e1b4b;">${ticket.name}</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid #f0eeff;">
                  <tr>
                    <td style="font-size:11px; color:#a78bfa; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Acara</td>
                    <td align="right" style="font-size:14px; font-weight:700; color:#1e1b4b;">${ticket.event}</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:11px; color:#a78bfa; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Tanggal</td>
                    <td align="right" style="font-size:14px; font-weight:700; color:#1e1b4b;">${ticket.date}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#d1fae5; border:1.5px solid #6ee7b7; border-radius:99px; padding:8px 20px;">
                  <span style="font-size:12px; font-weight:700; color:#065f46; letter-spacing:0.5px;">✓ &nbsp;Status: AKTIF</span>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${ticketUrl}" target="_blank"
                    style="display:inline-block; padding:16px 40px; background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%); color:#ffffff; font-size:15px; font-weight:800; text-decoration:none; border-radius:14px; letter-spacing:0.2px; box-shadow:0 8px 24px rgba(124,58,237,0.4);">
                    Buka QR Tiket Saya 
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 0 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:14px;">
              <tr><td style="padding:16px 18px;">
                <div style="font-size:12px; font-weight:700; color:#92400e; margin-bottom:6px;">⚠️ &nbsp;Penting — Baca Sebelum Hari H</div>
                <ul style="font-size:12px; color:#78350f; font-weight:500; line-height:1.8; padding-left:18px; margin:0;">
                  <li>QR Code berubah setiap <strong>60 detik</strong> untuk keamanan</li>
                  <li>Tunjukkan Email ke panitia untuk di-scan QR-nya!</li>
                  <li>Link hanya berlaku untuk <strong>satu kali scan</strong></li>
                </ul>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 0 36px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-right:6px;">
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background:#f5f3ff; border:1.5px solid #ddd6fe; border-radius:12px;">
                    <tr><td style="padding:14px 16px; text-align:center;">
                      <div style="font-size:10px; font-weight:700; color:#7c3aed; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">🔐 RSA Signed</div>
                      <div style="font-size:11px; color:#a78bfa; font-weight:500;">Tanda tangan digital</div>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding-left:6px;">
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:12px;">
                    <tr><td style="padding:14px 16px; text-align:center;">
                      <div style="font-size:10px; font-weight:700; color:#059669; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">🛡 SHA-256</div>
                      <div style="font-size:11px; color:#6ee7b7; font-weight:500;">Hash terverifikasi</div>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr>
          <td align="center" style="padding:0 20px;">
            <div style="font-size:11px; color:#c4b5fd; text-align:center; line-height:1.8; font-weight:500;">
              Email ini dikirim otomatis oleh sistem <strong style="color:#a78bfa;">VeriTix</strong><br/>
              RSA Digital Signature · SHA-256 Cryptography<br/>
              <span style="color:#7c6faa;">⚠️ Jangan balas email ini — email tidak terpantau</span>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    res.json({ success: true, message: 'Tiket disetujui dan email terkirim' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Tiket disetujui tapi email gagal terkirim: ' + err.message });
  }
});

// ─── GET /ticket/:id — halaman peserta (QR dinamis, tiket horizontal, tanpa hash/sig) ──
app.get('/ticket/:id', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).send('<h2>Tiket tidak ditemukan</h2>');

  if (ticket.status === 'pending') return res.status(403).send(`
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Tiket Belum Aktif</title>
    <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f4f0;}
    .box{text-align:center;padding:40px;background:#fff;border-radius:20px;border:1.5px solid #ebebeb;max-width:360px;width:90%;}</style>
    </head><body><div class="box"><div style="font-size:48px">⏳</div>
    <h2 style="color:#d97706;margin:16px 0 8px">Menunggu Konfirmasi</h2>
    <p style="color:#888;font-size:14px;line-height:1.6">Tiket kamu belum diaktifkan oleh panitia. Silakan tunggu konfirmasi pembayaran.</p>
    </div></body></html>
  `);

  const today = getLocalDate();
  const isExpired = today > ticket.date;
  const isUsed = ticket.status === 'used';

  // ── Hitung tema warna dari nama event (sama dengan logika React) ──
  const THEMES = [
    { bg: '#0f172a', accent: '#38bdf8', stripe: '#1e293b' },
    { bg: '#1a0a2e', accent: '#c084fc', stripe: '#2d1052' },
    { bg: '#052e16', accent: '#4ade80', stripe: '#14532d' },
    { bg: '#1c0a00', accent: '#fb923c', stripe: '#431407' },
    { bg: '#0c1445', accent: '#60a5fa', stripe: '#1e3a8a' },
    { bg: '#2d0a0a', accent: '#f87171', stripe: '#7f1d1d' },
  ];
  let _hash = 5381;
  for (let i = 0; i < ticket.event.length; i++) {
    _hash = Math.imul(_hash, 33) ^ ticket.event.charCodeAt(i);
    _hash = _hash >>> 0;
  }
  const theme = THEMES[_hash % THEMES.length];

  // ── Halaman tiket USED — horizontal, clean, tanpa hash/sig ──
  if (isUsed) {
    const shortId = ticket.id.slice(0, 12).toUpperCase();
    return res.send(`<!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Tiket Masuk - ${ticket.name}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Mono&display=swap" rel="stylesheet">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Space Grotesk',sans-serif;background:#ffffff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:20px;}
        .ticket{display:flex;border-radius:18px;overflow:hidden;width:100%;max-width:600px;box-shadow:0 20px 60px rgba(0,0,0,0.5);}
        .ticket-left{flex:1;background:${theme.bg};padding:28px 24px;position:relative;overflow:hidden;border:1.5px solid #1e293b;border-right:none;border-radius:18px 0 0 18px;}
        .ticket-left::before{content:'';position:absolute;top:-60px;right:-60px;width:160px;height:160px;border-radius:50%;background:#22c55e;opacity:0.04;}
        .ticket-left::after{content:'';position:absolute;bottom:-30px;left:-30px;width:100px;height:100px;border-radius:50%;background:#22c55e;opacity:0.05;}
        .ticket-label{font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${theme.accent};opacity:0.8;margin-bottom:14px;}
        .ticket-event{font-size:22px;font-weight:700;color:#f1f5f9;line-height:1.2;margin-bottom:6px;letter-spacing:-0.5px;}
        .ticket-name{font-size:13px;color:${theme.accent};font-weight:600;margin-bottom:20px;letter-spacing:0.3px;}
        .ticket-meta{display:flex;gap:24px;}
        .meta-group{display:flex;flex-direction:column;gap:3px;}
        .meta-label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;}
        .meta-value{font-size:13px;font-weight:600;color:#e2e8f0;}
        .stamp{display:inline-flex;align-items:center;gap:6px;background:${theme.accent}1a;border:1.5px solid ${theme.accent}4d;border-radius:8px;padding:5px 12px;margin-top:16px;}
        .stamp-dot{width:6px;height:6px;border-radius:50%;background:${theme.accent};}
        .stamp-text{font-size:10px;font-weight:700;color:${theme.accent};letter-spacing:1.5px;text-transform:uppercase;}
        .divider{width:1px;background:repeating-linear-gradient(to bottom,#1e293b 0,#1e293b 6px,transparent 6px,transparent 12px);position:relative;flex-shrink:0;}
        .notch{position:absolute;left:50%;transform:translateX(-50%);width:20px;height:20px;border-radius:50%;background:#ffffff;}
        .notch-top{top:-10px;}
        .notch-bot{bottom:-10px;}
        .ticket-right{width:120px;background:${theme.stripe};padding:22px 16px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;flex-shrink:0;border:1.5px solid ${theme.stripe};border-left:none;border-radius:0 18px 18px 0;}
        .id-label{font-size:8px;color:#475569;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;text-align:center;}
        .id-val{font-size:10px;font-weight:700;color:${theme.accent};font-family:'DM Mono',monospace;word-break:break-all;text-align:center;line-height:1.5;}
        .barcode{display:flex;gap:2px;align-items:flex-end;height:40px;}
        .bar{border-radius:1px;background:${theme.accent};opacity:0.6;}
        .sec-badge{font-size:8px;color:#334155;text-align:center;letter-spacing:0.5px;}
        .btn-dl{padding:12px 28px;background:${theme.accent};color:${theme.bg};border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Space Grotesk',sans-serif;letter-spacing:0.3px;}
        .btn-dl:hover{filter:brightness(0.8);}
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="ticket-left">
          <div class="ticket-label">E-Ticket · Terverifikasi</div>
          <div class="ticket-event">${ticket.event}</div>
          <div class="ticket-name">${ticket.name}</div>
          <div class="ticket-meta">
            <div class="meta-group">
              <div class="meta-label">Tanggal</div>
              <div class="meta-value">${ticket.date}</div>
            </div>
            <div class="meta-group">
              <div class="meta-label">ID Tiket</div>
              <div class="meta-value" style="font-family:'DM Mono',monospace;font-size:11px;">${shortId}</div>
            </div>
          </div>
          <div class="stamp">
            <span class="stamp-dot"></span>
            <span class="stamp-text">Sudah Masuk</span>
          </div>
        </div>
        <div class="divider">
          <div class="notch notch-top"></div>
          <div class="notch notch-bot"></div>
        </div>
        <div class="ticket-right">
          <div>
            <div class="id-label">Ticket ID</div>
            <div class="id-val">${shortId}</div>
          </div>
          <div class="barcode">
            ${[8,12,6,14,10,5,16,8,11,7,13,6].map(h=>`<div class="bar" style="width:3px;height:${h}px"></div>`).join('')}
          </div>
          <div class="sec-badge">RSA · SHA-256</div>
        </div>
      </div>
      <button class="btn-dl" onclick="downloadPDF()">⬇ Download PDF</button>
      <script>
        async function downloadPDF() {
  const btn = document.querySelector('.btn-dl');
  btn.textContent = 'Menyiapkan...';
  btn.disabled = true;

  const ticket = document.querySelector('.ticket');

  // Sembunyikan notch dulu biar ga kepotong
  const notches = ticket.querySelectorAll('.notch');
  notches.forEach(n => n.style.visibility = 'hidden');

  const canvas = await html2canvas(ticket, {
    scale: 3,           // resolusi tinggi
    useCORS: true,
    backgroundColor: null,
    logging: false,
  });

  notches.forEach(n => n.style.visibility = 'visible');

  const imgData = canvas.toDataURL('image/png');

  // Ukuran PDF menyesuaikan ukuran tiket yang di-capture
  const pxToMm = 0.2645833;
  const imgW = canvas.width * pxToMm / 3;   // dibagi scale
  const imgH = canvas.height * pxToMm / 3;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: 'mm',
    format: [imgW, imgH],
    orientation: imgW > imgH ? 'landscape' : 'portrait',
  });

  doc.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
  doc.save('tiket-${ticket.name.replace(/\\s+/g, '-')}.pdf');

  btn.textContent = '⬇ Download PDF';
  btn.disabled = false;
}
      </script>
    </body></html>`);
  }

  if (isExpired) {
    return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Tiket Kedaluwarsa</title>
      <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff7ed;}
      .box{text-align:center;padding:40px;background:#fff;border-radius:20px;border:1.5px solid #fed7aa;max-width:360px;width:90%;}</style>
      </head><body><div class="box"><div style="font-size:48px">⏰</div>
      <h2 style="color:#d97706;margin:16px 0 8px">Tiket Kedaluwarsa</h2>
      <p style="color:#888;font-size:14px;line-height:1.6">Tiket ini sudah tidak berlaku karena acara telah selesai pada ${ticket.date}.</p>
      </div></body></html>`);
  }

  // ── Halaman QR Dinamis — horizontal ticket, TANPA hash/sig visible ──
  const shortId = ticket.id.slice(0, 12).toUpperCase();
  res.send(`<!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Tiket - ${ticket.name}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Mono&display=swap" rel="stylesheet">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Space Grotesk',sans-serif;background:#ffffff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
        .wrap{width:100%;max-width:420px;display:flex;flex-direction:column;gap:16px;}

        /* ── Tiket horizontal ── */
        .ticket{display:flex;border-radius:18px;overflow:visible;width:100%;position:relative;}
        .ticket-left{flex:1;background:#0f172a;padding:22px 20px;position:relative;overflow:hidden;border:1.5px solid #1e293b;border-right:none;border-radius:18px 0 0 18px;}
        .ticket-left::before{content:'';position:absolute;top:-50px;right:-50px;width:140px;height:140px;border-radius:50%;background:#6347ff;opacity:0.05;}
        .tl-label{font-size:8px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#6347ff;opacity:0.8;margin-bottom:12px;}
        .tl-event{font-size:18px;font-weight:700;color:#f1f5f9;line-height:1.2;margin-bottom:4px;letter-spacing:-0.3px;}
        .tl-name{font-size:12px;color:#818cf8;font-weight:600;margin-bottom:16px;}
        .tl-meta{display:flex;gap:20px;}
        .meta-g{display:flex;flex-direction:column;gap:2px;}
        .meta-l{font-size:8px;color:#475569;text-transform:uppercase;letter-spacing:1.5px;}
        .meta-v{font-size:12px;font-weight:600;color:#e2e8f0;}
        .badge-live{display:inline-flex;align-items:center;gap:6px;background:rgba(99,71,255,0.12);border:1px solid rgba(99,71,255,0.3);border-radius:6px;padding:4px 10px;margin-top:12px;}
        .dot-live{width:5px;height:5px;border-radius:50%;background:#818cf8;animation:pulse 1.2s infinite;}
        .badge-text{font-size:9px;font-weight:700;color:#818cf8;letter-spacing:1.5px;text-transform:uppercase;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}

        .divider{width:1px;background:repeating-linear-gradient(to bottom,#1e293b 0,#1e293b 5px,transparent 5px,transparent 10px);position:relative;flex-shrink:0;}
        .notch{position:absolute;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:#ffffff;}
        .notch-t{top:-9px;}
        .notch-b{bottom:-9px;}

        .ticket-right{width:110px;background:#1a1040;padding:18px 14px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;flex-shrink:0;border:1.5px solid #1e293b;border-left:none;border-radius:0 18px 18px 0;}
        .id-lbl{font-size:7px;color:#6347ff;opacity:0.6;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;text-align:center;}
        .id-val{font-size:9px;font-weight:700;color:#818cf8;font-family:'DM Mono',monospace;word-break:break-all;text-align:center;line-height:1.5;}
        .barcode{display:flex;gap:2px;align-items:flex-end;height:36px;}
        .bar{border-radius:1px;background:#6347ff;opacity:0.5;}
        .sec-lbl{font-size:7px;color:#2d1e5a;text-align:center;letter-spacing:0.5px;}

        /* ── QR panel ── */
        .qr-panel{background:#ffffff;border-radius:18px;border:1.5px solid #e5e5e5;padding:20px;text-align:center;}
#qrcode{display:flex;justify-content:center;margin-bottom:12px;}
#qrcode canvas,#qrcode img{border-radius:12px;border:3px solid #e5e5e5 !important;}
        .timer-bar{height:3px;background:#1e293b;border-radius:99px;overflow:hidden;margin-bottom:6px;}
        .timer-fill{height:100%;background:#6347ff;border-radius:99px;transition:width 1s linear;}
        .timer-txt{font-size:11px;color:#475569;margin-bottom:0;}
        .timer-txt strong{color:#818cf8;}
        .warn{background:#1a0e00;border:1px solid #f97316;border-radius:10px;padding:10px 14px;font-size:11px;color:#fb923c;line-height:1.6;text-align:left;margin-top:12px;}
        .info{margin-top:10px;padding:10px 14px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;font-size:11px;color:#818cf8;text-align:left;line-height:1.7;}
      </style>
    </head>
    <body>
      <div class="wrap">
        <!-- Tiket horizontal -->

        <!-- QR panel -->
        <div class="qr-panel">
          <div id="qrcode"></div>
          <div class="timer-bar"><div class="timer-fill" id="timerFill"></div></div>
          <p class="timer-txt">QR berubah dalam <strong id="countdown">60</strong> detik</p>
          <div class="warn">⚠️ Jangan screenshot. QR berubah tiap 60 detik — tunjukkan langsung ke panitia saat hari H.</div>
          <div class="info">🎫 <strong style="color:#e2e8f0;">${ticket.name}</strong><br><span style="color:#475569;">${ticket.event} · ${ticket.date}</span></div>
        </div>
      </div>

      <script>
        const HASH = "${ticket.hash}";
        const SIGNATURE = "${ticket.signature}";
        const EVENT_DATE = "${ticket.date}";
        let lastWindow = -1;

        function getLocalDate() {
          const now = new Date();
          return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
        }
        function getCurrentWindow() { return Math.floor(Date.now() / 60000); }

        function simpleHash(str) {
          let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
          for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ c, 0x9e3779b9);
            h2 = Math.imul(h2 ^ c, 0x5c4dd124);
          }
          h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b) ^ Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
          h2 = Math.imul(h2 ^ (h2 >>> 16), 0x85ebca6b) ^ Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35);
          const a = (h1 >>> 0).toString(16).padStart(8, '0');
          const b = (h2 >>> 0).toString(16).padStart(8, '0');
          let result = a + b;
          let seed = result;
          while (result.length < 64) {
            let acc = 0;
            for (let i = 0; i < seed.length; i++) acc = (acc * 31 + seed.charCodeAt(i)) >>> 0;
            seed = (acc >>> 0).toString(16).padStart(8, '0') + seed.slice(0, 8);
            result += seed.slice(0, 64 - result.length);
          }
          return result;
        }

        function generateToken(w) {
          const raw = w + '|' + HASH.slice(0, 32);
          return simpleHash(raw).slice(0, 32);
        }

        function renderQR() {
  const w = getCurrentWindow();
  const token = generateToken(w);
  const payload = JSON.stringify({
    sha256: HASH,
    rsa: SIGNATURE.slice(0, 32),
    token: token,
    t: w
  });
  document.getElementById('qrcode').innerHTML = '';
  new QRCode(document.getElementById('qrcode'), {
    text: payload,
    width: 200, height: 200,
    colorDark: '#000000',   // hitam murni
    colorLight: '#ffffff',  // putih murni
    correctLevel: QRCode.CorrectLevel.M  // ganti L ke M untuk lebih robust
  });
  lastWindow = w;
}

        function updateTimer() {
          const today = getLocalDate();
          if (today > EVENT_DATE) {
            document.getElementById('qrcode').innerHTML = '<p style="color:#fb923c;font-size:13px;padding:20px">QR tidak tersedia — acara sudah selesai</p>';
            document.getElementById('countdown').textContent = '-';
            return;
          }
          const now = Date.now();
          const elapsed = now % 60000;
          const remaining = Math.ceil((60000 - elapsed) / 1000);
          document.getElementById('countdown').textContent = remaining;
          document.getElementById('timerFill').style.width = ((60000-elapsed)/60000*100) + '%';
          const w = getCurrentWindow();
          if (w !== lastWindow) renderQR();
        }

        renderQR();
        setInterval(updateTimer, 1000);
        updateTimer();
      </script>
    </body></html>`);
});

// ─── GET /admin ────────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
  <html><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Admin Scanner</title>
    <script src="https://cdn.jsdelivr.net/npm/@zxing/library@0.18.6/umd/index.min.js"></script>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'DM Sans',sans-serif;background:#f5f4f0;min-height:100vh;padding:20px;}
      .header{text-align:center;padding:20px 0 24px;}
      .header h1{font-size:20px;font-weight:600;color:#111;}
      .header p{font-size:12px;color:#999;margin-top:4px;}
      .card{background:#fff;border-radius:20px;border:1.5px solid #ebebeb;padding:20px;margin-bottom:16px;}
      #video{width:100%;border-radius:14px;display:block;}
      .btn{width:100%;padding:14px;border:none;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer;margin-top:12px;font-family:inherit;}
      .btn-purple{background:#6347ff;color:#fff;}
      .btn-gray{background:#f5f4f0;color:#555;border:1.5px solid #e5e5e5;}
      .badge-scanning{display:inline-flex;align-items:center;gap:6px;background:#ede9ff;border:1px solid #c4b5fd;border-radius:99px;padding:4px 14px;font-size:12px;color:#6347ff;font-weight:500;}
      .dot{width:7px;height:7px;border-radius:50%;background:#6347ff;animation:pulse 1s infinite;}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
      .hint{font-size:12px;color:#aaa;text-align:center;margin-top:10px;}
    </style>
  </head>
  <body>
    <div class="header">
      <div style="font-size:28px;margin-bottom:8px;">🔐</div>
      <h1>Admin Scanner</h1>
      <p>QR E-Ticket · Panitia</p>
    </div>
    <div class="card">
      <video id="video" playsinline></video>
      <button class="btn btn-purple" id="startBtn" onclick="startScan()">📷 Mulai Scan QR</button>
      <p class="hint" id="hint">Tekan tombol di atas untuk aktifkan kamera</p>
    </div>
    <script>
      const API = 'https://possibly-discard-basically.ngrok-free.dev';
      let isSending = false;
      let codeReader = null;

      function startScan() {
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('hint').innerHTML = '<span class="badge-scanning"><span class="dot"></span>Mendeteksi QR...</span>';
  
  try {
    if (typeof ZXing === 'undefined') {
      document.getElementById('hint').textContent = 'ERROR: ZXing library tidak berhasil dimuat!';
      document.getElementById('startBtn').style.display = 'block';
      return;
    }
    codeReader = new ZXing.BrowserQRCodeReader();
    codeReader.decodeFromVideoDevice(null, 'video', (result, err) => {
      if (result && !isSending) {
        isSending = true;
        sendQR(result.getText());
      }
      if (err && !(err instanceof ZXing.NotFoundException)) {
        document.getElementById('hint').textContent = 'Scan error: ' + err.message;
      }
    });
  } catch(e) {
    document.getElementById('hint').textContent = 'Start error: ' + e.message;
    document.getElementById('startBtn').style.display = 'block';
  }
}

      async function sendQR(data) {
        document.getElementById('hint').innerHTML = '<span class="badge-scanning"><span class="dot"></span>QR terdeteksi! Mengirim...</span>';
        if (codeReader) codeReader.reset();
        try {
          const res = await fetch(API + '/scan-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({ qrContent: data })
          });
          if (res.ok) {
            document.getElementById('hint').innerHTML =
              '✅ Berhasil dikirim! Lihat laptop untuk konfirmasi.<br><br>' +
              '<button onclick="resetScan()" style="margin-top:12px;padding:10px 20px;background:#6347ff;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;">📷 Scan Tiket Lain</button>';
          } else {
            document.getElementById('hint').textContent = 'Gagal kirim ke server';
            isSending = false;
            document.getElementById('startBtn').style.display = 'block';
          }
        } catch(e) {
          document.getElementById('hint').textContent = 'Error: ' + e.message;
          isSending = false;
          document.getElementById('startBtn').style.display = 'block';
        }
      }

      function resetScan() {
        isSending = false;
        if (codeReader) { codeReader.reset(); codeReader = null; }
        document.getElementById('hint').textContent = 'Tekan tombol di atas untuk aktifkan kamera';
        document.getElementById('startBtn').style.display = 'block';
      }
    </script>
  </body></html>`);
});

// ─── POST /preview ────────────────────────────────────────────────────────────
app.post('/preview', (req, res) => {
  const { qrContent } = req.body;
  let parsed;
  try { parsed = JSON.parse(qrContent); }
  catch { return res.json({ valid: false, reason: 'QR Code tidak valid atau rusak' }); }

  const { sha256, token } = parsed;
  if (!sha256 || !token) return res.json({ valid: false, reason: 'Format QR tidak dikenali' });

  const ticket = db.prepare('SELECT * FROM tickets WHERE hash = ?').get(sha256);
  if (!ticket) return res.json({ valid: false, reason: 'Tiket tidak ditemukan di database' });
  if (ticket.status === 'pending') return res.json({ valid: false, reason: 'Tiket belum diaktifkan oleh panitia' });
  if (ticket.status === 'used') return res.json({ valid: false, reason: 'Tiket sudah pernah digunakan', ticket });

  const today = getLocalDate();
  if (today < ticket.date) return res.json({ valid: false, reason: `Acara belum dimulai — tiket baru berlaku pada ${ticket.date}`, ticket });
  if (today > ticket.date) {
    db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run('expired', ticket.id);
    return res.json({ valid: false, reason: `Tiket kedaluwarsa — acara sudah lewat pada ${ticket.date}`, ticket });
  }

  try {
    const ticketData = `${ticket.id}|${ticket.name}|${ticket.event}|${ticket.date}`;
    const publicKeyObj = forge.pki.publicKeyFromPem(publicKeyPem);
    const md = forge.md.sha256.create();
    md.update(ticketData, 'utf8');
    const rsaValid = publicKeyObj.verify(md.digest().bytes(), forge.util.decode64(ticket.signature));
    if (!rsaValid) return res.json({ valid: false, reason: 'RSA Signature tidak valid — tiket palsu atau dimodifikasi' });
  } catch {
    return res.json({ valid: false, reason: 'Gagal verifikasi RSA signature' });
  }

  if (!verifyDynamicToken(sha256, token))
    return res.json({ valid: false, reason: 'Token QR sudah kedaluwarsa — minta peserta refresh halaman tiketnya' });

  res.json({
    valid: true,
    reason: 'Tiket valid — konfirmasi untuk tandai masuk',
    ticket: { name: ticket.name, email: ticket.email, event: ticket.event, date: ticket.date }
  });
});

// ─── POST /verify ─────────────────────────────────────────────────────────────
app.post('/verify', (req, res) => {
  const { qrContent } = req.body;
  let parsed;
  try { parsed = JSON.parse(qrContent); }
  catch { return res.json({ valid: false, reason: 'QR Code tidak valid atau rusak' }); }

  const { sha256, token } = parsed;
  if (!sha256 || !token) return res.json({ valid: false, reason: 'Format QR tidak dikenali' });

  const ticket = db.prepare('SELECT * FROM tickets WHERE hash = ?').get(sha256);
  if (!ticket) return res.json({ valid: false, reason: 'Tiket tidak ditemukan di database' });
  if (ticket.status === 'pending') return res.json({ valid: false, reason: 'Tiket belum diaktifkan oleh panitia' });
  if (ticket.status === 'used') return res.json({ valid: false, reason: 'Tiket sudah pernah digunakan', ticket });

  const today = getLocalDate();
  if (today < ticket.date) return res.json({ valid: false, reason: `Acara belum dimulai — tiket baru berlaku pada ${ticket.date}`, ticket });
  if (today > ticket.date) {
    db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run('expired', ticket.id);
    return res.json({ valid: false, reason: `Tiket kedaluwarsa — acara sudah lewat pada ${ticket.date}`, ticket });
  }

  try {
    const ticketData = `${ticket.id}|${ticket.name}|${ticket.event}|${ticket.date}`;
    const publicKeyObj = forge.pki.publicKeyFromPem(publicKeyPem);
    const md = forge.md.sha256.create();
    md.update(ticketData, 'utf8');
    const rsaValid = publicKeyObj.verify(md.digest().bytes(), forge.util.decode64(ticket.signature));
    if (!rsaValid) return res.json({ valid: false, reason: 'RSA Signature tidak valid — tiket palsu atau dimodifikasi' });
  } catch {
    return res.json({ valid: false, reason: 'Gagal verifikasi RSA signature' });
  }

  if (!verifyDynamicToken(sha256, token))
    return res.json({ valid: false, reason: 'Token QR sudah kedaluwarsa — minta peserta refresh halaman tiketnya' });

  db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run('used', ticket.id);
  res.json({ valid: true, reason: 'Tiket valid dan sah — peserta berhasil masuk', ticket });
});

// ─── GET /tickets ─────────────────────────────────────────────────────────────
app.get('/tickets', (req, res) => {
  const rows = db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all();
  const today = getLocalDate();
  const tickets = rows.map(t => {
    if (t.status === 'active' && today > t.date) {
      db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run('expired', t.id);
      return { ...t, status: 'expired' };
    }
    return t;
  });
  res.json(tickets);
});

// ─── DELETE /tickets/dead ──────────────────────────────────────────────────────
app.delete('/tickets/dead', (req, res) => {
  const result = db.prepare("DELETE FROM tickets WHERE status IN ('used', 'expired')").run();
  res.json({ deleted: result.changes });
});

// ─── DELETE /tickets/dead/old ──────────────────────────────────────────────────
app.delete('/tickets/dead/old', (req, res) => {
  const result = db.prepare(`DELETE FROM tickets WHERE status IN ('used','expired') AND created_at <= datetime('now', '-5 days')`).run();
  res.json({ deleted: result.changes });
});

// ─── Shared scan state ─────────────────────────────────────────────────────────
let pendingScan = null;

app.post('/scan-result', (req, res) => {
  const { qrContent } = req.body;
  pendingScan = { qrContent, timestamp: Date.now() };
  res.json({ ok: true });
});

app.get('/scan-result', (req, res) => {
  if (!pendingScan) return res.json({ found: false });
  if (Date.now() - pendingScan.timestamp > 30000) {
    pendingScan = null;
    return res.json({ found: false });
  }
  const data = pendingScan;
  pendingScan = null;
  res.json({ found: true, qrContent: data.qrContent });
});

app.listen(3001, () => console.log('✓ Backend running at http://localhost:3001'));