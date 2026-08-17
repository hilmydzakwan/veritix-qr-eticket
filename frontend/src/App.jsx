import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";

const API = window.location.hostname.startsWith("192.168")
  ? "http://192.168.100.6:3001"
  : "https://possibly-discard-basically.ngrok-free.dev";

// ─── Warna tiket per acara (cycling) ─────────────────────────────────────────
const TICKET_THEMES = [
  { bg: "#0f172a", accent: "#38bdf8", text: "#e2e8f0", stripe: "#1e293b", accentText: "#0ea5e9" },
  { bg: "#1a0a2e", accent: "#c084fc", text: "#f3e8ff", stripe: "#2d1052", accentText: "#a855f7" },
  { bg: "#052e16", accent: "#4ade80", text: "#dcfce7", stripe: "#14532d", accentText: "#22c55e" },
  { bg: "#1c0a00", accent: "#fb923c", text: "#ffedd5", stripe: "#431407", accentText: "#f97316" },
  { bg: "#0c1445", accent: "#60a5fa", text: "#dbeafe", stripe: "#1e3a8a", accentText: "#3b82f6" },
  { bg: "#2d0a0a", accent: "#f87171", text: "#fee2e2", stripe: "#7f1d1d", accentText: "#ef4444" },
];

function getTheme(eventName) {
  let hash = 5381;
  for (let i = 0; i < eventName.length; i++) {
    hash = Math.imul(hash, 33) ^ eventName.charCodeAt(i);
    hash = hash >>> 0;
  }
  return TICKET_THEMES[hash % TICKET_THEMES.length];
}

// ─── Ticket Card Horizontal ───────────────────────────────────────────────────
function TicketCard({ ticket }) {
  const theme = getTheme(ticket.event || ticket.name);
  const shortId = (ticket.ticketId || ticket.id || "").slice(0, 12).toUpperCase();

  return (
    <div style={{
      display: "flex", borderRadius: 18, overflow: "hidden",
      fontFamily: "'Outfit', sans-serif",
      boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
      width: "100%", maxWidth: 620, margin: "0 auto", position: "relative",
    }}>
      <div style={{ flex: 1, background: theme.bg, padding: "22px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: theme.accent, opacity: 0.06 }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: theme.accent, opacity: 0.08 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: theme.accent, opacity: 0.9 }}>VeriTix · E-Ticket</span>
          <span style={{ fontSize: 9, fontWeight: 600, color: theme.text, opacity: 0.4, letterSpacing: "1px" }}>#{shortId}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: theme.text, lineHeight: 1.2, marginBottom: 6, letterSpacing: "-0.5px" }}>{ticket.event}</div>
        <div style={{ fontSize: 13, color: theme.accent, fontWeight: 600, marginBottom: 18, letterSpacing: "0.3px" }}>{ticket.name}</div>
        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <div style={{ fontSize: 9, color: theme.text, opacity: 0.4, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 3 }}>Tanggal</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{ticket.date}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: theme.text, opacity: 0.4, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 3 }}>Status</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.bg, background: theme.accent, padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
              {ticket.status === "active" ? "AKTIF" : ticket.status === "pending" ? "PENDING" : ticket.status === "used" ? "USED" : "EXPIRED"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: 1, background: `repeating-linear-gradient(to bottom, ${theme.stripe} 0px, ${theme.stripe} 6px, transparent 6px, transparent 12px)`, position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 20, height: 20, borderRadius: "50%", background: "#f0eeff" }} />
        <div style={{ position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)", width: 20, height: 20, borderRadius: "50%", background: "#f0eeff" }} />
      </div>

      <div style={{ width: 110, background: theme.stripe, padding: "22px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, color: theme.text, opacity: 0.4, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 }}>Ticket ID</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.accent, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.5, textAlign: "center" }}>{shortId}</div>
        </div>
        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 40 }}>
          {[8,12,6,14,10,5,16,8,11,7,13,6].map((h, i) => (
            <div key={i} style={{ width: 3, height: h, borderRadius: 1, background: theme.accent, opacity: 0.6 }} />
          ))}
        </div>
        <div style={{ fontSize: 8, color: theme.text, opacity: 0.3, textAlign: "center", letterSpacing: "0.5px" }}>RSA · SHA256</div>
      </div>
    </div>
  );
}

// ─── VeriTix Logo Component ───────────────────────────────────────────────────
function VeriTixLogo({ size = 52 }) {
  return (
    <img
      src="/logobarusistem.png"
      alt="VeriTix Logo"
      style={{ width: size, height: size, borderRadius: size * 0.3, objectFit: "cover", display: "block" }}
      onError={(e) => {
        e.target.style.display = "none";
        e.target.nextSibling.style.display = "flex";
      }}
    />
  );
}

// ─── Fallback logo SVG jika gambar tidak ditemukan ───────────────────────────
function LogoFallback({ size = 52 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.3, background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(124,58,237,0.4)" }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <rect x="5" y="11" width="14" height="10" rx="2" fill="white" fillOpacity="0.95" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1.5" fill="#7c3aed" />
      </svg>
    </div>
  );
}

// ─── Header Logo dengan fallback ─────────────────────────────────────────────
function AppLogo({ size = 90 }) {
  const [imgError, setImgError] = useState(false);
  return imgError ? <LogoFallback size={size} /> : (
    <img
      src="/logobarusistem.png"
      alt="VeriTix"
      style={{ height: size, width: "auto", display: "block" }}
      onError={() => setImgError(true)}
    />
  );
}

export default function App() {
  const [tab, setTab] = useState("register");
  const [form, setForm] = useState({ name: "", email: "", event: "", date: "" });
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [verifyResult, setVerifyResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [pendingQR, setPendingQR] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const TICKETS_PER_PAGE = 10;

  const [events, setEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem("eticket_events") || "[]"); } catch { return []; }
  });
  const [newEventName, setNewEventName] = useState("");
  const [showEventManager, setShowEventManager] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const pollingRef = useRef(null);
  const isProcessingRef = useRef(false);

  const saveEvents = (list) => {
    setEvents(list);
    localStorage.setItem("eticket_events", JSON.stringify(list));
  };

  const addEvent = () => {
    const name = newEventName.trim();
    if (!name) return;
    if (events.includes(name)) { showToast("Nama acara sudah ada!", "error"); return; }
    saveEvents([...events, name]);
    setNewEventName("");
    showToast(`Acara "${name}" ditambahkan ✓`);
  };

  const removeEvent = (name) => {
    saveEvents(events.filter(e => e !== name));
    if (form.event === name) setForm({ ...form, event: "" });
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTickets = async () => {
    const res = await fetch(`${API}/tickets`, { headers: { "ngrok-skip-browser-warning": "true" } });
    const data = await res.json();
    setTickets(data);
  };

  useEffect(() => { if (tab === "history") fetchTickets(); }, [tab]);
  useEffect(() => { if (tab !== "verify") stopCamera(); }, [tab]);

  useEffect(() => {
    if (tab === "verify" && !previewData && !verifyResult) {
      isProcessingRef.current = false;
      pollingRef.current = setInterval(async () => {
        if (isProcessingRef.current) return;
        try {
          const res = await fetch(`${API}/scan-result`, { headers: { "ngrok-skip-browser-warning": "true" } });
          const data = await res.json();
          if (data.found) {
            isProcessingRef.current = true;
            clearInterval(pollingRef.current);
            handlePreview(data.qrContent);
          }
        } catch {}
      }, 2000);
    }
    return () => clearInterval(pollingRef.current);
  }, [tab, previewData, verifyResult]);

  const stopCamera = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanFrame();
      }
    } catch { showToast("Tidak bisa akses kamera", "error"); }
  };

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanFrame); return;
    }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) { stopCamera(); handlePreview(code.data); return; }
    animRef.current = requestAnimationFrame(scanFrame);
  }, []);

  const handleGenerate = async () => {
    if (!form.name || !form.email || !form.event || !form.date) { showToast("Semua field wajib diisi!", "error"); return; }
    if (!/^[a-zA-Z\s]+$/.test(form.name.trim())) { showToast("Nama hanya boleh huruf dan spasi!", "error"); return; }
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(form.email.trim())) { showToast("Email harus format @gmail.com!", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
if (data.error) { showToast(data.error, "error"); return; }
setTicket(data);
setForm(prev => ({ ...prev, name: "", email: "" }));
setTab("ticket");
showToast("Tiket berhasil dibuat!");
    } catch { showToast("Gagal menghubungi server!", "error"); }
    setLoading(false);
  };

  const handleApprove = async () => {
    if (!ticket) return;
    setApproving(true);
    try {
      const res = await fetch(`${API}/approve/${ticket.ticketId}`, { method: "POST" });
      const data = await res.json();
      if (data.error) { showToast(data.error, "error"); }
      else { setTicket({ ...ticket, status: "active" }); showToast("Tiket disetujui! Link QR dikirim ke email ✓"); }
    } catch { showToast("Gagal menghubungi server!", "error"); }
    setApproving(false);
  };

  const handlePreview = async (qrData) => {
    setLoading(true); setPendingQR(qrData);
    try {
      const res = await fetch(`${API}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrContent: qrData }),
      });
      const data = await res.json();
      if (!data.valid) { setVerifyResult(data); setPendingQR(null); }
      else { setPreviewData(data); }
    } catch { showToast("Gagal menghubungi server!", "error"); }
    setLoading(false);
  };

  const handleConfirmVerify = async () => {
    if (!pendingQR) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrContent: pendingQR }),
      });
      const data = await res.json();
      setVerifyResult(data); setPreviewData(null); setPendingQR(null);
    } catch { showToast("Gagal menghubungi server!", "error"); }
    setLoading(false);
  };

  const resetVerify = () => {
    setVerifyResult(null); setPreviewData(null); setPendingQR(null);
    isProcessingRef.current = false;
  };

  const handleDelete = async (type) => {
    const endpoint = type === "old" ? "/tickets/dead/old" : "/tickets/dead";
    try {
      const res = await fetch(`${API}${endpoint}`, { method: "DELETE" });
      const data = await res.json();
      setConfirmDelete(null); fetchTickets();
      showToast(`${data.deleted} tiket berhasil dihapus`);
    } catch { showToast("Gagal menghapus tiket", "error"); }
  };

  const statusConfig = {
    pending:  { label: "Menunggu Bayar", bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
    active:   { label: "Aktif",          bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
    used:     { label: "Terpakai",        bg: "#ede9fe", color: "#4c1d95", border: "#c4b5fd" },
    expired:  { label: "Kedaluwarsa",    bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
  };
  const statusIcon = { pending: "⏳", active: "✅", used: "🎫", expired: "⏰" };

  const tabs = [
    { id: "register", label: "Registrasi", icon: "✦" },
    { id: "ticket",   label: "Tiket",       icon: "◈" },
    { id: "verify",   label: "Verifikasi",  icon: "◎" },
    { id: "history",  label: "Riwayat",     icon: "≡" },
  ];

  const deadCount = tickets.filter(t => t.status === "used" || t.status === "expired").length;

  return (
    <div style={{ minHeight: "100vh", background: "#f0eeff", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, button, select { font-family: 'Outfit', sans-serif; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }

        .tab-btn { transition: all 0.22s cubic-bezier(.4,0,.2,1); }
        .tab-btn:hover { transform: translateY(-1px); }

        .action-btn { transition: all 0.2s cubic-bezier(.4,0,.2,1); }
        .action-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(124,58,237,0.35); }
        .action-btn:active:not(:disabled) { transform: translateY(0); }

        .approve-btn { transition: all 0.2s cubic-bezier(.4,0,.2,1); }
        .approve-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(5,150,105,0.3); }

        .confirm-verify-btn { transition: all 0.2s cubic-bezier(.4,0,.2,1); }
        .confirm-verify-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(22,163,74,0.3); }

        .cancel-btn { transition: all 0.18s ease; }
        .cancel-btn:hover { background: #fee2e2 !important; border-color: #fca5a5 !important; color: #dc2626 !important; }

        .card-hover { transition: all 0.2s cubic-bezier(.4,0,.2,1); cursor: pointer; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(124,58,237,0.12); border-color: #a78bfa !important; }

        .field-input { transition: all 0.2s ease; }
        .field-input:focus { outline: none; border-color: #7c3aed !important; background: #fff !important; box-shadow: 0 0 0 4px rgba(124,58,237,0.12); }

        .field-select { transition: all 0.2s ease; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237c3aed' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center; }
        .field-select:focus { outline: none; border-color: #7c3aed !important; background-color: #fff !important; box-shadow: 0 0 0 4px rgba(124,58,237,0.12); }

        .refresh-btn { transition: all 0.2s ease; }
        .refresh-btn:hover { background: #ede9fe !important; color: #7c3aed !important; border-color: #a78bfa !important; }

        .del-btn { transition: all 0.18s ease; }
        .del-btn:hover:not(:disabled) { transform: translateY(-1px); }

        .event-tag { transition: all 0.15s ease; }
        .event-tag:hover { transform: scale(1.02); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(15,7,40,0.55); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .modal-box { background: #fff; border-radius: 28px; padding: 28px; max-width: 580px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 32px 80px rgba(124,58,237,0.2); }
        .confirm-box { background: #fff; border-radius: 24px; padding: 28px; max-width: 400px; width: 100%; box-shadow: 0 32px 80px rgba(124,58,237,0.2); }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes slideUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        .slide-up { animation: slideUp 0.28s cubic-bezier(.4,0,.2,1) forwards; }
        .toast-in { animation: toastIn 0.28s cubic-bezier(.4,0,.2,1) forwards; }

        /* Gradient text */
        .gradient-title {
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0ea5e9 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gradient-title-warm {
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Section title gradient */
        .section-title {
          background: linear-gradient(120deg, #1e1b4b 0%, #4f46e5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Header glassy bg */
        .header-glass {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(124,58,237,0.1);
        }

        /* Subtle mesh background on body */
        body {
          background: #f0eeff;
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="toast-in" style={{
          position: "fixed", top: 24, right: 24, zIndex: 999,
          padding: "14px 22px", borderRadius: 16, fontSize: 13, fontWeight: 600,
          background: toast.type === "error" ? "#fff1f2" : "#f0fdf4",
          border: `1.5px solid ${toast.type === "error" ? "#fda4af" : "#86efac"}`,
          color: toast.type === "error" ? "#be123c" : "#166534",
          boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
          maxWidth: 340, display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>{toast.type === "error" ? "✕" : "✓"}</span>
          {toast.msg}
        </div>
      )}

      {/* Konfirmasi hapus */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 14px" }}>🗑️</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>
                {confirmDelete === "old" ? "Hapus tiket mati 5+ hari?" : "Hapus semua tiket mati?"}
              </h3>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
                {confirmDelete === "old"
                  ? "Tiket 'Terpakai' atau 'Kedaluwarsa' yang dibuat lebih dari 5 hari lalu akan dihapus permanen."
                  : "Semua tiket 'Terpakai' atau 'Kedaluwarsa' akan dihapus permanen. Tidak bisa dibatalkan."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", background: "#f5f5f5", border: "1.5px solid #e5e5e5", borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#666" }}>Batal</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, padding: "12px", background: "#dc2626", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff", boxShadow: "0 4px 16px rgba(220,38,38,0.3)" }}>Hapus Permanen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detail tiket */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1e1b4b" }}>Detail Tiket</h3>
              <button onClick={() => setSelectedTicket(null)} style={{ background: "#f5f3ff", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16, color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ marginBottom: 22 }}>
              <TicketCard ticket={selectedTicket} />
            </div>
            <div style={{ background: "#fafafa", border: "1.5px solid #ede9fe", borderRadius: 18, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Ticket ID", value: selectedTicket.id },
                  { label: "Email", value: selectedTicket.email },
                  { label: "Acara", value: selectedTicket.event },
                  { label: "Tanggal", value: selectedTicket.date },
                  { label: "Dibuat", value: selectedTicket.created_at },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f0eeff", paddingBottom: 8 }}>
                    <p style={{ fontSize: 12, color: "#a78bfa", fontWeight: 500 }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: "#1e1b4b", fontWeight: 600, textAlign: "right", maxWidth: "65%", wordBreak: "break-all" }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#a78bfa", padding: "8px 0", userSelect: "none", fontWeight: 600 }}>
                🔐 Lihat data kriptografi
              </summary>
              <div style={{ marginTop: 10 }}>
                <div style={{ background: "#f0fdf4", borderRadius: 14, padding: "14px 16px", border: "1.5px solid #86efac", marginBottom: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#059669", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>SHA-256 Hash</p>
                  <p style={{ fontSize: 11, color: "#065f46", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.7 }}>{selectedTicket.hash}</p>
                </div>
                <div style={{ background: "#f5f3ff", borderRadius: 14, padding: "14px 16px", border: "1.5px solid #c4b5fd" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>RSA Digital Signature (Base64)</p>
                  <p style={{ fontSize: 11, color: "#4c1d95", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.7 }}>{selectedTicket.signature}</p>
                </div>
              </div>
            </details>
            {selectedTicket.status === "pending" && (
              <button onClick={async () => {
                try {
                  const res = await fetch(`${API}/approve/${selectedTicket.id}`, { method: "POST" });
                  const data = await res.json();
                  if (data.error) { showToast(data.error, "error"); }
                  else { showToast("Tiket disetujui! Email terkirim ✓"); setSelectedTicket(null); fetchTickets(); }
                } catch { showToast("Gagal menghubungi server!", "error"); }
              }} style={{ width: "100%", marginTop: 6, padding: "14px", background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)", color: "#fff", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 20px rgba(5,150,105,0.3)" }}>
                ✓ ACC Pembayaran & Kirim Link ke Peserta
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="header-glass" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0 0" }}>
           <div style={{ marginBottom: 14}}>
              <AppLogo size={100} />
            </div>
            <p style={{ fontSize: 12, color: "#a78bfa", marginTop: 5, letterSpacing: "0.8px", fontWeight: 500 }}>
              RSA Digital Signature · SHA-256 · Cryptography Security
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, padding: "5px 14px", background: "#f0fdf4", borderRadius: 99, border: "1.5px solid #86efac" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 0 3px rgba(34,197,94,0.2)" }} />
              <span style={{ fontSize: 11, color: "#166534", fontWeight: 700, letterSpacing: "0.3px" }}>Backend Active</span>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "18px 0 0" }}>
            {tabs.map((t) => (
              <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
                padding: "10px 20px", borderRadius: "12px 12px 0 0",
                border: "none", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                cursor: "pointer",
                background: tab === t.id ? "#f0eeff" : "transparent",
                color: tab === t.id ? "#7c3aed" : "#9ca3af",
                borderTop: tab === t.id ? "2.5px solid #7c3aed" : "2.5px solid transparent",
                position: "relative",
              }}>
                <span style={{ marginRight: 6, fontSize: 10 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "36px 28px 80px" }}>

        {/* ══════════ REGISTER ══════════ */}
        {tab === "register" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <h2 className="section-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>Buat Tiket Baru</h2>
              <p style={{ fontSize: 13, color: "#a78bfa", marginTop: 6, fontWeight: 500 }}>Data tiket diamankan dengan enkripsi RSA + SHA-256</p>
            </div>

            {/* Event Manager */}
            <div style={{ background: "#fff", borderRadius: 22, border: "1.5px solid #ede9fe", padding: "22px 24px", boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showEventManager ? 18 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>Kelola Acara</span>
                  <span style={{ fontSize: 11, background: "#ede9fe", color: "#7c3aed", padding: "3px 12px", borderRadius: 99, fontWeight: 700 }}>{events.length} acara</span>
                </div>
                <button onClick={() => setShowEventManager(!showEventManager)} style={{ fontSize: 12, color: "#7c3aed", background: "#f5f3ff", border: "1.5px solid #c4b5fd", borderRadius: 10, padding: "6px 16px", cursor: "pointer", fontWeight: 600, transition: "all 0.18s" }}>
                  {showEventManager ? "Tutup ↑" : "Kelola ↓"}
                </button>
              </div>
              {showEventManager && (
                <div style={{ animation: "slideUp 0.2s ease" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <input className="field-input" type="text" placeholder="Nama acara baru..." value={newEventName}
                      onChange={e => setNewEventName(e.target.value)} onKeyDown={e => e.key === "Enter" && addEvent()}
                      style={{ flex: 1, padding: "11px 16px", borderRadius: 12, border: "1.5px solid #e0d7ff", fontSize: 13, color: "#1e1b4b", background: "#faf9ff" }} />
                    <button onClick={addEvent} style={{ padding: "11px 20px", background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
                      + Tambah
                    </button>
                  </div>
                  {events.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#c4b5fd", textAlign: "center", padding: "12px 0" }}>Belum ada acara — tambah dulu di atas</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {events.map((ev) => {
                        const theme = getTheme(ev);
                        return (
                          <div key={ev} className="event-tag" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 14px", borderRadius: 99, background: theme.bg, border: `1.5px solid ${theme.accent}44`, cursor: "default" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>{ev}</span>
                            <button onClick={() => removeEvent(ev)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: theme.accent, opacity: 0.5, lineHeight: 1, padding: 0 }}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Form registrasi */}
            <div style={{ background: "#fff", borderRadius: 22, padding: "28px 28px", border: "1.5px solid #ede9fe", display: "flex", flexDirection: "column", gap: 20, boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}>
              {[
                { key: "name", label: "Nama Peserta", type: "text", placeholder: "contoh: Andi Saputra" },
                { key: "email", label: "Email Peserta", type: "email", placeholder: "contoh: andi@gmail.com" },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 8, letterSpacing: "0.3px" }}>{label}</label>
                  <input className="field-input" type={type} placeholder={placeholder} value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    style={{ width: "100%", padding: "13px 16px", borderRadius: 13, border: "1.5px solid #e0d7ff", fontSize: 14, color: "#1e1b4b", background: "#faf9ff" }} />
                </div>
              ))}

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 8, letterSpacing: "0.3px" }}>
                  Nama Acara
                  {events.length === 0 && <span style={{ color: "#f59e0b", marginLeft: 8, fontSize: 11, fontWeight: 600 }}>— tambahkan acara dulu ↑</span>}
                </label>
                {events.length > 0 ? (
                  <select className="field-select" value={form.event} onChange={e => setForm({ ...form, event: e.target.value })}
                    style={{ width: "100%", padding: "13px 16px", borderRadius: 13, border: "1.5px solid #e0d7ff", fontSize: 14, color: form.event ? "#1e1b4b" : "#9ca3af", background: "#faf9ff", cursor: "pointer" }}>
                    <option value="" disabled>Pilih acara...</option>
                    {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                  </select>
                ) : (
                  <div style={{ padding: "13px 16px", borderRadius: 13, border: "1.5px dashed #c4b5fd", fontSize: 13, color: "#c4b5fd", background: "#faf9ff", textAlign: "center" }}>Belum ada acara tersedia</div>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 8, letterSpacing: "0.3px" }}>Tanggal Acara</label>
                <input className="field-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  style={{ width: "100%", padding: "13px 16px", borderRadius: 13, border: "1.5px solid #e0d7ff", fontSize: 14, color: "#1e1b4b", background: "#faf9ff" }} />
              </div>

              <button className="action-btn" onClick={handleGenerate} disabled={loading || events.length === 0} style={{
                width: "100%", padding: "15px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700, cursor: loading || events.length === 0 ? "not-allowed" : "pointer", marginTop: 4,
                background: loading || events.length === 0 ? "#c4b5fd" : "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                color: "#fff", letterSpacing: "0.2px", boxShadow: loading || events.length === 0 ? "none" : "0 6px 20px rgba(124,58,237,0.35)",
              }}>
                {loading ? "⏳ Memproses..." : "Generate Tiket"}

              </button>
            </div>

            {/* Alur sistem */}
            <div style={{ background: "#fff", borderRadius: 22, padding: "24px 28px", border: "1.5px solid #ede9fe", boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd", letterSpacing: "2px", marginBottom: 18, textTransform: "uppercase", textAlign: "center" }}>Alur Sistem VeriTix</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { num: "01", text: "Tambah nama acara di panel Kelola Acara (sekali saja, bisa dipakai berulang)", bg: "#f5f3ff", accent: "#7c3aed", dot: "#7c3aed" },
                  { num: "02", text: "Isi data peserta + pilih acara → tiket dibuat (status: menunggu pembayaran)", bg: "#fffbeb", accent: "#d97706", dot: "#f59e0b" },
                  { num: "03", text: "Peserta bayar → panitia klik ACC → link QR dikirim otomatis ke email peserta", bg: "#f0fdf4", accent: "#059669", dot: "#22c55e" },
                  { num: "04", text: "Hari H: peserta buka bukti pesan email, tunjukkan email ke panitia untuk di-scan & verifikasi", bg: "#fdf2f8", accent: "#9333ea", dot: "#c026d3" },
                ].map(s => (
                  <div key={s.num} style={{ background: s.bg, borderRadius: 14, padding: "13px 18px", display: "flex", gap: 14, alignItems: "flex-start", border: `1px solid ${s.accent}22` }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: s.accent, flexShrink: 0, marginTop: 1, fontFamily: "monospace" }}>{s.num}</span>
                    <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, fontWeight: 500 }}>{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TICKET ══════════ */}
        {tab === "ticket" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <h2 className="section-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>Detail Tiket</h2>
              <p style={{ fontSize: 13, color: "#a78bfa", marginTop: 6, fontWeight: 500 }}>Konfirmasi pembayaran dan kirim link QR ke peserta</p>
            </div>
            {ticket ? (
              <>
                {ticket.status === "active" ? (
                  <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 18, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>✅</div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#166534" }}>Link QR sudah terkirim!</p>
                      <p style={{ fontSize: 12, color: "#16a34a", marginTop: 3, fontWeight: 500 }}>Email dikirim ke <strong>{ticket.email}</strong> · Peserta bisa buka QR dinamisnya</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 18, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>⏳</div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#92400e" }}>Menunggu Konfirmasi Pembayaran</p>
                      <p style={{ fontSize: 12, color: "#d97706", marginTop: 3, fontWeight: 500 }}>Setelah peserta membayar, klik tombol ACC di bawah</p>
                    </div>
                  </div>
                )}

                <TicketCard ticket={{ ...ticket, id: ticket.ticketId }} />

                <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #ede9fe", overflow: "hidden", boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}>
                  <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { label: "Ticket ID", value: ticket.ticketId?.slice(0, 20) + "..." },
                      { label: "Nama", value: ticket.name },
                      { label: "Email", value: ticket.email },
                      { label: "Acara", value: ticket.event },
                      { label: "Tanggal", value: ticket.date },
                    ].map(item => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f5f3ff", paddingBottom: 10 }}>
                        <p style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600 }}>{item.label}</p>
                        <p style={{ fontSize: 13, color: "#1e1b4b", fontWeight: 700, textAlign: "right", maxWidth: "60%" }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {ticket.status !== "active" && (
                  <button className="approve-btn" onClick={handleApprove} disabled={approving} style={{
                    width: "100%", padding: "16px", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700,
                    cursor: approving ? "not-allowed" : "pointer", color: "#fff",
                    background: approving ? "#6ee7b7" : "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                    boxShadow: approving ? "none" : "0 6px 20px rgba(5,150,105,0.35)",
                  }}>
                    {approving ? "Mengirim email..." : "✓ ACC Pembayaran & Kirim Link ke Peserta →"}
                  </button>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0 24px", background: "#fff", borderRadius: 22, border: "1.5px solid #ede9fe", boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}>
                <img src="/icontiket.png" style={{ width: 150, height: 150, marginBottom: 8, objectFit: "contain" }} />
                <p style={{ fontSize: 14, color: "#c4b5fd", fontWeight: 500 }}>Belum ada tiket — buat tiket dulu di tab Registrasi</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════ VERIFY ══════════ */}
        {tab === "verify" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <h2 className="section-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>Verifikasi Tiket</h2>
              <p style={{ fontSize: 13, color: "#a78bfa", marginTop: 6, fontWeight: 500 }}>Scan QR peserta — preview data, lalu konfirmasi masuk</p>
            </div>

            {!previewData && !verifyResult && (
              <div style={{ background: "#fff", borderRadius: 22, padding: "48px 40px", border: "1.5px solid #ede9fe", textAlign: "center", boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}>
                <img src="/iconscan.png" style={{ width: 250, height: 250, marginBottom: 16, objectFit: "contain" }} />
                <p style={{ fontSize: 17, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>Menunggu Scan dari HP</p>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 28, lineHeight: 1.6, fontWeight: 500 }}>
                  Buka <strong style={{ color: "#7c3aed" }}>/admin</strong> di HP panitia lewat ngrok,<br/>scan QR peserta — hasilnya otomatis muncul di sini
                </p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#f5f3ff", border: "1.5px solid #c4b5fd", borderRadius: 99, padding: "10px 24px" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#7c3aed", display: "inline-block", animation: "pulse 1.2s infinite", boxShadow: "0 0 0 3px rgba(124,58,237,0.2)" }} />
                  <span style={{ fontSize: 13, color: "#7c3aed", fontWeight: 700 }}>Polling setiap 2 detik...</span>
                </div>
              </div>
            )}

            {previewData && !verifyResult && (
              <div className="slide-up" style={{ background: "#fff", borderRadius: 22, border: "1.5px solid #a78bfa", overflow: "hidden", boxShadow: "0 8px 32px rgba(124,58,237,0.15)" }}>
                <div style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)", padding: "22px 26px" }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 5, fontWeight: 700 }}>QR Valid · Konfirmasi Masuk?</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>{previewData.ticket.name}</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4, fontWeight: 500 }}>{previewData.ticket.event}</p>
                </div>
                <div style={{ padding: "22px 26px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Nama",    value: previewData.ticket.name },
                    { label: "Email",   value: previewData.ticket.email },
                    { label: "Acara",   value: previewData.ticket.event },
                    { label: "Tanggal", value: previewData.ticket.date },
                  ].map(item => (
                    <div key={item.label} style={{ background: "#faf9ff", borderRadius: 12, padding: "10px 14px", border: "1px solid #ede9fe" }}>
                      <p style={{ fontSize: 10, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>{item.label}</p>
                      <p style={{ fontSize: 13, color: "#1e1b4b", fontWeight: 700, marginTop: 3, wordBreak: "break-word" }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "0 26px", display: "flex", gap: 8, marginBottom: 16 }}>
                  {[
                    { icon: "✓", label: "SHA-256", sub: "Hash cocok", bg: "#f0fdf4", border: "#86efac", color: "#059669", subcolor: "#22c55e" },
                    { icon: "✓", label: "RSA", sub: "Signature valid", bg: "#f5f3ff", border: "#c4b5fd", color: "#7c3aed", subcolor: "#a78bfa" },
                    { icon: "✓", label: "Token", sub: "Belum expired", bg: "#fffbeb", border: "#fde68a", color: "#d97706", subcolor: "#f59e0b" },
                  ].map(b => (
                    <div key={b.label} style={{ flex: 1, background: b.bg, border: `1.5px solid ${b.border}`, borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                      <p style={{ fontSize: 11, color: b.color, fontWeight: 700 }}>{b.icon} {b.label}</p>
                      <p style={{ fontSize: 10, color: b.subcolor, marginTop: 2, fontWeight: 500 }}>{b.sub}</p>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "0 26px 26px", display: "flex", gap: 10 }}>
                  <button className="confirm-verify-btn" onClick={handleConfirmVerify} disabled={loading} style={{ flex: 2, padding: "14px", background: loading ? "#6ee7b7" : "linear-gradient(135deg, #16a34a 0%, #059669 100%)", color: "#fff", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 6px 18px rgba(22,163,74,0.3)" }}>
                    {loading ? "Memproses..." : "Konfirmasi Masuk"}
                  </button>
                  <button className="cancel-btn" onClick={resetVerify} style={{ flex: 1, padding: "14px", background: "#faf9ff", color: "#7c3aed", border: "1.5px solid #c4b5fd", borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    ✕ Batal
                  </button>
                </div>
              </div>
            )}

            {verifyResult && (
              <div className="slide-up" style={{ borderRadius: 22, padding: 28, border: `2px solid ${verifyResult.valid ? "#86efac" : "#fca5a5"}`, background: verifyResult.valid ? "#f0fdf4" : "#fff5f5", boxShadow: verifyResult.valid ? "0 8px 32px rgba(22,163,74,0.12)" : "0 8px 32px rgba(220,38,38,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: verifyResult.ticket ? 22 : 18 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 18, flexShrink: 0, background: verifyResult.valid ? "#dcfce7" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                    {verifyResult.valid ? "✅" : "❌"}
                  </div>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: verifyResult.valid ? "#166534" : "#991b1b", letterSpacing: "-0.3px" }}>
                      {verifyResult.valid ? "TIKET VALID — PESERTA MASUK" : "TIKET TIDAK VALID"}
                    </p>
                    <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, fontWeight: 500 }}>{verifyResult.reason}</p>
                  </div>
                </div>
                {verifyResult.ticket && (
                  <div style={{ borderTop: `1.5px solid ${verifyResult.valid ? "#86efac" : "#fca5a5"}`, paddingTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                    {[
                      { label: "Nama", value: verifyResult.ticket.name },
                      { label: "Email", value: verifyResult.ticket.email },
                      { label: "Acara", value: verifyResult.ticket.event },
                      { label: "Tanggal", value: verifyResult.ticket.date },
                    ].map(item => (
                      <div key={item.label} style={{ background: "rgba(255,255,255,0.75)", borderRadius: 12, padding: "10px 14px" }}>
                        <p style={{ fontSize: 10, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700 }}>{item.label}</p>
                        <p style={{ fontSize: 13, color: "#1e1b4b", fontWeight: 700, marginTop: 3 }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={resetVerify} style={{ width: "100%", padding: "13px", background: "rgba(255,255,255,0.8)", border: "1.5px solid rgba(0,0,0,0.08)", borderRadius: 13, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#4b5563" }}>
                  ↩ Scan Tiket Lain
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════ HISTORY ══════════ */}
        {tab === "history" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
    <div style={{ textAlign: "center" }}>
      <h2 className="section-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>Riwayat Tiket</h2>
      <p style={{ fontSize: 13, color: "#a78bfa", marginTop: 6, fontWeight: 500 }}>{tickets.length} tiket terdaftar · klik untuk lihat detail</p>
    </div>

    {/* Search bar */}
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#a78bfa", pointerEvents: "none" }}>🔍</span>
      <input
        className="field-input"
        type="text"
        placeholder="Cari nama, event atau email peserta..."
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); setHistoryPage(1); }}
        style={{ width: "100%", padding: "13px 16px 13px 42px", borderRadius: 14, border: "1.5px solid #e0d7ff", fontSize: 13, color: "#1e1b4b", background: "#fff", boxShadow: "0 2px 10px rgba(124,58,237,0.06)" }}
      />
      {searchQuery && (
        <button onClick={() => { setSearchQuery(""); setHistoryPage(1); }} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "#ede9fe", border: "none", borderRadius: 8, width: 26, height: 26, cursor: "pointer", fontSize: 12, color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      )}
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
      <button className="refresh-btn" onClick={fetchTickets} style={{ padding: "9px 20px", borderRadius: 11, border: "1.5px solid #e0d7ff", background: "#fff", fontSize: 12, color: "#7c3aed", cursor: "pointer", fontWeight: 700 }}>↻ Refresh</button>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="del-btn" onClick={() => setConfirmDelete("old")} disabled={deadCount === 0} style={{ padding: "9px 16px", borderRadius: 11, border: "1.5px solid #fca5a5", background: "#fff5f5", fontSize: 12, color: "#dc2626", cursor: deadCount === 0 ? "not-allowed" : "pointer", fontWeight: 600, opacity: deadCount === 0 ? 0.4 : 1 }}>
          🗑 Hapus mati 5+ hari
        </button>
        <button className="del-btn" onClick={() => setConfirmDelete("all")} disabled={deadCount === 0} style={{ padding: "9px 16px", borderRadius: 11, border: "1.5px solid #fca5a5", background: "#fff5f5", fontSize: 12, color: "#dc2626", cursor: deadCount === 0 ? "not-allowed" : "pointer", fontWeight: 600, opacity: deadCount === 0 ? 0.4 : 1 }}>
          🗑 Hapus semua mati
        </button>
      </div>
    </div>

    {deadCount > 0 && !searchQuery && (
      <div style={{ background: "#fff5f5", border: "1.5px solid #fca5a5", borderRadius: 14, padding: "12px 18px" }}>
        <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Ada <strong>{deadCount} tiket mati</strong> (terpakai / kedaluwarsa) yang bisa dihapus</p>
      </div>
    )}

    {(() => {
      const filtered = tickets.filter(t =>
  t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  t.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  t.event?.toLowerCase().includes(searchQuery.toLowerCase())
);
      const totalPages = Math.ceil(filtered.length / TICKETS_PER_PAGE);
      const paginated = filtered.slice((historyPage - 1) * TICKETS_PER_PAGE, historyPage * TICKETS_PER_PAGE);

      return (
        <>
          {searchQuery && (
            <p style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600 }}>
              {filtered.length} hasil untuk "<strong>{searchQuery}</strong>"
            </p>
          )}

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", background: "#fff", borderRadius: 22, border: "1.5px solid #ede9fe", boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}>
              <img src="/iconriwayat.png" style={{ width: 150, height: 150, marginBottom: 14, objectFit: "contain" }} />
              <p style={{ fontSize: 14, color: "#c4b5fd", fontWeight: 500 }}>Tidak ada tiket yang cocok</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {paginated.map(t => {
                const s = statusConfig[t.status] || statusConfig.pending;
                const icon = statusIcon[t.status] || "⏳";
                return (
                  <div key={t.id} className="card-hover" onClick={() => setSelectedTicket(t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1.5px solid #ede9fe", borderRadius: 18, padding: "16px 20px", boxShadow: "0 2px 10px rgba(124,58,237,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: `1px solid ${s.border}` }}>{icon}</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>{t.name}</p>
                        <p style={{ fontSize: 12, color: "#7c3aed", marginTop: 2, fontWeight: 500 }}>{t.event} · {t.date}</p>
                        <p style={{ fontSize: 11, color: "#c4b5fd", marginTop: 2, fontWeight: 500 }}>{t.email}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 99, letterSpacing: "0.3px", textTransform: "uppercase", background: s.bg, color: s.color, border: `1.5px solid ${s.border}` }}>{s.label}</span>
                      <span style={{ fontSize: 14, color: "#c4b5fd", fontWeight: 600 }}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
              <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid #e0d7ff", background: "#fff", fontSize: 13, color: historyPage === 1 ? "#c4b5fd" : "#7c3aed", cursor: historyPage === 1 ? "not-allowed" : "pointer", fontWeight: 700 }}>← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setHistoryPage(p)} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${historyPage === p ? "#7c3aed" : "#e0d7ff"}`, background: historyPage === p ? "#7c3aed" : "#fff", fontSize: 13, color: historyPage === p ? "#fff" : "#7c3aed", cursor: "pointer", fontWeight: 700 }}>{p}</button>
              ))}
              <button onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} disabled={historyPage === totalPages} style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid #e0d7ff", background: "#fff", fontSize: 13, color: historyPage === totalPages ? "#c4b5fd" : "#7c3aed", cursor: historyPage === totalPages ? "not-allowed" : "pointer", fontWeight: 700 }}>Next →</button>
            </div>
          )}
        </>
      );
    })()}
  </div>
)}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
      <video ref={videoRef} style={{ display: "none" }} playsInline />
    </div>
  );
}