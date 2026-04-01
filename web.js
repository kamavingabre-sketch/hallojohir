// ╔══════════════════════════════════════════════════════════╗
// ║     WEB DASHBOARD - Admin Laporan Kecamatan              ║
// ║     Hallo Johor — Medan Johor                            ║
// ║     Jalankan: node web.js                                ║
// ╚══════════════════════════════════════════════════════════╝

import http from 'http';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { queueFeedback, getLivechatSessions, addLivechatMessage, closeLivechatSessionById, markLivechatRead, queueLivechatReply, addLaporanGroup, removeLaporanGroup, getGroupRouting, setGroupRouting, deleteLaporan, updateLaporanStatus, getLaporanById, queueStatusNotif, getKegiatan, addKegiatan, deleteKegiatan, queueBroadcast, getBroadcastHistory, getBroadcastChannels, addBroadcastChannel, removeBroadcastChannel, getWeatherBroadcastConfig, setWeatherBroadcastConfig, getBeritaPemkoAutoConfig, setBeritaPemkoAutoConfig, updateBeritaPemkoAutoState } from './store.js';
import { scrapeMedanJohorCuacaHariIni, formatCuacaWhatsApp, BMKG_MEDAN_JOHOR_URL } from './bmkg-cuaca.js';
import { KATEGORI_PENGADUAN } from './menu.js';
import { scrapeMedanBeritaArticles, downloadImageBuffer } from './medan-berita.js';
import { scrapePemkoBeritaArticles, downloadPemkoImageBuffer } from './medan-berita-pemko.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  PORT: process.env.PORT || process.env.WEB_PORT || 3000,
  ADMIN_USERNAME: process.env.ADMIN_USER || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASS || 'medanjohor2025',
  DATA_DIR: './data',
  SESSION_EXPIRE_HOURS: 8,
};

const sessions = new Map();
const createSession = () => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now() });
  return token;
};
const validateSession = (token) => {
  if (!token || !sessions.has(token)) return false;
  const s = sessions.get(token);
  if (Date.now() - s.createdAt > CONFIG.SESSION_EXPIRE_HOURS * 3600000) {
    sessions.delete(token);
    return false;
  }
  return true;
};
const parseCookies = (req) => {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(
    raw.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k?.trim(), decodeURIComponent(v.join('='))];
    }).filter(([k]) => k)
  );
};
const parseBody = (req) => new Promise(resolve => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try { resolve(Object.fromEntries(new URLSearchParams(body))); }
    catch { resolve({}); }
  });
});

const parseJSONBody = (req) => new Promise(resolve => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try { resolve(JSON.parse(body)); }
    catch { resolve({}); }
  });
});

// Pastikan folder foto_feedback tersedia
const FOTO_FEEDBACK_DIR = path.join(__dirname, CONFIG.DATA_DIR, 'foto_feedback');
if (!fs.existsSync(FOTO_FEEDBACK_DIR)) fs.mkdirSync(FOTO_FEEDBACK_DIR, { recursive: true });

// Pastikan folder broadcast_media tersedia
const BROADCAST_MEDIA_DIR = path.join(__dirname, CONFIG.DATA_DIR, 'broadcast_media');
if (!fs.existsSync(BROADCAST_MEDIA_DIR)) fs.mkdirSync(BROADCAST_MEDIA_DIR, { recursive: true });

const readJSON = (file) => {
  const p = path.join(__dirname, CONFIG.DATA_DIR, file);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
};
const getLaporan = () => {
  const d = readJSON('laporan_archive.json');
  return (d.laporan || []).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
};

const STATUS_META = {
  terkirim: { label: 'Terkirim',       color: '#60a5fa', bg: 'rgba(96,165,250,.15)',  icon: '📨' },
  diproses: { label: 'Diproses',       color: '#fbbf24', bg: 'rgba(251,191,36,.15)',  icon: '⚙️' },
  selesai:  { label: 'Selesai',        color: '#34d399', bg: 'rgba(52,211,153,.15)',  icon: '✅' },
  ditolak:  { label: 'Ditolak',        color: '#f87171', bg: 'rgba(248,113,113,.15)', icon: '❌' },
};
const statusBadgeHtml = (status) => {
  const m = STATUS_META[status] || { label: status||'-', color:'#94a3b8', bg:'rgba(148,163,184,.15)', icon:'📌' };
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;background:${m.bg};color:${m.color};border:1px solid ${m.color}33">${m.icon} ${m.label}</span>`;
};
const getGroups = () => (readJSON('laporan_groups.json').groups || []);
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      timeZone:'Asia/Jakarta', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
  } catch { return iso || '-'; }
};

const pageLogin = (error = '') => `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login — Hallo Johor Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#040d1a;--card:#0e1e38;--border:#1a3356;--cyan:#00c8ff;--green:#00e5a0;--text:#e2eaf5;--muted:#4a6a8a}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background-image:radial-gradient(ellipse 70% 60% at 15% 10%,rgba(0,200,255,.07) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 85% 85%,rgba(0,229,160,.05) 0%,transparent 60%),linear-gradient(rgba(0,200,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,255,.025) 1px,transparent 1px);background-size:auto,auto,48px 48px,48px 48px}
.wrap{width:100%;max-width:400px;padding:24px;animation:up .5s ease both}
@keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
.logo{text-align:center;margin-bottom:36px}
.logo-box{width:60px;height:60px;background:linear-gradient(135deg,var(--cyan),var(--green));border-radius:18px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:14px;box-shadow:0 0 36px rgba(0,200,255,.3)}
.logo-name{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;background:linear-gradient(135deg,#fff 30%,var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.logo-sub{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-top:3px}
.card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px;box-shadow:0 24px 60px rgba(0,0,0,.4)}
.card h2{font-family:'Syne',sans-serif;font-size:19px;font-weight:700;margin-bottom:5px}
.card p{font-size:13px;color:var(--muted);margin-bottom:24px}
.field{margin-bottom:16px}
label{display:block;font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:7px}
input{width:100%;background:#0d1f3c;border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}
input:focus{border-color:#0090c8;box-shadow:0 0 0 3px rgba(0,200,255,.1)}
.btn{width:100%;padding:13px;background:linear-gradient(135deg,#0090c8,var(--cyan));border:none;border-radius:10px;color:#040d1a;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;cursor:pointer;margin-top:6px;transition:opacity .2s}
.btn:hover{opacity:.88}
.err{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.25);color:#ff8fa3;border-radius:10px;padding:11px 14px;font-size:13px;margin-bottom:18px}
.foot{text-align:center;font-size:11px;color:var(--muted);margin-top:22px}
</style></head><body>
<div class="wrap">
  <div class="logo">
    <div class="logo-box">🏙️</div>
    <div class="logo-name">Hallo Johor</div>
    <div class="logo-sub">Dashboard Admin</div>
  </div>
  <div class="card">
    <h2>Selamat Datang 👋</h2>
    <p>Masuk untuk mengelola laporan pengaduan masyarakat.</p>
    ${error ? `<div class="err">⚠️ ${esc(error)}</div>` : ''}
    <form method="POST" action="/login">
      <div class="field"><label>Username</label><input type="text" name="username" placeholder="admin" required autocomplete="username"></div>
      <div class="field"><label>Password</label><input type="password" name="password" placeholder="••••••••" required autocomplete="current-password"></div>
      <button type="submit" class="btn">Masuk ke Dashboard →</button>
    </form>
  </div>
  <p class="foot">Kecamatan Medan Johor — Sistem Pengaduan Digital</p>
</div></body></html>`;

const pageDashboard = (laporan, groups, routing = {}, kegiatan = [], bcChannels = [], bcHistory = [], weatherSchedule = {}, beritaAuto = {}) => {
  const total = laporan.length;
  const now = new Date();
  const today = laporan.filter(l => new Date(l.tanggal).toDateString() === now.toDateString()).length;
  const thisMonth = laporan.filter(l => {
    const d = new Date(l.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const katCount = {}, kelCount = {}, dailyCount = {};
  laporan.forEach(l => {
    katCount[l.kategori] = (katCount[l.kategori] || 0) + 1;
    kelCount[l.kelurahan] = (kelCount[l.kelurahan] || 0) + 1;
    const day = new Date(l.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
    dailyCount[day] = (dailyCount[day] || 0) + 1;
  });

  const katList = Object.entries(katCount).sort((a,b) => b[1]-a[1]);
  const kelList = Object.entries(kelCount).sort((a,b) => b[1]-a[1]);
  const allKat  = [...new Set(laporan.map(l => l.kategori))].filter(Boolean);
  const allKel  = [...new Set(laporan.map(l => l.kelurahan))].filter(Boolean);
  const last10  = Object.entries(dailyCount).slice(-10);

  const cDayL = JSON.stringify(last10.map(d=>d[0]));
  const cDayD = JSON.stringify(last10.map(d=>d[1]));
  const cKatL = JSON.stringify(katList.slice(0,7).map(k=>k[0]));
  const cKatD = JSON.stringify(katList.slice(0,7).map(k=>k[1]));
  const cKelL = JSON.stringify(kelList.slice(0,6).map(k=>k[0]));
  const cKelD = JSON.stringify(kelList.slice(0,6).map(k=>k[1]));

  const rows = laporan.map(l => `
    <tr data-kat="${esc(l.kategori)}" data-kel="${esc(l.kelurahan)}">
      <td><span class="id-badge">#${String(l.id||0).padStart(4,'0')}</span></td>
      <td><div class="fw5">${esc(l.namaPelapor)}</div><div class="fz12 text-muted">${esc((l.pelapor||'').replace('@s.whatsapp.net',''))}</div></td>
      <td><span class="kat-tag">${esc(l.kategori)}</span></td>
      <td>${esc(l.kelurahan)}</td>
      <td class="fz13 text-muted2" style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(l.isi)}">${esc((l.isi||'').substring(0,60))}${(l.isi||'').length>60?'…':''}</td>
      <td>${statusBadgeHtml(l.status)}</td>
      <td><a class="map-link" href="https://maps.google.com/?q=${l.koordinat?.lat||0},${l.koordinat?.lon||0}" target="_blank">📍 Peta</a></td>
      <td class="fz12 text-muted2">${fmtDate(l.tanggal)}</td>
      <td style="white-space:nowrap"><button class="det-btn" data-laporan="${esc(JSON.stringify(l))}">Detail</button><button class="del-lap-btn" data-id="${l.id}" onclick="deleteLaporanRow(this.dataset.id,this)">🗑️</button></td>
    </tr>`).join('');

  const katOpts = allKat.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('');
  const kelOpts = allKel.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('');
  const groupRows = groups.length ? groups.map(g=>`
    <tr>
      <td class="fz13 fw5">${esc(g.name||g.id)}</td>
      <td><span class="id-badge fz11">${esc(g.id)}</span></td>
      <td class="fz12 text-muted2">${fmtDate(g.addedAt)}</td>
      <td><span class="status-ok">● Aktif</span></td>
      <td><button class="del-grp-btn" data-id="${esc(g.id)}" data-name="${esc(g.name||g.id)}" onclick="deleteGroup(this.dataset.id,this.dataset.name)">🗑️ Hapus</button></td>
    </tr>`).join('') :
    `<tr><td colspan="5" class="empty-row">Belum ada grup terdaftar</td></tr>`;

  // Routing dropdowns data (baked server-side)
  const routingGroupOpts = groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name||g.id)}</option>`).join('');
  const routingRows = KATEGORI_PENGADUAN.map(k => {
    const selected = routing[k.label] || '';
    const groupSelects = groups.map(g =>
      `<option value="${esc(g.id)}"${selected===g.id?' selected':''}>${esc(g.name||g.id)}</option>`
    ).join('');
    return `<tr>
      <td style="padding:11px 14px;border-bottom:1px solid rgba(26,51,86,.4);font-size:13px">${k.emoji} ${esc(k.label)}</td>
      <td style="padding:8px 14px;border-bottom:1px solid rgba(26,51,86,.4)">
        <select id="rt-${esc(k.label)}" style="background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:12px;outline:none;width:100%;max-width:280px">
          <option value=""${!selected?' selected':''}>🌐 Semua Grup (default)</option>
          ${groupSelects}
        </select>
      </td>
    </tr>`;
  }).join('');

  const recentRows = laporan.slice(0,5).map(l=>`
    <tr>
      <td><span class="id-badge">#${String(l.id||0).padStart(4,'0')}</span></td>
      <td class="fw5">${esc(l.namaPelapor)}</td>
      <td><span class="kat-tag">${esc(l.kategori)}</span></td>
      <td>${esc(l.kelurahan)}</td>
      <td class="fz12 text-muted2">${fmtDate(l.tanggal)}</td>
      <td><button class="det-btn" data-laporan="${esc(JSON.stringify(l))}">Detail</button></td>
    </tr>`).join('');

  const kegiatanCards = kegiatan.length ? kegiatan.map(k => `
    <div class="kg-card" id="kgcard-${esc(k.id)}">
      <div class="kg-card-ico">📌</div>
      <div class="kg-card-body">
        <div class="kg-card-name">${esc(k.nama)}</div>
        <div class="kg-card-meta">
          ${k.tanggal ? `<span class="kg-chip">📅 ${esc(k.tanggal)}</span>` : ''}
          ${k.tempat  ? `<span class="kg-chip">📍 ${esc(k.tempat)}</span>`  : ''}
        </div>
        ${k.deskripsi ? `<div class="kg-card-desc">${esc(k.deskripsi)}</div>` : ''}
      </div>
      <button class="kg-del-btn" onclick="deleteKegiatan('${esc(k.id)}',this)">🗑️ Hapus</button>
    </div>`).join('') :
    `<div class="kg-empty"><div class="ico">📭</div>Belum ada kegiatan. Tambahkan melalui form di atas.</div>`;

  // ── Broadcast: channel rows & history ──
  const bcChannelRows = bcChannels.length ? bcChannels.map(c => `
    <tr>
      <td class="fz13 fw5">${esc(c.name)}</td>
      <td><span class="id-badge fz11">${esc(c.jid)}</span></td>
      <td class="fz12 text-muted2">${fmtDate(c.addedAt)}</td>
      <td><span class="status-ok">● Aktif</span></td>
      <td><button class="del-ch-btn" data-jid="${esc(c.jid)}" data-name="${esc(c.name)}" onclick="deleteBcChannel(this.dataset.jid,this.dataset.name)">🗑️ Hapus</button></td>
    </tr>`).join('') :
    `<tr><td colspan="5" class="empty-row">Belum ada saluran terdaftar</td></tr>`;

  const STATUS_BC = { sent:'✅ Terkirim', pending:'⏳ Mengantre', failed:'❌ Gagal' };
  const bcHistRows = bcHistory.length ? bcHistory.map(b => {
    const ch = bcChannels.find(c => c.jid === b.channelJid);
    const chName = ch ? esc(ch.name) : esc(b.channelJid || '-');
    const badgeCls = b.status==='sent' ? 'bc-badge-sent' : b.status==='failed' ? 'bc-badge-failed' : 'bc-badge-pending';
    const mediaHtml = b.mediaFilename
      ? (b.mediaMime?.startsWith('video/')
          ? `<div class="bc-video-icon">🎬</div>`
          : `<img class="bc-thumb" src="/broadcast-media/${esc(b.mediaFilename)}" data-open-src="/broadcast-media/${esc(b.mediaFilename)}" alt="media">`)
      : '<span class="text-muted fz12">—</span>';
    return `<tr class="bc-hist-item">
      <td><span class="${badgeCls}">${STATUS_BC[b.status]||b.status}</span></td>
      <td class="fz13 fw5">${chName}</td>
      <td class="fz13 text-muted2" style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(b.pesan)}">${esc((b.pesan||'').substring(0,60))}${(b.pesan||'').length>60?'…':''}</td>
      <td>${mediaHtml}</td>
      <td class="fz12 text-muted2">${fmtDate(b.createdAt)}</td>
    </tr>`;
  }).join('') :
  `<tr><td colspan="5" class="empty-row">Belum ada riwayat broadcast</td></tr>`;

  const bcChannelOpts = bcChannels.map(c =>
    `<option value="${esc(c.jid)}">${esc(c.name)} (${esc(c.jid.split('@')[0])}…@${esc(c.jid.split('@')[1]||'')})</option>`
  ).join('');
  const cuacaChSel = (weatherSchedule.channelJid || '').trim();
  const cuacaChannelOpts = bcChannels.length
    ? bcChannels.map(c =>
        `<option value="${esc(c.jid)}"${cuacaChSel === c.jid ? ' selected' : ''}>${esc(c.name)} (${esc(c.jid.split('@')[0])}…)</option>`
      ).join('')
    : '';

  // ── Automation: Berita Pemko Medan ──
  const autoEnabled       = !!beritaAuto.enabled;
  const autoModePing      = !!beritaAuto.modePing;
  const autoModeBroadcast = !!beritaAuto.modeBroadcast;
  const autoPingNumbers   = (beritaAuto.pingNumbers || []).join('\n');
  const autoInterval      = beritaAuto.intervalMinutes || 30;
  const autoChSel         = (beritaAuto.channelJid || '').trim();
  const autoChannelOpts   = bcChannels.length
    ? bcChannels.map(c =>
        `<option value="${esc(c.jid)}"${autoChSel === c.jid ? ' selected' : ''}>${esc(c.name)} (${esc(c.jid.split('@')[0])}…)</option>`
      ).join('')
    : '';
  const autoLastChecked    = esc(beritaAuto.lastCheckedAt      || '—');
  const autoLastTitle      = esc(beritaAuto.lastNewArticleTitle || '—');
  const autoLastUrl        = esc(beritaAuto.lastNewArticleUrl   || '');
  const autoLastAt         = esc(beritaAuto.lastNewArticleAt    || '—');

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard — Hallo Johor Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<script>
const sections=['overview','laporan','grup','livechat','kegiatan','broadcast','automation','panduan'];
const titles={overview:'Overview',laporan:'Semua Laporan',grup:'Grup WhatsApp',livechat:'LiveChat Admin',kegiatan:'Kegiatan Kecamatan',broadcast:'Broadcast Saluran',automation:'Automation',panduan:'Panduan'};
function showSec(id,el){
  document.querySelectorAll('.sec').forEach(s=>s.classList.toggle('on',s.id==='sec-'+id));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  if(el)el.classList.add('on');
  const tb=document.getElementById('topbar-title');
  if(tb)tb.textContent=titles[id]||id;
}
<\/script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#040d1a;--bg2:#071326;--bg3:#0d1f3c;--card:#0e1e38;--border:#1a3356;--border2:#243d5c;--cyan:#00c8ff;--cyan2:#0090c8;--green:#00e5a0;--amber:#fbbf24;--red:#ff4d6d;--purple:#a78bfa;--text:#e2eaf5;--text2:#8facc5;--muted:#4a6a8a;--sb:256px}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;display:flex}
a{color:inherit;text-decoration:none}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
.sb{width:var(--sb);background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100}
.sb-logo{padding:24px 20px 18px;border-bottom:1px solid var(--border)}
.sb-logo .ico{font-size:28px;display:block;margin-bottom:8px}
.sb-logo .name{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;background:linear-gradient(135deg,#fff 20%,var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sb-logo .sub{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-top:2px}
.sb-nav{padding:16px 12px;flex:1;overflow-y:auto}
.nav-sec{font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:2px;padding:0 8px;margin:16px 0 6px}
.nav-sec:first-child{margin-top:0}
.ni{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:9px;font-size:13px;font-weight:500;color:var(--text2);cursor:pointer;transition:all .15s;margin-bottom:1px}
.ni:hover{background:var(--bg3);color:var(--text)}.ni.on{background:rgba(0,200,255,.12);color:var(--cyan)}
.ni .ic{font-size:15px;width:18px;text-align:center}
.sb-foot{padding:14px;border-top:1px solid var(--border)}
.logout{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.15);border-radius:9px;color:#ff8fa3;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .15s}
.logout:hover{background:rgba(255,77,109,.15)}
.main{margin-left:var(--sb);flex:1;display:flex;flex-direction:column;min-height:100vh;overflow:hidden}
.topbar{background:var(--bg2);border-bottom:1px solid var(--border);padding:16px 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;flex-shrink:0}
.topbar-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:700}
.topbar-r{display:flex;align-items:center;gap:10px}
.badge-live{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--green);background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.2);padding:4px 10px;border-radius:20px}
.badge-live::before{content:'';width:5px;height:5px;background:var(--green);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.ref-btn{background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:6px 12px;color:var(--text2);font-size:12px;cursor:pointer;transition:all .15s}
.ref-btn:hover{border-color:var(--cyan2);color:var(--cyan)}
.content{padding:28px;flex:1;display:flex;flex-direction:column;overflow:hidden}
.sec{display:none}
.sec.on{display:block;flex:1;overflow-y:auto}
#sec-livechat.on{display:flex;flex-direction:column;overflow:hidden;height:calc(100vh - 152px)}
.sec-title{font-family:'Syne',sans-serif;font-size:21px;font-weight:800;margin-bottom:3px}
.sec-sub{font-size:12px;color:var(--muted);margin-bottom:22px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.sc{background:var(--card);border:1px solid var(--border);border-radius:15px;padding:20px 22px;position:relative;overflow:hidden;animation:fi .4s ease both}
@keyframes fi{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.sc::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--ac,var(--cyan))}
.sc.g{--ac:var(--green)}.sc.a{--ac:var(--amber)}.sc.p{--ac:var(--purple)}
.sc-lbl{font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px}
.sc-val{font-family:'JetBrains Mono',monospace;font-size:34px;font-weight:500;line-height:1}
.sc-desc{font-size:11px;color:var(--text2);margin-top:7px}.sc-ico{position:absolute;right:18px;top:18px;font-size:26px;opacity:.25}
.charts{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;margin-bottom:24px}
.cc{background:var(--card);border:1px solid var(--border);border-radius:15px;padding:20px 22px}
.cc-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;margin-bottom:2px}
.cc-sub{font-size:11px;color:var(--muted);margin-bottom:16px}
.tc{background:var(--card);border:1px solid var(--border);border-radius:15px;overflow:hidden}
.tc-head{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tc-head-l{display:flex;align-items:center;gap:10px}
.tc-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700}
.cnt-badge{background:rgba(0,200,255,.1);border:1px solid rgba(0,200,255,.2);color:var(--cyan);font-family:'JetBrains Mono',monospace;font-size:11px;padding:2px 9px;border-radius:20px}
.filters{display:flex;gap:8px;flex-wrap:wrap}
select,input[type=text]{background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:12px;outline:none;transition:border-color .2s}
select:focus,input[type=text]:focus{border-color:var(--cyan2)}
input[type=text]{width:180px}
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:var(--bg3);padding:11px 16px;text-align:left;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:13px 16px;border-bottom:1px solid rgba(26,51,86,.5);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(13,31,60,.5)}
.id-badge{font-family:'JetBrains Mono',monospace;font-size:12px;background:rgba(0,200,255,.08);color:var(--cyan);padding:2px 8px;border-radius:6px}
.kat-tag{background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.2);color:var(--purple);font-size:11px;padding:2px 8px;border-radius:20px;white-space:nowrap}
.map-link{color:var(--cyan2);font-size:12px}.map-link:hover{color:var(--cyan)}
.det-btn{background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.2);border-radius:6px;color:var(--cyan);font-size:11px;padding:4px 10px;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}
.det-btn:hover{background:rgba(0,200,255,.18)}
.fw5{font-weight:500}.fz12{font-size:12px}.fz13{font-size:13px}.fz11{font-size:11px}
.text-muted{color:var(--muted)}.text-muted2{color:var(--text2)}
.empty-row{text-align:center;color:var(--muted);padding:40px!important;font-size:13px}
.status-ok{color:var(--green);font-size:12px}
.overlay{position:fixed;inset:0;background:rgba(4,13,26,.88);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);animation:fo .2s ease}
@keyframes fo{from{opacity:0}to{opacity:1}}
.modal{background:var(--card);border:1px solid var(--border2);border-radius:18px;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;animation:ms .25s ease}
@keyframes ms{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:none}}
.modal-head{padding:22px 24px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.modal-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700}
.close-btn{background:rgba(255,255,255,.06);border:none;width:30px;height:30px;border-radius:8px;color:var(--text2);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.close-btn:hover{background:rgba(255,77,109,.15);color:var(--red)}
.modal-body{padding:22px 24px}
.detail-row{display:flex;gap:8px;margin-bottom:14px}
.detail-label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;min-width:90px;padding-top:1px}
.detail-val{font-size:13px;color:var(--text);flex:1;line-height:1.6}
.detail-divider{border:none;border-top:1px solid var(--border);margin:16px 0}
.no-img{background:var(--bg3);border:1px dashed var(--border2);border-radius:10px;padding:24px;text-align:center;font-size:12px;color:var(--muted)}
.export-btn{background:linear-gradient(135deg,rgba(0,229,160,.15),rgba(0,229,160,.08));border:1px solid rgba(0,229,160,.3);border-radius:7px;padding:6px 14px;color:var(--green);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;text-decoration:none}
.export-btn:hover{background:rgba(0,229,160,.2);border-color:var(--green)}
.export-btn.loading{opacity:.6;pointer-events:none}
.info-card{background:var(--card);border:1px solid var(--border);border-radius:15px;padding:22px 24px}
.guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fb-box{background:rgba(0,200,255,.04);border:1px solid rgba(0,200,255,.15);border-radius:12px;padding:18px;margin-top:4px}
.fb-box .fb-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--cyan);margin-bottom:14px;display:flex;align-items:center;gap:7px}
.fb-textarea{width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;resize:vertical;min-height:90px;outline:none;transition:border-color .2s}
.fb-textarea:focus{border-color:var(--cyan2)}
.fb-file-label{display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg3);border:1px dashed var(--border2);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text2);transition:all .2s;margin-top:10px}
.fb-file-label:hover{border-color:var(--cyan2);color:var(--cyan)}
.fb-preview{max-width:100%;max-height:140px;border-radius:8px;margin-top:10px;display:none;border:1px solid var(--border2)}
.fb-send-btn{width:100%;padding:11px;background:linear-gradient(135deg,#0090c8,var(--cyan));border:none;border-radius:9px;color:#040d1a;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-top:12px;transition:opacity .2s}
.fb-send-btn:hover{opacity:.88}
.fb-send-btn:disabled{opacity:.5;cursor:not-allowed}
.fb-status{margin-top:10px;font-size:12px;text-align:center;border-radius:8px;padding:9px;display:none}
.fb-status.ok{background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.25);color:var(--green);display:block}
.fb-status.err{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.25);color:#ff8fa3;display:block}
/* ── LiveChat ── */
#sec-livechat .sec-title{flex-shrink:0}
#sec-livechat .sec-sub{flex-shrink:0}
.lc-layout{flex:1;min-height:0;display:grid;grid-template-columns:300px 1fr;gap:14px}
.lc-list{background:var(--card);border:1px solid var(--border);border-radius:15px;overflow:hidden;display:flex;flex-direction:column;min-height:0}
.lc-list-head{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.lc-list-body{overflow-y:auto;flex:1;min-height:0}
.lc-item{padding:14px 16px;border-bottom:1px solid rgba(26,51,86,.4);cursor:pointer;transition:background .15s;display:flex;align-items:flex-start;gap:10px}
.lc-item:hover{background:rgba(0,200,255,.05)}
.lc-item.active{background:rgba(0,200,255,.1);border-left:3px solid var(--cyan)}
.lc-item.closed{opacity:.5}
.lc-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--cyan2),var(--green));display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#040d1a;flex-shrink:0}
.lc-meta{flex:1;min-width:0}
.lc-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lc-preview{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.lc-time{font-size:10px;color:var(--muted);flex-shrink:0}
.lc-unread{background:var(--cyan);color:#040d1a;font-size:10px;font-weight:700;border-radius:10px;padding:1px 6px;margin-left:4px}
.lc-chat{background:var(--card);border:1px solid var(--border);border-radius:15px;overflow:hidden;display:flex;flex-direction:column;min-height:0}
.lc-chat-head{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.lc-chat-info{display:flex;align-items:center;gap:12px}
.lc-status-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green)}
.lc-status-dot.closed{background:var(--muted)}
.lc-msgs{flex:1;overflow-y:auto;min-height:0;padding:18px;display:flex;flex-direction:column;gap:10px}
.lc-msg{max-width:72%;display:flex;flex-direction:column;gap:3px}
.lc-msg.user{align-self:flex-start}
.lc-msg.admin{align-self:flex-end;align-items:flex-end}
.lc-bubble{padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.55}
.lc-msg.user .lc-bubble{background:var(--bg3);border:1px solid var(--border);border-bottom-left-radius:4px}
.lc-msg.admin .lc-bubble{background:linear-gradient(135deg,rgba(0,144,200,.25),rgba(0,200,255,.15));border:1px solid rgba(0,200,255,.25);border-bottom-right-radius:4px}
.lc-msg-time{font-size:10px;color:var(--muted);padding:0 4px}
.lc-msg-sender{font-size:10px;color:var(--cyan);padding:0 4px;font-weight:600}
.lc-input-box{padding:14px 16px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:center;flex-shrink:0}
.lc-input{flex:1;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:10px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border-color .2s}
.lc-input:focus{border-color:var(--cyan2)}
.lc-send-btn{background:linear-gradient(135deg,#0090c8,var(--cyan));border:none;border-radius:9px;padding:10px 18px;color:#040d1a;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .2s;white-space:nowrap}
.lc-send-btn:hover{opacity:.85}
.lc-send-btn:disabled{opacity:.4;cursor:not-allowed}
.lc-close-btn{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.2);border-radius:7px;padding:6px 12px;color:#ff8fa3;font-size:12px;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}
.lc-close-btn:hover{background:rgba(255,77,109,.2)}
.lc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:13px;gap:10px}
.lc-closed-banner{background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.2);border-radius:8px;padding:10px 14px;font-size:12px;color:#ff8fa3;text-align:center;margin:0 16px 12px}
.del-grp-btn{background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.2);border-radius:6px;color:#ff8fa3;font-size:11px;padding:4px 10px;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}
.del-grp-btn:hover{background:rgba(255,77,109,.2)}
.del-lap-btn{background:rgba(255,77,109,.06);border:1px solid rgba(255,77,109,.18);border-radius:6px;color:#ff8fa3;font-size:11px;padding:4px 8px;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;margin-left:4px}
.del-lap-btn:hover{background:rgba(255,77,109,.18)}
.add-grp-box{background:rgba(0,229,160,.04);border:1px solid rgba(0,229,160,.18);border-radius:12px;padding:20px 22px;margin-bottom:16px}
.add-grp-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--green);margin-bottom:12px}
.add-grp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.add-grp-input{background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;flex:1;min-width:180px;transition:border-color .2s}
.add-grp-input:focus{border-color:var(--green)}
.add-grp-btn{background:linear-gradient(135deg,rgba(0,229,160,.2),rgba(0,229,160,.12));border:1px solid rgba(0,229,160,.35);border-radius:8px;padding:9px 18px;color:var(--green);font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap}
.add-grp-btn:hover{background:rgba(0,229,160,.25)}
.routing-box{background:rgba(0,200,255,.03);border:1px solid rgba(0,200,255,.15);border-radius:12px;overflow:visible;margin-bottom:16px}
.routing-head{padding:16px 20px;border-bottom:1px solid rgba(0,200,255,.15);display:flex;align-items:center;justify-content:space-between;gap:12px}
.save-routing-btn{background:linear-gradient(135deg,#0090c8,var(--cyan));border:none;border-radius:8px;padding:8px 18px;color:#040d1a;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:opacity .2s}
.save-routing-btn:hover{opacity:.85}
.routing-status{font-size:12px;margin-top:8px;border-radius:7px;padding:7px 12px;display:none}
.routing-status.ok{background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.25);color:var(--green);display:block}
.routing-status.err{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.25);color:#ff8fa3;display:block}
/* ── Kegiatan ── */
.kg-form{background:var(--card);border:1px solid var(--border);border-radius:15px;padding:22px 24px;margin-bottom:18px}
.kg-form-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--cyan);margin-bottom:14px}
.kg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.kg-full{grid-column:1/-1}
.kg-label{display:block;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
.kg-input{width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border-color .2s}
.kg-input:focus{border-color:var(--cyan2)}
textarea.kg-input{resize:vertical;min-height:72px}
.kg-add-btn{background:linear-gradient(135deg,#0090c8,var(--cyan));border:none;border-radius:8px;padding:9px 20px;color:#040d1a;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .2s;margin-top:4px}
.kg-add-btn:hover{opacity:.85}
.kg-status{font-size:12px;margin-top:10px;border-radius:7px;padding:7px 12px;display:none}
.kg-status.ok{background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.25);color:var(--green);display:block}
.kg-status.err{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.25);color:#ff8fa3;display:block}
.kg-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:10px;display:flex;align-items:flex-start;gap:14px;animation:fi .3s ease both}
.kg-card-ico{font-size:26px;flex-shrink:0;margin-top:2px}
.kg-card-body{flex:1;min-width:0}
.kg-card-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:5px}
.kg-card-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px}
.kg-chip{display:inline-flex;align-items:center;gap:4px;background:var(--bg3);border:1px solid var(--border2);border-radius:20px;padding:2px 9px;font-size:11px;color:var(--text2)}
.kg-card-desc{font-size:12px;color:var(--text2);line-height:1.6}
.kg-del-btn{background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.18);border-radius:7px;color:#ff8fa3;font-size:11px;padding:5px 10px;cursor:pointer;transition:all .15s;flex-shrink:0;font-family:'DM Sans',sans-serif}
.kg-del-btn:hover{background:rgba(255,77,109,.18)}
.kg-empty{text-align:center;padding:48px 24px;color:var(--muted);font-size:13px}
.kg-empty .ico{font-size:36px;margin-bottom:10px}
/* ── Broadcast ── */
.bc-compose{background:var(--card);border:1px solid var(--border);border-radius:15px;padding:24px;margin-bottom:18px}
.bc-compose-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--cyan);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.bc-label{display:block;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.bc-select{width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border-color .2s;margin-bottom:12px}
.bc-select:focus{border-color:var(--cyan2)}
.bc-textarea{width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;resize:vertical;min-height:100px;outline:none;transition:border-color .2s}
.bc-textarea:focus{border-color:var(--cyan2)}
/* ── Automation (old stub removed) ── */

.bc-media-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}
.bc-file-label{display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg3);border:1px dashed var(--border2);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text2);transition:all .2s}
.bc-file-label:hover{border-color:var(--cyan2);color:var(--cyan)}
.bc-preview-wrap{position:relative;display:none}
.bc-preview-img{max-height:120px;max-width:200px;border-radius:8px;border:1px solid var(--border2);display:block}
.bc-preview-video{max-height:120px;max-width:200px;border-radius:8px;border:1px solid var(--border2);display:block}
.bc-remove-media{position:absolute;top:-7px;right:-7px;background:var(--red);border:none;border-radius:50%;width:20px;height:20px;color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.bc-send-btn{width:100%;padding:12px;background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;border-radius:9px;color:#fff;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;cursor:pointer;margin-top:14px;transition:opacity .2s;display:flex;align-items:center;justify-content:center;gap:8px}
.bc-send-btn:hover{opacity:.88}
.bc-send-btn:disabled{opacity:.45;cursor:not-allowed}
.bc-status{margin-top:10px;font-size:12px;text-align:center;border-radius:8px;padding:9px;display:none}
.bc-status.ok{background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);color:#a78bfa;display:block}
.bc-status.err{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.25);color:#ff8fa3;display:block}
.bc-channel-box{background:rgba(167,139,250,.04);border:1px solid rgba(167,139,250,.15);border-radius:12px;padding:20px 22px;margin-bottom:16px}
.bc-channel-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#a78bfa;margin-bottom:12px}
.bc-add-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.bc-ch-input{background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;flex:1;min-width:160px;transition:border-color .2s}
.bc-ch-input:focus{border-color:#a78bfa}
.bc-add-ch-btn{background:linear-gradient(135deg,rgba(167,139,250,.2),rgba(167,139,250,.1));border:1px solid rgba(167,139,250,.35);border-radius:8px;padding:9px 16px;color:#a78bfa;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap}
.bc-add-ch-btn:hover{background:rgba(167,139,250,.25)}
.bc-ch-status{font-size:12px;margin-top:8px;border-radius:7px;padding:7px 12px;display:none}
.bc-ch-status.ok{background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);color:#a78bfa;display:block}
.bc-ch-status.err{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.25);color:#ff8fa3;display:block}
.del-ch-btn{background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.2);border-radius:6px;color:#ff8fa3;font-size:11px;padding:4px 10px;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}
.del-ch-btn:hover{background:rgba(255,77,109,.2)}
.bc-hist-item{border-bottom:1px solid rgba(26,51,86,.5)}
.bc-hist-item:last-child{border-bottom:none}
.bc-badge-sent{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(167,139,250,.12);color:#a78bfa;border:1px solid rgba(167,139,250,.25)}
.bc-badge-pending{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.2)}
.bc-badge-failed{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(255,77,109,.1);color:#ff8fa3;border:1px solid rgba(255,77,109,.2)}
.bc-thumb{width:48px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--border2);cursor:pointer}
.bc-video-icon{width:48px;height:40px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px}
/* ── Automation ── */
.auto-card{background:rgba(34,197,94,.04);border:1px solid rgba(34,197,94,.18);border-radius:12px;padding:20px 22px;margin-bottom:16px}
.auto-card-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#4ade80;margin-bottom:10px}
.auto-toggle-row{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.auto-toggle{position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0}
.auto-toggle input{opacity:0;width:0;height:0}
.auto-slider{position:absolute;inset:0;background:var(--bg3);border-radius:24px;cursor:pointer;transition:.25s;border:1px solid var(--border2)}
.auto-slider:before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:var(--text2);border-radius:50%;transition:.25s}
.auto-toggle input:checked + .auto-slider{background:rgba(34,197,94,.25);border-color:#4ade80}
.auto-toggle input:checked + .auto-slider:before{transform:translateX(20px);background:#4ade80}
.auto-mode-box{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:14px}
.auto-mode-label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);cursor:pointer;margin-bottom:6px}
.auto-mode-label:last-child{margin-bottom:0}
.auto-mode-label input[type=checkbox]{width:16px;height:16px;cursor:pointer;accent-color:#4ade80}
.auto-field-label{font-size:12px;color:var(--text2);margin-bottom:6px;font-weight:600}
.auto-textarea{width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:9px 12px;color:var(--text);font-size:12px;font-family:'JetBrains Mono',monospace;resize:vertical;min-height:80px;box-sizing:border-box}
.auto-textarea:focus{outline:none;border-color:#4ade80}
.auto-select{background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;min-width:180px}
.auto-select:focus{outline:none;border-color:#4ade80}
.auto-input-num{background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;width:90px}
.auto-input-num:focus{outline:none;border-color:#4ade80}
.auto-save-btn{background:linear-gradient(135deg,rgba(34,197,94,.2),rgba(16,185,129,.2));border:1px solid rgba(34,197,94,.4);color:#4ade80;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif}
.auto-save-btn:hover{background:rgba(34,197,94,.25)}
.auto-test-btn{background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);color:#a78bfa;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif}
.auto-test-btn:hover{background:rgba(167,139,250,.2)}
.auto-status-box{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px 16px;font-size:12px;color:var(--text2);line-height:1.9}
.auto-status-ok{color:#4ade80;font-weight:600}
.auto-status-warn{color:#fbbf24;font-weight:600}
.auto-ch-status{margin-top:10px;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600}
.auto-ch-status.ok{background:rgba(34,197,94,.08);color:#4ade80;border:1px solid rgba(34,197,94,.2)}
.auto-ch-status.err{background:rgba(255,77,109,.08);color:#ff8fa3;border:1px solid rgba(255,77,109,.2)}
</style></head><body>

<div class="sb">
  <div class="sb-logo">
    <span class="ico">🏙️</span>
    <div class="name">Hallo Johor</div>
    <div class="sub">Dashboard Admin</div>
  </div>
  <div class="sb-nav">
    <div class="nav-sec">Utama</div>
    <div class="ni on" onclick="showSec('overview',this)"><span class="ic">📊</span> Overview</div>
    <div class="ni" onclick="showSec('laporan',this)"><span class="ic">📋</span> Semua Laporan</div>
    <div class="nav-sec">Manajemen</div>
    <div class="ni" onclick="showSec('livechat',this)"><span class="ic">💬</span> LiveChat <span id="lc-unread-badge" style="display:none;margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 7px"></span></div>
    <div class="ni" onclick="showSec('kegiatan',this)"><span class="ic">🎪</span> Kegiatan</div>
    <div class="ni" onclick="showSec('broadcast',this)"><span class="ic">📢</span> Broadcast</div>
    <div class="ni" onclick="showSec('automation',this)"><span class="ic">⚙️</span> Automation</div>
    <div class="ni" onclick="showSec('grup',this)"><span class="ic">📡</span> Grup WhatsApp</div>
    <div class="nav-sec">Info</div>
    <div class="ni" onclick="showSec('panduan',this)"><span class="ic">📖</span> Panduan</div>
  </div>
  <div class="sb-foot"><a class="logout" href="/logout">🚪 Keluar</a></div>
</div>

<div class="main">
  <div class="topbar">
    <div class="topbar-title" id="topbar-title">Overview</div>
    <div class="topbar-r">
      <div class="badge-live">Live</div>
      <button class="ref-btn" onclick="location.reload()">🔄 Refresh</button>
      <a href="/export/excel" class="export-btn" id="export-btn" onclick="startExport(this)">📊 Export Excel</a>
    </div>
  </div>

  <div class="content">

    <div class="sec on" id="sec-overview">
      <div class="sec-title">Dashboard Laporan</div>
      <div class="sec-sub">Ringkasan data pengaduan masyarakat Kecamatan Medan Johor</div>
      <div class="stats">
        <div class="sc"><span class="sc-ico">📋</span><div class="sc-lbl">Total Laporan</div><div class="sc-val">${total}</div><div class="sc-desc">Semua waktu</div></div>
        <div class="sc g"><span class="sc-ico">📅</span><div class="sc-lbl">Hari Ini</div><div class="sc-val">${today}</div><div class="sc-desc">${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</div></div>
        <div class="sc a"><span class="sc-ico">📆</span><div class="sc-lbl">Bulan Ini</div><div class="sc-val">${thisMonth}</div><div class="sc-desc">${new Date().toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</div></div>
        <div class="sc p"><span class="sc-ico">💬</span><div class="sc-lbl">Grup Aktif</div><div class="sc-val">${groups.length}</div><div class="sc-desc">Grup penerima laporan</div></div>
      </div>
      <div class="charts">
        <div class="cc"><div class="cc-title">Laporan per Hari</div><div class="cc-sub">Tren 10 hari terakhir</div><canvas id="chartDay" height="110"></canvas></div>
        <div class="cc"><div class="cc-title">Per Kategori</div><div class="cc-sub">Distribusi kategori</div><canvas id="chartKat" height="160"></canvas></div>
        <div class="cc"><div class="cc-title">Per Kelurahan</div><div class="cc-sub">Distribusi wilayah</div><canvas id="chartKel" height="160"></canvas></div>
      </div>
      <div class="tc">
        <div class="tc-head">
          <div class="tc-head-l"><span class="tc-name">Laporan Terbaru</span><span class="cnt-badge">5 terakhir</span></div>
          <button class="det-btn" onclick="showSec('laporan',document.querySelectorAll('.ni')[1])">Lihat Semua →</button>
        </div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>No</th><th>Pelapor</th><th>Kategori</th><th>Kelurahan</th><th>Waktu</th><th></th></tr></thead>
          <tbody>${recentRows || '<tr><td colspan="6" class="empty-row">Belum ada laporan</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>

    <div class="sec" id="sec-laporan">
      <div class="sec-title">Semua Laporan</div>
      <div class="sec-sub">Data lengkap pengaduan yang diterima melalui WhatsApp Bot</div>
      <div class="tc">
        <div class="tc-head">
          <div class="tc-head-l"><span class="tc-name">Daftar Laporan</span><span class="cnt-badge" id="row-count">${total}</span></div>
          <div class="filters">
            <input type="text" id="search-box" placeholder="🔍  Cari nama / isi..." oninput="filterTable()">
            <select id="filter-kat" onchange="filterTable()"><option value="">Semua Kategori</option>${katOpts}</select>
            <select id="filter-kel" onchange="filterTable()"><option value="">Semua Kelurahan</option>${kelOpts}</select>
          </div>
        </div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>No</th><th>Pelapor</th><th>Kategori</th><th>Kelurahan</th><th>Isi Laporan</th><th>Status</th><th>Lokasi</th><th>Waktu</th><th></th></tr></thead>
          <tbody id="table-body">${rows || '<tr><td colspan="9" class="empty-row">Belum ada laporan masuk</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>

    <div class="sec" id="sec-grup">
      <div class="sec-title">Grup WhatsApp</div>
      <div class="sec-sub">Kelola grup penerima laporan dan konfigurasi routing per kategori</div>

      <div class="add-grp-box">
        <div class="add-grp-title">➕ Tambah Grup via Dashboard</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Masukkan Group ID WhatsApp (format: <code style="color:var(--cyan);background:var(--bg3);padding:1px 6px;border-radius:4px">1206xxxxx@g.us</code>). Bisa dilihat dari log bot saat pesan dikirim di grup.</div>
        <div class="add-grp-row">
          <input class="add-grp-input" id="grp-id-input" placeholder="1206xxxxxxxxxx@g.us" type="text">
          <input class="add-grp-input" id="grp-name-input" placeholder="Nama Grup (opsional)" type="text" style="max-width:220px">
          <button class="add-grp-btn" onclick="addGroup()">➕ Tambah Grup</button>
        </div>
        <div id="add-grp-status" class="routing-status"></div>
      </div>

      <div class="tc" style="margin-bottom:16px">
        <div class="tc-head"><div class="tc-head-l"><span class="tc-name">Daftar Grup</span><span class="cnt-badge" id="grp-count">${groups.length} grup</span></div></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Nama Grup</th><th>Group ID</th><th>Terdaftar</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody id="grp-table-body">${groupRows}</tbody>
        </table></div>
      </div>

      <div class="routing-box">
        <div class="routing-head">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--cyan)">🗂️ Routing Laporan per Kategori</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">Atur ke grup mana setiap kategori laporan akan diteruskan. Jika tidak diatur → dikirim ke semua grup.</div>
          </div>
          <button class="save-routing-btn" onclick="saveRouting()">💾 Simpan Routing</button>
        </div>
        <div style="overflow:hidden;border-radius:0 0 12px 12px">
        <table style="width:100%">
          <thead><tr><th style="padding:11px 14px;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;background:var(--bg3);border-bottom:1px solid var(--border)">Kategori</th><th style="padding:11px 14px;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;background:var(--bg3);border-bottom:1px solid var(--border)">Grup Tujuan</th></tr></thead>
          <tbody id="routing-tbody">${routingRows}</tbody>
        </table>
        </div>
        <div id="routing-status" class="routing-status" style="margin:10px 14px 14px"></div>
      </div>

      <div class="info-card">
        <div class="cc-title" style="margin-bottom:10px">📱 Cara Mendaftarkan Grup via Bot</div>
        <div style="font-size:13px;color:var(--text2);line-height:2">
          1. Tambahkan bot WhatsApp ke grup yang diinginkan<br>
          2. Ketik <code style="background:var(--bg3);padding:1px 7px;border-radius:4px;color:var(--cyan)">applylaporan</code> di dalam grup tersebut<br>
          3. Bot akan mengkonfirmasi pendaftaran grup<br>
          4. Atau gunakan form <b>Tambah Grup via Dashboard</b> di atas jika sudah tahu Group ID-nya
        </div>
      </div>
    </div>

    <div class="sec" id="sec-kegiatan">
      <div class="sec-title">Kegiatan Kecamatan</div>
      <div class="sec-sub">Kelola informasi kegiatan yang tampil di menu bot WhatsApp (Menu 3)</div>

      <div class="kg-form">
        <div class="kg-form-title">➕ Tambah Kegiatan Baru</div>
        <div class="kg-grid">
          <div class="kg-full">
            <label class="kg-label">Nama Kegiatan *</label>
            <input class="kg-input" id="kg-nama" type="text" placeholder="Contoh: Gotong Royong Kelurahan Suka Maju">
          </div>
          <div>
            <label class="kg-label">Hari / Tanggal</label>
            <input class="kg-input" id="kg-tanggal" type="text" placeholder="Contoh: Sabtu, 22 Maret 2026">
          </div>
          <div>
            <label class="kg-label">Tempat / Lokasi</label>
            <input class="kg-input" id="kg-tempat" type="text" placeholder="Contoh: Kantor Kelurahan Gedung Johor">
          </div>
          <div class="kg-full">
            <label class="kg-label">Deskripsi (opsional)</label>
            <textarea class="kg-input" id="kg-deskripsi" placeholder="Keterangan singkat mengenai kegiatan ini..."></textarea>
          </div>
        </div>
        <button class="kg-add-btn" onclick="addKegiatan()">➕ Tambah Kegiatan</button>
        <div class="kg-status" id="kg-status"></div>
      </div>

      <div class="tc" style="padding:22px 24px;margin-bottom:0">
        <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:3px;display:flex;align-items:center;justify-content:space-between">
          <span>📋 Daftar Kegiatan</span>
          <span class="cnt-badge" id="kg-count">${kegiatan.length} kegiatan</span>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Data ini ditampilkan langsung ke warga saat memilih Menu 3 di WhatsApp Bot.</div>
        <div id="kg-list">${kegiatanCards}</div>
      </div>
    </div>

    <div class="sec" id="sec-broadcast">
      <div class="sec-title">Broadcast Saluran</div>
      <div class="sec-sub">Kirim pesan, foto, atau video ke saluran WhatsApp (Newsletter/Channel)</div>

      <!-- ─ Compose Broadcast ─ -->
      <div class="bc-compose">
        <div class="bc-compose-title">📣 Buat Broadcast Baru</div>
        <div style="margin-bottom:12px">
          <label class="bc-label">Pilih Saluran Tujuan *</label>
          <select class="bc-select" id="bc-target">
            <option value="">— Pilih saluran —</option>
            ${bcChannelOpts}
          </select>
        </div>
        <div style="margin-bottom:4px">
          <label class="bc-label">Pesan (teks)</label>
          <textarea class="bc-textarea" id="bc-pesan" placeholder="Tulis isi broadcast di sini..."></textarea>
        </div>
        <div class="bc-media-row">
          <label class="bc-file-label" for="bc-media-input" id="bc-media-label">
            📎 Lampirkan Foto / Video (opsional)
            <input type="file" id="bc-media-input" accept="image/*,video/*" style="display:none" onchange="onBcMediaChange(this)">
          </label>
          <div class="bc-preview-wrap" id="bc-preview-wrap">
            <img class="bc-preview-img" id="bc-preview-img" alt="Preview" style="display:none">
            <video class="bc-preview-video" id="bc-preview-video" muted playsinline style="display:none"></video>
            <button class="bc-remove-media" onclick="removeBcMedia()" title="Hapus media">✕</button>
          </div>
        </div>
        <button class="bc-send-btn" id="bc-send-btn" onclick="sendBroadcast()">
          📢 Kirim Broadcast
        </button>
        <div class="bc-status" id="bc-status"></div>
      </div>

      <div class="bc-channel-box" style="border-color:rgba(21,73,115,.35)">
        <div class="bc-channel-title">📰 Berita Harian — Kecamatan Medan Johor</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.75">
          Sumber: <a href="https://medanjohor.medan.go.id/berita" target="_blank" rel="noopener noreferrer" style="color:var(--cyan)">medanjohor.medan.go.id/berita</a>
          — Pilih berita yang ingin disiarkan ke saluran WhatsApp. Foto dan ringkasan diambil otomatis dari halaman portal.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px">
          <label class="bc-label" style="margin:0">Tampilkan berita:</label>
          <select class="bc-select" id="medan-bc-preview-count" style="max-width:100px">
            <option value="3">3 terbaru</option>
            <option value="5">5 terbaru</option>
            <option value="8">8 terbaru</option>
            <option value="10">10 terbaru</option>
          </select>
          <button type="button" class="ref-btn" onclick="loadMedanBeritaList()">🔄 Muat List</button>
        </div>
        <div id="medan-berita-list-status" class="bc-ch-status" style="display:none;margin-bottom:10px"></div>
        <div id="medan-berita-list-container" style="margin-bottom:12px">
          <p style="color:var(--text2);font-size:12px">Klik "Muat List" untuk menampilkan daftar berita terbaru.</p>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button type="button" class="ref-btn" onclick="selectAllMedanNews()">✓ Pilih Semua</button>
          <button type="button" class="ref-btn" onclick="deselectAllMedanNews()">✗ Hapus Pilihan</button>
          <label class="bc-label" style="margin:0;flex:1;text-align:right">Saluran tujuan:</label>
          <select class="bc-select" id="medan-bc-target" style="max-width:220px">
            <option value="">— Pilih saluran —</option>
            ${bcChannelOpts}
          </select>
        </div>
        <button type="button" class="bc-send-btn" style="margin:0;padding:9px 18px;font-size:13px" onclick="sendSelectedMedanNews()" id="medan-send-selected-btn">📤 Kirim Berita Terpilih</button>
        <div id="medan-berita-send-status" class="bc-ch-status" style="display:none;margin-top:10px"></div>
      </div>

      <div class="bc-channel-box" style="border-color:rgba(255,165,0,.35)">
        <div class="bc-channel-title">🏛️ Berita Harian — Pemko Medan</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.75">
          Sumber: <a href="https://portal.medan.go.id/berita" target="_blank" rel="noopener noreferrer" style="color:var(--cyan)">portal.medan.go.id/berita</a>
          — Pilih berita Pemko Medan yang ingin disiarkan ke saluran WhatsApp. Foto dan ringkasan diambil otomatis dari portal.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px">
          <label class="bc-label" style="margin:0">Tampilkan berita:</label>
          <select class="bc-select" id="pemko-bc-preview-count" style="max-width:100px">
            <option value="3">3 terbaru</option>
            <option value="5">5 terbaru</option>
            <option value="8">8 terbaru</option>
            <option value="10">10 terbaru</option>
          </select>
          <button type="button" class="ref-btn" onclick="loadPemkoBeritaList()">🔄 Muat List</button>
        </div>
        <div id="pemko-berita-list-status" class="bc-ch-status" style="display:none;margin-bottom:10px"></div>
        <div id="pemko-berita-list-container" style="margin-bottom:12px">
          <p style="color:var(--text2);font-size:12px">Klik "Muat List" untuk menampilkan daftar berita terbaru.</p>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button type="button" class="ref-btn" onclick="selectAllPemkoNews()">✓ Pilih Semua</button>
          <button type="button" class="ref-btn" onclick="deselectAllPemkoNews()">✗ Hapus Pilihan</button>
          <label class="bc-label" style="margin:0;flex:1;text-align:right">Saluran tujuan:</label>
          <select class="bc-select" id="pemko-bc-target" style="max-width:220px">
            <option value="">— Pilih saluran —</option>
            ${bcChannelOpts}
          </select>
        </div>
        <button type="button" class="bc-send-btn" style="margin:0;padding:9px 18px;font-size:13px" onclick="sendSelectedPemkoNews()" id="pemko-send-selected-btn">📤 Kirim Berita Terpilih</button>
        <div id="pemko-berita-send-status" class="bc-ch-status" style="display:none;margin-top:10px"></div>
      </div>

      <div class="bc-channel-box" style="border-color:rgba(0,200,255,.25)">
        <div class="bc-channel-title">🌤️ Prakiraan Cuaca — BMKG (Medan Johor)</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.75">
          Sumber: <a href="${BMKG_MEDAN_JOHOR_URL}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan)">BMKG — 6 kelurahan Kec. Medan Johor</a>.
          Data <b>satu hari</b> (kolom &quot;hari ini&quot; di tabel BMKG). Aktifkan jadwal untuk mengantre broadcast teks otomatis setiap hari sekitar <b>00:00 WIB</b> (jendela menit pertama).
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px">
          <label class="bc-label" style="margin:0">Saluran cuaca:</label>
          <select class="bc-select" id="cuaca-bc-target" style="min-width:220px;flex:1">
            <option value="">— Pilih saluran —</option>
            ${cuacaChannelOpts}
          </select>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);margin-bottom:12px;cursor:pointer">
          <input type="checkbox" id="cuaca-auto-enabled" ${weatherSchedule.enabled ? 'checked' : ''} style="width:16px;height:16px">
          <span>Kirim otomatis setiap hari ±00:00 WIB ke saluran di atas</span>
        </label>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:8px">
          <button type="button" class="ref-btn" onclick="saveCuacaSchedule()">💾 Simpan jadwal</button>
          <button type="button" class="ref-btn" onclick="previewCuacaBmkg()">👁️ Pratinjau teks</button>
          <button type="button" class="bc-send-btn" style="margin:0;padding:9px 18px;font-size:13px" onclick="queueCuacaBmkgSekarang()" id="cuaca-queue-btn">📤 Kirim prakiraan sekarang</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Otomatis terakhir: <span id="cuaca-last-sent">${esc(weatherSchedule.lastSentDate || '—')}</span></div>
        <div id="cuaca-status" class="bc-ch-status" style="display:none;margin-bottom:10px"></div>
        <pre id="cuaca-preview" style="display:none;white-space:pre-wrap;font-size:12px;font-family:'JetBrains Mono',monospace;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;color:var(--text2);max-height:280px;overflow-y:auto;margin:0"></pre>
      </div>

      <!-- ─ Saluran Management ─ -->
      <div class="bc-channel-box">
        <div class="bc-channel-title">➕ Daftarkan Saluran WhatsApp</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:14px;line-height:1.8">
          <b style="color:var(--text)">Cara mendapatkan JID saluran:</b><br>
          1. Buka saluran WhatsApp Anda → Klik titik tiga → <b>Info Saluran</b><br>
          2. Salin link undangan, misal: <code style="color:#a78bfa;background:var(--bg3);padding:1px 5px;border-radius:4px">https://whatsapp.com/channel/0029Va...</code><br>
          3. Tempel link di bawah lalu klik <b>Cari JID</b>, atau masukkan JID langsung:<br>
          &nbsp;&nbsp;&nbsp;<code style="color:#a78bfa;background:var(--bg3);padding:1px 5px;border-radius:4px">120363xxxxxxxxxx@newsletter</code>
          &nbsp; atau grup &nbsp;
          <code style="color:#a78bfa;background:var(--bg3);padding:1px 5px;border-radius:4px">120xxxxxxxxxx@g.us</code>
        </div>
        <div class="bc-add-row" style="margin-bottom:8px">
          <input class="bc-ch-input" id="bc-invite-input" placeholder="https://whatsapp.com/channel/... (link undangan)" type="text" style="flex:2">
          <button class="bc-add-ch-btn" onclick="lookupChannelJid()" style="background:rgba(0,200,255,.12);border-color:rgba(0,200,255,.3);color:var(--cyan)">🔍 Cari JID</button>
        </div>
        <div class="bc-add-row">
          <input class="bc-ch-input" id="bc-jid-input" placeholder="120363xxxxxxxxxx@newsletter" type="text">
          <input class="bc-ch-input" id="bc-name-input" placeholder="Nama Saluran" type="text" style="max-width:200px">
          <button class="bc-add-ch-btn" onclick="addBcChannel()">➕ Tambah</button>
        </div>
        <div id="bc-ch-status" class="bc-ch-status"></div>
      </div>

      <!-- ─ Daftar Saluran ─ -->
      <div class="tc" style="margin-bottom:16px">
        <div class="tc-head">
          <div class="tc-head-l">
            <span class="tc-name">Daftar Saluran</span>
            <span class="cnt-badge" id="bc-ch-count">${bcChannels.length} saluran</span>
          </div>
        </div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Nama</th><th>JID</th><th>Terdaftar</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody id="bc-ch-tbody">${bcChannelRows}</tbody>
        </table></div>
      </div>

      <!-- ─ Riwayat Broadcast ─ -->
      <div class="tc">
        <div class="tc-head">
          <div class="tc-head-l">
            <span class="tc-name">Riwayat Broadcast</span>
            <span class="cnt-badge" id="bc-hist-count">${bcHistory.length} broadcast</span>
          </div>
          <button class="ref-btn" onclick="refreshBcHistory()">🔄 Refresh</button>
        </div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Status</th><th>Saluran</th><th>Pesan</th><th>Media</th><th>Waktu</th></tr></thead>
          <tbody id="bc-hist-tbody">${bcHistRows}</tbody>
        </table></div>
      </div>
    </div>


    <div class="sec" id="sec-automation">
      <div class="sec-title">⚙️ Automation</div>
      <div class="sec-sub">Aksi otomatis berdasarkan trigger berita baru dari portal Pemko Medan</div>

      <!-- Status Box -->
      <div class="auto-status-box" id="auto-status-box">
        <div style="margin-bottom:6px">
          <span class="auto-indicator ${autoEnabled ? 'on' : 'off'}" id="auto-indicator"></span>
          <b id="auto-status-label">${autoEnabled ? 'Automation AKTIF' : 'Automation NONAKTIF'}</b>
        </div>
        <div>⏱️ Interval pengecekan: <b id="auto-status-interval">${autoInterval} menit</b></div>
        <div>🕐 Terakhir dicek: <b id="auto-status-checked">${autoLastChecked}</b></div>
        <div>📰 Berita baru terakhir: <b id="auto-status-title">${autoLastTitle}</b>
          ${autoLastUrl ? ' — <a href="' + autoLastUrl + '" target="_blank" rel="noopener" style="color:var(--cyan);font-size:11px">Buka →</a>' : ''}
        </div>
        <div>🗓️ Ditemukan pada: <b id="auto-status-at">${autoLastAt}</b></div>
      </div>

      <!-- Config Card -->
      <div class="auto-box" style="border-color:rgba(245,158,11,.3)">
        <div class="auto-box-title">🏛️ Berita Baru — Portal Pemko Medan</div>
        <div class="auto-box-sub">
          Sistem akan mengecek halaman
          <a href="https://portal.medan.go.id/berita" target="_blank" rel="noopener" style="color:var(--cyan)">portal.medan.go.id/berita</a>
          secara berkala. Jika artikel terbaru berubah (URL berbeda), aksi di bawah akan dijalankan otomatis.
        </div>

        <!-- Enable Toggle -->
        <div class="auto-toggle-row" style="margin-bottom:16px">
          <input type="checkbox" id="auto-enabled" ${autoEnabled ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;accent-color:#f59e0b">
          <label for="auto-enabled" style="font-size:14px;font-weight:600">Aktifkan automation berita Pemko Medan</label>
        </div>

        <!-- Interval -->
        <div style="margin-bottom:14px">
          <label class="bc-label">Interval Pengecekan (menit)</label>
          <input class="auto-input" id="auto-interval" type="number" min="5" max="1440" value="${autoInterval}" placeholder="30" style="max-width:140px">
          <div style="font-size:11px;color:var(--muted);margin-top:-6px">Minimal 5 menit. Disarankan 30–60 menit agar tidak berlebihan.</div>
        </div>

        <!-- Mode Pilihan -->
        <div style="margin-bottom:14px">
          <label class="bc-label">Mode Aksi (bisa pilih keduanya)</label>
          <div class="auto-toggle-row">
            <input type="checkbox" id="auto-mode-ping" ${autoModePing ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;accent-color:#f59e0b">
            <label for="auto-mode-ping">📱 Ping ke nomor WA tertentu</label>
          </div>
          <div class="auto-toggle-row">
            <input type="checkbox" id="auto-mode-broadcast" ${autoModeBroadcast ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;accent-color:#f59e0b">
            <label for="auto-mode-broadcast">📢 Auto broadcast ke saluran WhatsApp</label>
          </div>
        </div>

        <!-- Ping Numbers -->
        <div id="auto-ping-section" style="${autoModePing ? '' : 'display:none'}">
          <label class="bc-label">Nomor WA tujuan ping (satu per baris, format: 628xxx...)</label>
          <textarea class="auto-textarea" id="auto-ping-numbers" placeholder="628123456789&#10;628987654321">${autoPingNumbers}</textarea>
          <div style="font-size:11px;color:var(--muted);margin-top:-6px;margin-bottom:10px">Nomor tanpa spasi/tanda. Contoh: 6281234567890</div>
        </div>

        <!-- Broadcast Channel -->
        <div id="auto-broadcast-section" style="${autoModeBroadcast ? '' : 'display:none'}">
          <label class="bc-label">Saluran WhatsApp tujuan broadcast</label>
          <select class="auto-input" id="auto-channel" style="max-width:360px">
            <option value="">— Pilih saluran —</option>
            ${autoChannelOpts}
          </select>
        </div>

        <!-- Tombol -->
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:6px">
          <button class="auto-save-btn" id="auto-save-btn" onclick="saveAutoBeritaConfig()">💾 Simpan Konfigurasi</button>
          <button class="auto-test-btn" id="auto-test-btn" onclick="testAutoBerita()">🧪 Test Sekarang</button>
          <div id="auto-save-status" class="bc-ch-status" style="display:none"></div>
        </div>
      </div>
    </div>

    <div class="sec" id="sec-panduan">
      <div class="sec-title">Panduan Sistem</div>
      <div class="sec-sub">Informasi lengkap pengoperasian Hallo Johor Bot</div>
      <div class="guide-grid">
        <div class="info-card"><div style="font-size:26px;margin-bottom:10px">📲</div><div class="cc-title" style="margin-bottom:10px">Bot Commands</div><div style="font-size:13px;color:var(--text2);line-height:2"><code style="color:var(--cyan)">applylaporan</code> — Daftarkan grup<br><code style="color:var(--red)">removelaporan</code> — Hapus grup<br><code style="color:var(--green)">menu</code> / <code style="color:var(--green)">hi</code> — Menu utama bot</div></div>
        <div class="info-card"><div style="font-size:26px;margin-bottom:10px">📋</div><div class="cc-title" style="margin-bottom:10px">Alur Laporan</div><div style="font-size:13px;color:var(--text2);line-height:1.9">1. Pilih menu → Laporan Pengaduan<br>2. Pilih kategori & kelurahan<br>3. Tulis uraian laporan<br>4. Kirim foto bukti<br>5. Bagikan lokasi GPS</div></div>
        <div class="info-card"><div style="font-size:26px;margin-bottom:10px">💾</div><div class="cc-title" style="margin-bottom:10px">Penyimpanan Data</div><div style="font-size:13px;color:var(--text2);line-height:2"><code style="color:var(--cyan)">data/laporan_archive.json</code> — Arsip laporan<br><code style="color:var(--cyan)">data/laporan_groups.json</code> — Daftar grup<br><code style="color:var(--cyan)">data/group_routing.json</code> — Routing kategori</div></div>
        <div class="info-card"><div style="font-size:26px;margin-bottom:10px">🗂️</div><div class="cc-title" style="margin-bottom:10px">Kategori Pengaduan</div><div style="font-size:13px;color:var(--text2);line-height:2">🗑️ Sampah Liar<br>⚠️ Gangguan Ketertiban<br>💡 Lampu Jalan Mati<br>🌊 Drainase Tersumbat<br>📋 Administrasi Pelayanan<br>🏚️ Bangunan Liar<br>🫂 Orang Terlantar / ODGJ<br>📌 Lainnya</div></div>
      </div>
    </div>

    <div class="sec" id="sec-livechat">
      <div class="sec-title">LiveChat Admin</div>
      <div class="sec-sub">Chat real-time dengan warga yang menghubungi via WhatsApp Bot</div>
      <div class="lc-layout">
        <div class="lc-list">
          <div class="lc-list-head">
            <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700">Sesi Chat</div>
            <span class="cnt-badge" id="lc-count">0</span>
          </div>
          <div class="lc-list-body" id="lc-sessions"><div style="padding:30px;text-align:center;color:var(--muted);font-size:12px">Belum ada sesi aktif</div></div>
        </div>
        <div class="lc-chat" id="lc-chat-panel">
          <div class="lc-empty" id="lc-no-chat"><div style="font-size:40px">💬</div><div>Pilih sesi untuk membalas</div></div>
          <div id="lc-active-chat" style="display:none;flex:1;flex-direction:column;overflow:hidden;min-height:0">
            <div class="lc-chat-head">
              <div class="lc-chat-info">
                <div class="lc-status-dot" id="lc-status-dot"></div>
                <div>
                  <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:15px" id="lc-chat-name">-</div>
                  <div style="font-size:11px;color:var(--muted)" id="lc-chat-jid">-</div>
                </div>
              </div>
              <button class="lc-close-btn" id="lc-end-btn" onclick="endSession()">✕ Akhiri Sesi</button>
            </div>
            <div class="lc-msgs" id="lc-messages"></div>
            <div id="lc-closed-banner" class="lc-closed-banner" style="display:none">Sesi ini sudah ditutup. Tidak bisa membalas lagi.</div>
            <div class="lc-input-box" id="lc-input-area">
              <input class="lc-input" id="lc-reply-input" placeholder="Ketik balasan..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendReply()}">
              <button class="lc-send-btn" id="lc-reply-btn" onclick="sendReply()">Kirim ➤</button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>

<div class="overlay" id="modal-overlay" style="display:none" onclick="closeModal(event)">
  <div class="modal" id="modal-box">
    <div class="modal-head">
      <div class="modal-title" id="modal-title">Detail Laporan</div>
      <button class="close-btn" onclick="closeModalDirect()">✕</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>

<script>
document.addEventListener('click', (e) => {
  const det = e.target.closest('.det-btn[data-laporan]');
  if (det) { showDetail(det.dataset.laporan); return; }
  const img = e.target.closest('[data-open-src]');
  if (img) { window.open(img.dataset.openSrc, '_blank'); return; }
});
function filterTable(){
  const q=document.getElementById('search-box').value.toLowerCase();
  const kat=document.getElementById('filter-kat').value;
  const kel=document.getElementById('filter-kel').value;
  let vis=0;
  document.querySelectorAll('#table-body tr').forEach(r=>{
    const ok=(!q||r.textContent.toLowerCase().includes(q))&&(!kat||r.dataset.kat===kat)&&(!kel||r.dataset.kel===kel);
    r.style.display=ok?'':'none';
    if(ok)vis++;
  });
  document.getElementById('row-count').textContent=vis;
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function showDetail(jsonStr){
  const l=JSON.parse(jsonStr);
  const id='#'+String(l.id||0).padStart(4,'0');
  document.getElementById('modal-title').textContent='Detail Laporan '+id;
  const row=(lbl,val)=>'<div class="detail-row"><div class="detail-label">'+lbl+'</div><div class="detail-val">'+val+'</div></div>';
  const lat=l.koordinat?.lat||l.koordinat?.latitude||0;
  const lon=l.koordinat?.lon||l.koordinat?.longitude||0;
  let html='';
  html+=row('No. Laporan','<span class="id-badge">'+id+'</span>');
  html+=row('Pelapor','<strong>'+esc(l.namaPelapor)+'</strong>');
  html+=row('No. WA',esc((l.pelapor||'').replace('@s.whatsapp.net',''))||'-');
  html+='<hr class="detail-divider">';
  html+=row('Kategori','<span class="kat-tag">'+esc(l.kategori)+'</span>');
  html+=row('Kelurahan',esc(l.kelurahan)||'-');
  html+=row('Uraian',esc(l.isi)||'-');
  html+='<hr class="detail-divider">';
  html+=row('Alamat',esc(l.alamat)||'-');
  html+=row('Lokasi','<a class="map-link" href="https://maps.google.com/?q='+lat+','+lon+'" target="_blank">📍 '+lat+', '+lon+' — Buka Google Maps</a>');
  html+=row('Waktu',esc(l.tanggal?new Date(l.tanggal).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'full',timeStyle:'short'}):'-'));
  html+='<hr class="detail-divider">';
  if (l.fotoPath) {
    html+=row('Foto Bukti','<a href="'+l.fotoPath+'" target="_blank"><img src="'+l.fotoPath+'" class="modal-img" alt="Foto bukti laporan" loading="lazy"></a><div style="font-size:11px;color:var(--muted);margin-top:6px">Klik foto untuk buka ukuran penuh</div>');
  } else {
    html+=row('Foto Bukti','<div class="no-img">📷 Foto tidak tersedia untuk laporan ini</div>');
  }

  // ── Ubah Status Laporan ──
  html+='<hr class="detail-divider">';
  const curStatus = l.status || 'terkirim';
  const statusOpts = ['terkirim','diproses','selesai','ditolak'].map(s => {
    const m = {terkirim:'📨 Terkirim',diproses:'⚙️ Diproses',selesai:'✅ Selesai',ditolak:'❌ Ditolak'};
    return '<option value="' + s + '"' + (s===curStatus?' selected':'') + '>' + m[s] + '</option>';
  }).join('');
  html+='<div class="fb-box" style="padding:14px 16px">'
    +'<div class="fb-title" style="margin-bottom:10px">🔄 Ubah Status Laporan</div>'
    +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
    +'<select id="status-sel-'+l.id+'" style="flex:1;min-width:160px;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;outline:none">'+statusOpts+'</select>'
    +'<button onclick="updateLaporanStatus('+l.id+',this)" style="background:var(--accent);border:none;border-radius:8px;padding:9px 18px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">Simpan Status</button>'
    +'</div>'
    +'<label style="display:inline-flex;align-items:center;gap:7px;margin-top:10px;font-size:12px;color:var(--text2);cursor:pointer">'
    +'<input type="checkbox" id="status-notify-'+l.id+'" checked style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer">'
    +'Kirim notifikasi WhatsApp ke pelapor'
    +'</label>'
    +'<div id="status-msg-'+l.id+'" style="display:none;margin-top:10px;font-size:12px;padding:8px 12px;border-radius:7px"></div>'
    +'</div>';

  // ── Form Feedback ke Pelapor ──
  html+='<hr class="detail-divider">';
  html+='<div class="fb-box">'
    +'<div class="fb-title">💬 Kirim Balasan ke Pelapor</div>'
    +'<textarea class="fb-textarea" id="fb-pesan-'+l.id+'" placeholder="Tulis balasan / hasil tindak lanjut laporan ini..."></textarea>'
    +'<label class="fb-file-label" for="fb-foto-'+l.id+'">'
    +'📎 Lampirkan Foto (opsional)'
    +'<input type="file" id="fb-foto-'+l.id+'" accept="image/*" style="display:none" onchange="previewFbFoto(this,'+l.id+')">'
    +'</label>'
    +'<img id="fb-preview-'+l.id+'" class="fb-preview" alt="Preview">'
    +'<button class="fb-send-btn" data-id="'+l.id+'" data-pelapor="'+esc(l.pelapor||'')+'" data-nama="'+esc(l.namaPelapor||'')+'" onclick="sendFeedback(this.dataset.id,this.dataset.pelapor,this.dataset.nama,this)">📤 Kirim Balasan via WhatsApp</button>'
    +'<div class="fb-status" id="fb-status-'+l.id+'"></div>'
    +'</div>';

  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-overlay').style.display='flex';
}
function closeModal(e){if(e.target.id==='modal-overlay')closeModalDirect()}
function closeModalDirect(){document.getElementById('modal-overlay').style.display='none'}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModalDirect()});

const COLORS=['#00c8ff','#00e5a0','#fbbf24','#a78bfa','#ff4d6d','#38bdf8','#fb923c'];
const gridOpts={color:'rgba(26,51,86,.6)'};
const tickOpts={color:'#4a6a8a',font:{size:11}};
new Chart(document.getElementById('chartDay').getContext('2d'),{
  type:'bar',
  data:{labels:${cDayL},datasets:[{data:${cDayD},backgroundColor:'rgba(0,200,255,.2)',borderColor:'#00c8ff',borderWidth:1.5,borderRadius:5}]},
  options:{plugins:{legend:{display:false}},scales:{x:{grid:gridOpts,ticks:tickOpts},y:{grid:gridOpts,ticks:{...tickOpts,stepSize:1},beginAtZero:true}},responsive:true}
});
new Chart(document.getElementById('chartKat').getContext('2d'),{
  type:'doughnut',
  data:{labels:${cKatL},datasets:[{data:${cKatD},backgroundColor:COLORS,borderWidth:0,hoverOffset:6}]},
  options:{plugins:{legend:{position:'bottom',labels:{color:'#8facc5',font:{size:11},padding:10,boxWidth:12}}},cutout:'62%',responsive:true}
});
new Chart(document.getElementById('chartKel').getContext('2d'),{
  type:'bar',
  data:{labels:${cKelL},datasets:[{data:${cKelD},backgroundColor:COLORS.map(c=>c+'33'),borderColor:COLORS,borderWidth:1.5,borderRadius:4}]},
  options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:gridOpts,ticks:{...tickOpts,stepSize:1},beginAtZero:true},y:{grid:{display:false},ticks:tickOpts}},responsive:true}
});

// ── SSE REAL-TIME UPDATE ─────────────────────────────────
const toastStyle = \`
  position:fixed;bottom:24px;right:24px;z-index:999;
  background:#0e1e38;border:1px solid rgba(0,229,160,.35);
  border-radius:12px;padding:14px 18px;
  display:flex;align-items:center;gap:10px;
  box-shadow:0 8px 32px rgba(0,0,0,.5);
  font-family:'DM Sans',sans-serif;font-size:13px;color:#e2eaf5;
  animation:slideIn .35s cubic-bezier(.16,1,.3,1) both;
  max-width:320px;
\`;
const toastKeyframes = \`@keyframes slideIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}\`;
const styleEl = document.createElement('style');
styleEl.textContent = toastKeyframes;
document.head.appendChild(styleEl);

function showToast(msg, emoji='🔔') {
  const t = document.createElement('div');
  t.style.cssText = toastStyle;
  t.innerHTML = '<span style="font-size:20px">'+emoji+'</span><div><div style="font-weight:600;margin-bottom:2px">Laporan Baru Masuk!</div><div style="font-size:12px;color:#8facc5">'+msg+'</div></div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#4a6a8a;font-size:18px;cursor:pointer;margin-left:auto;padding:0 0 0 8px">✕</button>';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 8000);
}

function fmtDateClient(iso) {
  try { return new Date(iso).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
  catch { return iso||'-'; }
}

function buildRow(l) {
  const id='#'+String(l.id||0).padStart(4,'0');
  const jsonEsc=esc(JSON.stringify(l));
  return '<tr data-kat="'+esc(l.kategori)+'" data-kel="'+esc(l.kelurahan)+'" style="animation:fi .4s ease both">'
    +'<td><span class="id-badge">'+id+'</span></td>'
    +'<td><div class="fw5">'+esc(l.namaPelapor)+'</div><div class="fz12 text-muted">'+esc((l.pelapor||'').replace('@s.whatsapp.net',''))+'</div></td>'
    +'<td><span class="kat-tag">'+esc(l.kategori)+'</span></td>'
    +'<td>'+esc(l.kelurahan)+'</td>'
    +'<td class="fz13 text-muted2" style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(l.isi)+'">'+(l.isi||'').substring(0,60)+((l.isi||'').length>60?'…':'')+'</td>'
    +'<td><a class="map-link" href="https://maps.google.com/?q='+(l.koordinat?.lat||0)+','+(l.koordinat?.lon||0)+'" target="_blank">📍 Peta</a></td>'
    +'<td class="fz12 text-muted2">'+fmtDateClient(l.tanggal)+'</td>'
    +'<td><button class="det-btn" data-laporan="'+jsonEsc+'">Detail</button></td>'
    +'</tr>';
}

let knownCount = ${total};

const evtSource = new EventSource('/sse');
evtSource.addEventListener('update', (e) => {
  const data = JSON.parse(e.data);
  const laporan = data.laporan;
  if (!laporan || laporan.length === knownCount) return;

  const newCount = laporan.length;
  const newItems = laporan.slice(0, newCount - knownCount);
  knownCount = newCount;

  // Update stat cards
  document.querySelector('#sec-overview .sc-val').textContent = newCount;
  const todayCount = laporan.filter(l=>new Date(l.tanggal).toDateString()===new Date().toDateString()).length;
  document.querySelectorAll('#sec-overview .sc-val')[1].textContent = todayCount;
  const now=new Date();
  const monthCount = laporan.filter(l=>{const d=new Date(l.tanggal);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;
  document.querySelectorAll('#sec-overview .sc-val')[2].textContent = monthCount;

  // Update row count badge
  document.getElementById('row-count').textContent = newCount;

  // Prepend new rows to main table
  const tbody = document.getElementById('table-body');
  newItems.reverse().forEach(l => {
    tbody.insertAdjacentHTML('afterbegin', buildRow(l));
  });

  // Update recent table in overview
  const overviewTbody = document.querySelector('#sec-overview table tbody');
  if (overviewTbody) {
    const allRows = Array.from(overviewTbody.querySelectorAll('tr'));
    newItems.reverse().forEach(l => {
      const id='#'+String(l.id||0).padStart(4,'0');
      const jsonEsc=esc(JSON.stringify(l));
      const row='<tr style="animation:fi .4s ease both">'
        +'<td><span class="id-badge">'+id+'</span></td>'
        +'<td class="fw5">'+esc(l.namaPelapor)+'</td>'
        +'<td><span class="kat-tag">'+esc(l.kategori)+'</span></td>'
        +'<td>'+esc(l.kelurahan)+'</td>'
        +'<td class="fz12 text-muted2">'+fmtDateClient(l.tanggal)+'</td>'
        +'<td><button class="det-btn" data-laporan="'+jsonEsc+'">Detail</button></td>'
        +'</tr>';
      overviewTbody.insertAdjacentHTML('afterbegin', row);
    });
    // Trim to 5 rows
    Array.from(overviewTbody.querySelectorAll('tr')).slice(5).forEach(r=>r.remove());
  }

  // Toast per laporan baru
  newItems.forEach(l => {
    showToast(esc(l.kategori)+' — '+esc(l.kelurahan)+' oleh '+esc(l.namaPelapor));
  });
});

evtSource.addEventListener('error', () => {
  // Reconnect otomatis ditangani browser, tidak perlu action manual
});

// ── Export Excel ──────────────────────────────────────────
function startExport(el) {
  el.classList.add('loading');
  el.textContent = '⏳ Menyiapkan...';
  setTimeout(() => {
    el.classList.remove('loading');
    el.textContent = '📊 Export Excel';
  }, 4000);
}

// ── Kegiatan Kecamatan ────────────────────────────────────
async function addKegiatan() {
  const nama     = document.getElementById('kg-nama').value.trim();
  const tanggal  = document.getElementById('kg-tanggal').value.trim();
  const tempat   = document.getElementById('kg-tempat').value.trim();
  const deskripsi= document.getElementById('kg-deskripsi').value.trim();
  const statusEl = document.getElementById('kg-status');

  if (!nama) {
    document.getElementById('kg-nama').focus();
    statusEl.textContent = '⚠️ Nama kegiatan wajib diisi.';
    statusEl.className = 'kg-status err';
    return;
  }

  statusEl.className = 'kg-status';
  try {
    const res  = await fetch('/api/kegiatan/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, tanggal, tempat, deskripsi })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal');

    // Reset form
    ['kg-nama','kg-tanggal','kg-tempat','kg-deskripsi'].forEach(id => document.getElementById(id).value = '');

    // Inject card baru ke atas list
    const k = json.kegiatan;
    const card = \`<div class="kg-card" id="kgcard-\${k.id}">
      <div class="kg-card-ico">📌</div>
      <div class="kg-card-body">
        <div class="kg-card-name">\${esc(k.nama)}</div>
        <div class="kg-card-meta">
          \${k.tanggal ? \`<span class="kg-chip">📅 \${esc(k.tanggal)}</span>\` : ''}
          \${k.tempat  ? \`<span class="kg-chip">📍 \${esc(k.tempat)}</span>\`  : ''}
        </div>
        \${k.deskripsi ? \`<div class="kg-card-desc">\${esc(k.deskripsi)}</div>\` : ''}
      </div>
      <button class="kg-del-btn" onclick="deleteKegiatan('\${k.id}',this)">🗑️ Hapus</button>
    </div>\`;

    const list = document.getElementById('kg-list');
    const emptyEl = list.querySelector('.kg-empty');
    if (emptyEl) emptyEl.remove();
    list.insertAdjacentHTML('afterbegin', card);

    // Update badge count
    const countEl = document.getElementById('kg-count');
    const cur = parseInt(countEl.textContent) || 0;
    countEl.textContent = (cur + 1) + ' kegiatan';

    statusEl.textContent = '✅ Kegiatan berhasil ditambahkan! Menu bot sudah diperbarui.';
    statusEl.className = 'kg-status ok';
    setTimeout(() => { statusEl.className = 'kg-status'; }, 4000);
  } catch(e) {
    statusEl.textContent = '❌ Gagal: ' + e.message;
    statusEl.className = 'kg-status err';
  }
}

async function deleteKegiatan(id, btn) {
  if (!confirm('Hapus kegiatan ini dari menu bot?')) return;
  try {
    const res  = await fetch('/api/kegiatan/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal');

    const card = document.getElementById('kgcard-' + id);
    if (card) card.remove();

    const list = document.getElementById('kg-list');
    if (!list.querySelector('.kg-card')) {
      list.innerHTML = '<div class="kg-empty"><div class="ico">📭</div>Belum ada kegiatan. Tambahkan melalui form di atas.</div>';
    }

    // Update badge count
    const countEl = document.getElementById('kg-count');
    const cur = parseInt(countEl.textContent) || 1;
    countEl.textContent = Math.max(0, cur - 1) + ' kegiatan';
  } catch(e) {
    alert('Gagal hapus: ' + e.message);
  }
}

// ── Feedback ke Pelapor ───────────────────────────────────
function previewFbFoto(input, laporanId) {
  const preview = document.getElementById('fb-preview-' + laporanId);
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
    // Update label teks
    input.previousElementSibling && (input.parentElement.childNodes[0].textContent = '✅ ' + input.files[0].name);
  }
}

async function sendFeedback(laporanId, pelapor, namaPelapor, btn) {
  const pesanEl = document.getElementById('fb-pesan-' + laporanId);
  const fotoEl  = document.getElementById('fb-foto-'  + laporanId);
  const statusEl= document.getElementById('fb-status-'+ laporanId);
  const pesan = pesanEl.value.trim();

  if (!pesan) { pesanEl.focus(); return; }

  btn.disabled = true;
  btn.textContent = '⏳ Mengirim...';
  statusEl.className = 'fb-status';
  statusEl.style.display = 'none';

  let foto_base64 = null, foto_mime = null;
  const file = fotoEl.files && fotoEl.files[0];
  if (file) {
    foto_base64 = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result.split(',')[1]);
      r.readAsDataURL(file);
    });
    foto_mime = file.type || 'image/jpeg';
  }

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ laporanId, pelapor, namaPelapor, pesan, foto_base64, foto_mime })
    });
    const json = await res.json();
    if (json.ok) {
      statusEl.textContent = '✅ Balasan berhasil diantrekan! Bot akan mengirim ke pelapor sebentar lagi.';
      statusEl.className = 'fb-status ok';
      pesanEl.value = '';
      fotoEl.value = '';
      document.getElementById('fb-preview-' + laporanId).style.display = 'none';
      btn.textContent = '✅ Terkirim';
    } else {
      throw new Error(json.error || 'Gagal');
    }
  } catch(e) {
    statusEl.textContent = '❌ Gagal: ' + e.message;
    statusEl.className = 'fb-status err';
    btn.disabled = false;
    btn.textContent = '📤 Kirim Balasan via WhatsApp';
  }
}

// ══════════════════════════════════════════════
//   LIVECHAT ADMIN — Real-time via SSE
// ══════════════════════════════════════════════
let lcSessions = [];
let lcActiveId  = null;

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jakarta' }); }
  catch { return ''; }
}

function renderSessions(sessions) {
  const el = document.getElementById('lc-sessions');
  document.getElementById('lc-count').textContent = sessions.length;

  // Update unread badge di sidebar
  const totalUnread = sessions.reduce((n,s) => n + (s.status==='active' ? (s.unread||0) : 0), 0);
  const badge = document.getElementById('lc-unread-badge');
  if (totalUnread > 0) { badge.textContent = totalUnread; badge.style.display='inline'; }
  else { badge.style.display='none'; }

  if (!sessions.length) {
    el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted);font-size:12px">Belum ada sesi</div>';
    return;
  }

  el.innerHTML = sessions.map(s => {
    const lastMsg = s.messages?.slice(-1)[0];
    const preview = lastMsg ? lastMsg.text.substring(0,40) + (lastMsg.text.length>40?'…':'') : 'Sesi dimulai';
    const initials = (s.name||'?').charAt(0).toUpperCase();
    const active = s.id === lcActiveId ? 'active' : '';
    const closedCls = s.status==='closed' ? 'closed' : '';
    const unreadHtml = s.status==='active' && s.unread > 0
      ? \`<span class="lc-unread">\${s.unread}</span>\` : '';
    return \`<div class="lc-item \${active} \${closedCls}" onclick="openChat('\${s.id}')">
      <div class="lc-avatar">\${initials}</div>
      <div class="lc-meta">
        <div class="lc-name">\${esc(s.name)} \${unreadHtml}</div>
        <div class="lc-preview">\${esc(preview)}</div>
      </div>
      <div class="lc-time">\${fmtTime(s.lastMessageAt)}</div>
    </div>\`;
  }).join('');
}

function renderMessages(session) {
  const el = document.getElementById('lc-messages');
  if (!session.messages?.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px">Belum ada pesan</div>';
    return;
  }
  el.innerHTML = session.messages.map(m => {
    let bubbleContent = '';
    if (m.mediaPath) {
      // Tampilkan gambar + caption kalau ada
      bubbleContent += \`<a href="\${m.mediaPath}" target="_blank" rel="noopener">
        <img src="\${m.mediaPath}" class="lc-msg-img" alt="Foto" loading="lazy">
      </a>\`;
      if (m.text && m.text !== '[Foto]') {
        bubbleContent += \`<div style="margin-top:6px;font-size:13px">\${esc(m.text)}</div>\`;
      }
    } else {
      bubbleContent = esc(m.text);
    }
    return \`
    <div class="lc-msg \${m.from}">
      <div class="lc-msg-sender">\${m.from==='admin'?'Admin':'👤 '+esc(session.name)}</div>
      <div class="lc-bubble">\${bubbleContent}</div>
      <div class="lc-msg-time">\${fmtTime(m.timestamp)}</div>
    </div>\`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function openChat(sessionId) {
  lcActiveId = sessionId;
  const session = lcSessions.find(s => s.id === sessionId);
  if (!session) return;

  // Mark read via API
  fetch('/api/livechat/read', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId }) });

  // Highlight active
  document.querySelectorAll('.lc-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick').includes(sessionId));
  });

  // Show chat panel
  document.getElementById('lc-no-chat').style.display = 'none';
  const panel = document.getElementById('lc-active-chat');
  panel.style.display = 'flex';

  document.getElementById('lc-chat-name').textContent = session.name;
  document.getElementById('lc-chat-jid').textContent = (session.jid||'').replace('@s.whatsapp.net','');

  const dot = document.getElementById('lc-status-dot');
  dot.className = 'lc-status-dot' + (session.status==='closed' ? ' closed' : '');

  document.getElementById('lc-closed-banner').style.display = session.status==='closed' ? 'block' : 'none';
  document.getElementById('lc-input-area').style.display = session.status==='closed' ? 'none' : 'flex';
  document.getElementById('lc-end-btn').style.display = session.status==='closed' ? 'none' : '';

  renderMessages(session);

  // Clear unread locally
  session.unread = 0;
  renderSessions(lcSessions);
}

async function sendReply() {
  if (!lcActiveId) return;
  const input = document.getElementById('lc-reply-input');
  const btn   = document.getElementById('lc-reply-btn');
  const text  = input.value.trim();
  if (!text) return;

  const session = lcSessions.find(s => s.id === lcActiveId);
  if (!session || session.status === 'closed') return;

  btn.disabled = true;
  input.disabled = true;

  try {
    const res = await fetch('/api/livechat/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: lcActiveId, text })
    });
    const json = await res.json();
    if (json.ok) {
      input.value = '';
      // Pesan akan muncul via SSE update berikutnya (< 2 detik)
    } else {
      alert('Gagal kirim: ' + (json.error || 'Unknown error'));
    }
  } catch(e) {
    alert('Error: ' + e.message);
  } finally {
    btn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

async function endSession() {
  if (!lcActiveId) return;
  if (!confirm('Akhiri sesi LiveChat dengan warga ini?')) return;
  try {
    const res = await fetch('/api/livechat/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: lcActiveId })
    });
    const json = await res.json();
    if (!json.ok) alert('Gagal: ' + (json.error||''));
  } catch(e) { alert('Error: '+e.message); }
}

// Terima update livechat dari SSE
evtSource.addEventListener('livechat', (e) => {
  const data = JSON.parse(e.data);
  lcSessions = data.sessions || [];
  renderSessions(lcSessions);

  // Jika ada sesi aktif terbuka, refresh messages-nya
  if (lcActiveId) {
    const current = lcSessions.find(s => s.id === lcActiveId);
    if (current) {
      renderMessages(current);
      document.getElementById('lc-closed-banner').style.display = current.status==='closed' ? 'block' : 'none';
      document.getElementById('lc-input-area').style.display = current.status==='closed' ? 'none' : 'flex';
      document.getElementById('lc-end-btn').style.display = current.status==='closed' ? 'none' : '';
      const dot = document.getElementById('lc-status-dot');
      dot.className = 'lc-status-dot' + (current.status==='closed'?' closed':'');
      // Toast jika ada pesan baru dari user
      if (current.status==='active') {
        const last = current.messages?.slice(-1)[0];
        if (last && last.from==='user' && (Date.now()-new Date(last.timestamp).getTime()) < 4000) {
          // sudah tampil di panel
        }
      }
    }
  }

  // Toast untuk sesi baru
  lcSessions.filter(s=>s.status==='active'&&s.messages?.length===0).forEach(s=>{
    // already handled
  });
});

// ── Grup Management ────────────────────────────────────────
async function addGroup() {
  const idInput   = document.getElementById('grp-id-input');
  const nameInput = document.getElementById('grp-name-input');
  const status    = document.getElementById('add-grp-status');
  const groupId   = idInput.value.trim();
  const groupName = nameInput.value.trim();

  if (!groupId) { idInput.focus(); return; }
  if (!groupId.endsWith('@g.us')) {
    status.textContent = '⚠️ Group ID harus diakhiri dengan @g.us';
    status.className = 'routing-status err';
    return;
  }

  status.className = 'routing-status';
  status.style.display = 'none';

  try {
    const res = await fetch('/api/group/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, groupName: groupName || groupId })
    });
    const json = await res.json();
    if (json.ok) {
      status.textContent = '✅ Grup berhasil ditambahkan! Halaman akan direfresh...';
      status.className = 'routing-status ok';
      idInput.value = '';
      nameInput.value = '';
      setTimeout(() => location.reload(), 1500);
    } else {
      status.textContent = '❌ ' + (json.error || 'Gagal menambahkan grup');
      status.className = 'routing-status err';
    }
  } catch(e) {
    status.textContent = '❌ Error: ' + e.message;
    status.className = 'routing-status err';
  }
}

async function deleteGroup(groupId, groupName) {
  if (!confirm('Hapus grup "' + groupName + '" dari daftar penerima laporan?')) return;
  try {
    const res = await fetch('/api/group/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId })
    });
    const json = await res.json();
    if (json.ok) {
      location.reload();
    } else {
      alert('Gagal hapus grup: ' + (json.error || ''));
    }
  } catch(e) { alert('Error: ' + e.message); }
}

// ── Delete Laporan ─────────────────────────────────────────
async function deleteLaporanRow(laporanId, btn) {
  if (!confirm('Hapus laporan #' + String(laporanId).padStart(4,'0') + '? Tindakan ini tidak bisa dibatalkan.')) return;
  try {
    const res = await fetch('/api/laporan/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: laporanId })
    });
    const json = await res.json();
    if (json.ok) {
      const row = btn.closest('tr');
      row.style.opacity = '0';
      row.style.transition = 'opacity .3s';
      setTimeout(() => { row.remove(); const cnt=document.getElementById('row-count'); if(cnt)cnt.textContent=parseInt(cnt.textContent||'0')-1; }, 300);
    } else {
      alert('Gagal hapus laporan: ' + (json.error || ''));
    }
  } catch(e) { alert('Error: ' + e.message); }
}

async function updateLaporanStatus(laporanId, btn) {
  const sel = document.getElementById('status-sel-' + laporanId);
  const msgEl = document.getElementById('status-msg-' + laporanId);
  const notifyChk = document.getElementById('status-notify-' + laporanId);
  if (!sel || !msgEl) return;
  const status = sel.value;
  const notify = notifyChk ? notifyChk.checked : true;
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  try {
    const res = await fetch('/api/laporan/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: laporanId, status, notify })
    });
    const json = await res.json();
    if (json.ok) {
      msgEl.style.display = 'block';
      msgEl.style.background = 'rgba(52,211,153,.12)';
      msgEl.style.border = '1px solid rgba(52,211,153,.3)';
      msgEl.style.color = '#34d399';
      msgEl.textContent = notify
        ? '✅ Status diperbarui! Notifikasi WhatsApp diantrekan.'
        : '✅ Status berhasil diperbarui!';
      // Update badge di baris tabel
      const STATUS_MAP = { terkirim:'📨 Terkirim', diproses:'⚙️ Diproses', selesai:'✅ Selesai', ditolak:'❌ Ditolak' };
      const COLOR_MAP  = { terkirim:'#60a5fa', diproses:'#fbbf24', selesai:'#34d399', ditolak:'#f87171' };
      const BG_MAP     = { terkirim:'rgba(96,165,250,.15)', diproses:'rgba(251,191,36,.15)', selesai:'rgba(52,211,153,.15)', ditolak:'rgba(248,113,113,.15)' };
      const label = STATUS_MAP[status] || status;
      const color = COLOR_MAP[status] || '#94a3b8';
      const bg    = BG_MAP[status]    || 'rgba(148,163,184,.15)';
      const newBadge = \`<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;background:\${bg};color:\${color};border:1px solid \${color}33">\${label}</span>\`;
      document.querySelectorAll('#table-body tr').forEach(row => {
        const detBtn = row.querySelector('.det-btn[data-laporan]');
        if (detBtn) {
          try {
            const lapData = JSON.parse(detBtn.dataset.laporan);
            if (String(lapData.id) === String(laporanId)) {
              const cells = row.querySelectorAll('td');
              if (cells[5]) cells[5].innerHTML = newBadge;
            }
          } catch {}
        }
      });
      setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
    } else {
      msgEl.style.display = 'block';
      msgEl.style.background = 'rgba(248,113,113,.12)';
      msgEl.style.border = '1px solid rgba(248,113,113,.3)';
      msgEl.style.color = '#f87171';
      msgEl.textContent = '❌ Gagal: ' + (json.error || 'Terjadi kesalahan');
    }
  } catch(e) {
    msgEl.style.display = 'block';
    msgEl.style.background = 'rgba(248,113,113,.12)';
    msgEl.style.border = '1px solid rgba(248,113,113,.3)';
    msgEl.style.color = '#f87171';
    msgEl.textContent = '❌ Error: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan Status';
  }
}

// ── Routing ────────────────────────────────────────────────
async function saveRouting() {
  const status = document.getElementById('routing-status');
  const categories = ${JSON.stringify(KATEGORI_PENGADUAN.map(k=>k.label))};
  const routing = {};
  categories.forEach(kat => {
    const sel = document.getElementById('rt-' + kat);
    if (sel && sel.value) routing[kat] = sel.value;
  });
  status.className = 'routing-status';
  status.style.display = 'none';
  try {
    const res = await fetch('/api/group/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routing })
    });
    const json = await res.json();
    if (json.ok) {
      status.textContent = '✅ Routing berhasil disimpan!';
      status.className = 'routing-status ok';
      setTimeout(() => { status.className='routing-status'; status.style.display='none'; }, 3000);
    } else {
      status.textContent = '❌ Gagal: ' + (json.error || '');
      status.className = 'routing-status err';
    }
  } catch(e) {
    status.textContent = '❌ Error: ' + e.message;
    status.className = 'routing-status err';
  }
}

// ══════════════════════════════════════════════
//   BROADCAST SALURAN
// ══════════════════════════════════════════════
let bcMediaFile = null;

function onBcMediaChange(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  bcMediaFile = file;
  const wrap = document.getElementById('bc-preview-wrap');
  const img  = document.getElementById('bc-preview-img');
  const vid  = document.getElementById('bc-preview-video');
  wrap.style.display = 'block';
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) {
    img.style.display = 'none';
    vid.style.display = 'block';
    vid.src = url;
  } else {
    vid.style.display = 'none';
    img.style.display = 'block';
    img.src = url;
  }
  document.getElementById('bc-media-label').childNodes[0].textContent = '✅ ' + file.name;
}

function removeBcMedia() {
  bcMediaFile = null;
  document.getElementById('bc-media-input').value = '';
  document.getElementById('bc-preview-wrap').style.display = 'none';
  document.getElementById('bc-preview-img').src = '';
  document.getElementById('bc-preview-video').src = '';
  document.getElementById('bc-media-label').childNodes[0].textContent = '📎 Lampirkan Foto / Video (opsional)';
}

async function sendBroadcast() {
  const target  = document.getElementById('bc-target').value.trim();
  const pesan   = document.getElementById('bc-pesan').value.trim();
  const statusEl= document.getElementById('bc-status');
  const btn     = document.getElementById('bc-send-btn');

  if (!target) {
    statusEl.textContent = '⚠️ Pilih saluran tujuan terlebih dahulu.';
    statusEl.className = 'bc-status err';
    return;
  }
  if (!pesan && !bcMediaFile) {
    statusEl.textContent = '⚠️ Isi pesan atau lampirkan media terlebih dahulu.';
    statusEl.className = 'bc-status err';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '⏳ Mengirim...';
  statusEl.className = 'bc-status';
  statusEl.style.display = 'none';

  let media_base64 = null, media_mime = null, media_filename = null;
  if (bcMediaFile) {
    media_base64 = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result.split(',')[1]);
      r.readAsDataURL(bcMediaFile);
    });
    media_mime = bcMediaFile.type;
    media_filename = bcMediaFile.name;
  }

  try {
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelJid: target, pesan, media_base64, media_mime, media_filename })
    });
    const json = await res.json();
    if (json.ok) {
      statusEl.textContent = '✅ Broadcast diantrekan! Bot akan mengirim dalam beberapa detik.';
      statusEl.className = 'bc-status ok';
      document.getElementById('bc-pesan').value = '';
      removeBcMedia();
      setTimeout(() => refreshBcHistory(), 3500);
    } else {
      throw new Error(json.error || 'Gagal');
    }
  } catch(e) {
    statusEl.textContent = '❌ Gagal: ' + e.message;
    statusEl.className = 'bc-status err';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📢 Kirim Broadcast';
  }
}

async function loadMedanBeritaPreview() {
  const el = document.getElementById('medan-berita-preview');
  const st = document.getElementById('medan-berita-status');
  const n = document.getElementById('medan-bc-count').value;
  el.innerHTML = '⏳ Memuat berita dari portal Pemko Medan...';
  st.style.display = 'none';
  try {
    const res = await fetch('/api/medan-berita?limit=' + encodeURIComponent(n));
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal');
    if (!json.items || !json.items.length) {
      el.textContent = 'Tidak ada berita yang bisa dibaca dari halaman.';
      return;
    }
    el.innerHTML = json.items.map(it =>
      '<div style="display:flex;gap:12px;margin-bottom:14px;padding:12px;background:var(--bg3);border-radius:10px;border:1px solid var(--border)">' +
      '<img src="' + esc(it.imageUrl) + '" alt="" style="width:100px;height:72px;object-fit:cover;border-radius:6px;flex-shrink:0" loading="lazy">' +
      '<div><div style="font-weight:600;color:var(--text);margin-bottom:4px">' + esc(it.title) + '</div>' +
      '<div style="opacity:.92;line-height:1.45">' + esc(it.description.length > 220 ? it.description.slice(0, 220) + '…' : it.description) + '</div></div></div>'
    ).join('');
  } catch (e) {
    st.textContent = '❌ ' + e.message;
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
    el.textContent = '';
  }
}

async function loadMedanBeritaList() {
  const container = document.getElementById('medan-berita-list-container');
  const st = document.getElementById('medan-berita-list-status');
  const n = parseInt(document.getElementById('medan-bc-preview-count').value, 10) || 5;
  
  container.innerHTML = '⏳ Memuat daftar berita...';
  st.style.display = 'block';
  st.className = 'bc-ch-status ok';
  st.textContent = '⏳ Mengambil data berita...';
  
  try {
    const res = await fetch('/api/medan-berita?limit=' + encodeURIComponent(n));
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal mengambil berita');
    if (!json.items || !json.items.length) {
      container.textContent = 'Tidak ada berita yang tersedia di halaman.';
      st.style.display = 'none';
      return;
    }
    
    const newsHtml = json.items.map((it, idx) =>
      '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:12px;background:var(--bg3);border-radius:10px;border:1px solid var(--border)">' +
      '<input type="checkbox" class="medan-news-checkbox" data-index="' + idx + '" style="width:18px;height:18px;margin-top:2px;cursor:pointer;flex-shrink:0">' +
      '<img src="' + esc(it.imageUrl) + '" alt="" style="width:80px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0" loading="lazy">' +
      '<div style="flex:1"><div style="font-weight:600;color:var(--text);margin-bottom:3px;font-size:13px">' + esc(it.title) + '</div>' +
      '<div style="opacity:.85;line-height:1.4;font-size:12px">' + esc(it.description.length > 160 ? it.description.slice(0, 160) + '…' : it.description) + '</div></div></div>'
    ).join('');
    
    container.innerHTML = newsHtml;
    st.textContent = '✅ Daftar berita dimuat (' + json.items.length + ' berita)';
    st.className = 'bc-ch-status ok';
  } catch (e) {
    st.textContent = '❌ ' + e.message;
    st.className = 'bc-ch-status err';
    container.textContent = '';
  }
}

function selectAllMedanNews() {
  document.querySelectorAll('.medan-news-checkbox').forEach(cb => cb.checked = true);
}

function deselectAllMedanNews() {
  document.querySelectorAll('.medan-news-checkbox').forEach(cb => cb.checked = false);
}

async function sendSelectedMedanNews() {
  const target = document.getElementById('medan-bc-target').value.trim();
  const st = document.getElementById('medan-berita-send-status');
  const btn = document.getElementById('medan-send-selected-btn');
  const checked = Array.from(document.querySelectorAll('.medan-news-checkbox:checked'));
  
  if (!target) {
    st.textContent = '⚠️ Pilih saluran tujuan terlebih dahulu.';
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
    return;
  }
  
  if (!checked.length) {
    st.textContent = '⚠️ Pilih minimal 1 berita untuk dikirim.';
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
    return;
  }
  
  const indices = checked.map(cb => parseInt(cb.dataset.index, 10));
  btn.disabled = true;
  st.style.display = 'block';
  st.className = 'bc-ch-status ok';
  st.textContent = '⏳ Mengunduh gambar & mengantre broadcast...';
  
  try {
    const res = await fetch('/api/medan-berita/send-selected', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelJid: target, indices })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal');
    st.textContent = '✅ ' + (json.message || json.queued + ' berita diantrekan.');
    st.className = 'bc-ch-status ok';
    deselectAllMedanNews();
    setTimeout(() => refreshBcHistory(), 2500);
  } catch (e) {
    st.textContent = '❌ ' + e.message;
    st.className = 'bc-ch-status err';
  } finally {
    btn.disabled = false;
  }
}

// ─── Pemko Medan News Functions ──────────────────────────────────────────────

async function loadPemkoBeritaList() {
  const container = document.getElementById('pemko-berita-list-container');
  const st = document.getElementById('pemko-berita-list-status');
  const n = parseInt(document.getElementById('pemko-bc-preview-count').value, 10) || 5;

  container.innerHTML = '⏳ Memuat daftar berita Pemko Medan...';
  st.style.display = 'block';
  st.className = 'bc-ch-status ok';
  st.textContent = '⏳ Mengambil data berita dari portal.medan.go.id...';

  try {
    const res = await fetch('/api/pemko-berita?limit=' + encodeURIComponent(n));
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal mengambil berita');
    if (!json.items || !json.items.length) {
      container.textContent = 'Tidak ada berita yang tersedia di halaman.';
      st.style.display = 'none';
      return;
    }

    const newsHtml = json.items.map((it, idx) =>
      '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:12px;background:var(--bg3);border-radius:10px;border:1px solid var(--border)">' +
      '<input type="checkbox" class="pemko-news-checkbox" data-index="' + idx + '" style="width:18px;height:18px;margin-top:2px;cursor:pointer;flex-shrink:0">' +
      (it.imageUrl ? '<img src="' + esc(it.imageUrl) + '" alt="" style="width:80px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0" loading="lazy">' : '') +
      '<div style="flex:1"><div style="font-weight:600;color:var(--text);margin-bottom:3px;font-size:13px">' + esc(it.title) + '</div>' +
      '<div style="opacity:.85;line-height:1.4;font-size:12px">' + esc(it.description && it.description.length > 160 ? it.description.slice(0, 160) + '\u2026' : it.description || '') + '</div></div></div>'
    ).join('');

    container.innerHTML = newsHtml;
    st.textContent = '✅ Daftar berita dimuat (' + json.items.length + ' berita Pemko Medan)';
    st.className = 'bc-ch-status ok';
  } catch (e) {
    st.textContent = '❌ ' + e.message;
    st.className = 'bc-ch-status err';
    container.textContent = '';
  }
}

function selectAllPemkoNews() {
  document.querySelectorAll('.pemko-news-checkbox').forEach(cb => cb.checked = true);
}

function deselectAllPemkoNews() {
  document.querySelectorAll('.pemko-news-checkbox').forEach(cb => cb.checked = false);
}

async function sendSelectedPemkoNews() {
  const target = document.getElementById('pemko-bc-target').value.trim();
  const st = document.getElementById('pemko-berita-send-status');
  const btn = document.getElementById('pemko-send-selected-btn');
  const checked = Array.from(document.querySelectorAll('.pemko-news-checkbox:checked'));

  if (!target) {
    st.textContent = '⚠️ Pilih saluran tujuan terlebih dahulu.';
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
    return;
  }

  if (!checked.length) {
    st.textContent = '⚠️ Pilih minimal 1 berita untuk dikirim.';
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
    return;
  }

  const indices = checked.map(cb => parseInt(cb.dataset.index, 10));
  btn.disabled = true;
  st.style.display = 'block';
  st.className = 'bc-ch-status ok';
  st.textContent = '⏳ Mengunduh gambar & mengantre broadcast...';

  try {
    const res = await fetch('/api/pemko-berita/send-selected', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelJid: target, indices })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal');
    st.textContent = '✅ ' + (json.message || json.queued + ' berita diantrekan.');
    st.className = 'bc-ch-status ok';
    deselectAllPemkoNews();
    setTimeout(() => refreshBcHistory(), 2500);
  } catch (e) {
    st.textContent = '❌ ' + e.message;
    st.className = 'bc-ch-status err';
  } finally {
    btn.disabled = false;
  }
}

}


// ─── Automation: Berita Pemko Medan ──────────────────────────────────────────

document.getElementById('auto-mode-ping').addEventListener('change', function() {
  document.getElementById('auto-ping-section').style.display = this.checked ? '' : 'none';
});
document.getElementById('auto-mode-broadcast').addEventListener('change', function() {
  document.getElementById('auto-broadcast-section').style.display = this.checked ? '' : 'none';
});

async function saveAutoBeritaConfig() {
  const st  = document.getElementById('auto-save-status');
  const btn = document.getElementById('auto-save-btn');
  const enabled         = document.getElementById('auto-enabled').checked;
  const modePing        = document.getElementById('auto-mode-ping').checked;
  const modeBroadcast   = document.getElementById('auto-mode-broadcast').checked;
  const intervalMinutes = parseInt(document.getElementById('auto-interval').value, 10) || 30;
  const pingRaw         = document.getElementById('auto-ping-numbers').value;
  const pingNumbers     = pingRaw.split('\n').map(s => s.replace(/\D/g, '')).filter(Boolean);
  const channelJid      = document.getElementById('auto-channel').value.trim();

  if (enabled && !modePing && !modeBroadcast) {
    st.textContent = '\u26a0\ufe0f Pilih minimal satu mode aksi (Ping atau Broadcast).';
    st.className = 'bc-ch-status err'; st.style.display = 'block'; return;
  }
  if (enabled && modePing && !pingNumbers.length) {
    st.textContent = '\u26a0\ufe0f Isi minimal satu nomor WA untuk mode Ping.';
    st.className = 'bc-ch-status err'; st.style.display = 'block'; return;
  }
  if (enabled && modeBroadcast && !channelJid) {
    st.textContent = '\u26a0\ufe0f Pilih saluran untuk mode Broadcast.';
    st.className = 'bc-ch-status err'; st.style.display = 'block'; return;
  }
  if (intervalMinutes < 5) {
    st.textContent = '\u26a0\ufe0f Interval minimal 5 menit.';
    st.className = 'bc-ch-status err'; st.style.display = 'block'; return;
  }

  btn.disabled = true;
  st.textContent = '\u23f3 Menyimpan...';
  st.className = 'bc-ch-status ok'; st.style.display = 'block';
  try {
    const res  = await fetch('/api/automation/berita-pemko', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, modePing, modeBroadcast, pingNumbers, channelJid, intervalMinutes })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal menyimpan');
    st.textContent = '\u2705 Konfigurasi berhasil disimpan.';
    st.className = 'bc-ch-status ok';
    // Update status indicator
    const ind = document.getElementById('auto-indicator');
    const lbl = document.getElementById('auto-status-label');
    const ivl = document.getElementById('auto-status-interval');
    if (ind) { ind.className = 'auto-indicator ' + (enabled ? 'on' : 'off'); }
    if (lbl) { lbl.textContent = enabled ? 'Automation AKTIF' : 'Automation NONAKTIF'; }
    if (ivl) { ivl.textContent = intervalMinutes + ' menit'; }
  } catch (e) {
    st.textContent = '\u274c ' + e.message;
    st.className = 'bc-ch-status err';
  } finally {
    btn.disabled = false;
  }
}

async function testAutoBerita() {
  const st  = document.getElementById('auto-save-status');
  const btn = document.getElementById('auto-test-btn');
  btn.disabled = true;
  st.textContent = '\u23f3 Menjalankan test pengecekan berita...';
  st.className = 'bc-ch-status ok'; st.style.display = 'block';
  try {
    const res  = await fetch('/api/automation/berita-pemko/test', { method: 'POST' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal test');
    st.textContent = '\u2705 ' + (json.message || 'Test selesai.');
    st.className = 'bc-ch-status ok';
    // Refresh status box
    setTimeout(refreshAutoStatus, 2000);
  } catch (e) {
    st.textContent = '\u274c ' + e.message;
    st.className = 'bc-ch-status err';
  } finally {
    btn.disabled = false;
  }
}

async function refreshAutoStatus() {
  try {
    const res  = await fetch('/api/automation/berita-pemko');
    const json = await res.json();
    if (!json.ok) return;
    const d = json.config;
    const ind = document.getElementById('auto-indicator');
    const lbl = document.getElementById('auto-status-label');
    const ivl = document.getElementById('auto-status-interval');
    const chk = document.getElementById('auto-status-checked');
    const ttl = document.getElementById('auto-status-title');
    const aat = document.getElementById('auto-status-at');
    if (ind) ind.className = 'auto-indicator ' + (d.enabled ? 'on' : 'off');
    if (lbl) lbl.textContent = d.enabled ? 'Automation AKTIF' : 'Automation NONAKTIF';
    if (ivl) ivl.textContent = (d.intervalMinutes || 30) + ' menit';
    if (chk) chk.textContent = d.lastCheckedAt      || '\u2014';
    if (ttl) ttl.textContent = d.lastNewArticleTitle || '\u2014';
    if (aat) aat.textContent = d.lastNewArticleAt    || '\u2014';
  } catch { /* silent */ }
}

// Auto-refresh status box setiap 60 detik saat di section automation
setInterval(() => {
  if (document.getElementById('sec-automation') &&
      document.getElementById('sec-automation').style.display !== 'none') {
    refreshAutoStatus();
  }
}, 60_000);

// ─────────────────────────────────────────────────────────────────────────────

async function saveCuacaSchedule() {
  const st = document.getElementById('cuaca-status');
  const enabled = document.getElementById('cuaca-auto-enabled').checked;
  const channelJid = document.getElementById('cuaca-bc-target').value.trim();
  if (enabled && !channelJid) {
    st.textContent = '⚠️ Pilih saluran agar jadwal otomatis bisa jalan.';
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
    return;
  }
  try {
    const res = await fetch('/api/cuaca-medanjohor/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, channelJid })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal simpan');
    st.textContent = '✅ Jadwal prakiraan cuaca disimpan.';
    st.className = 'bc-ch-status ok';
    st.style.display = 'block';
  } catch (e) {
    st.textContent = '❌ ' + e.message;
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
  }
}

async function previewCuacaBmkg() {
  const st = document.getElementById('cuaca-status');
  const pre = document.getElementById('cuaca-preview');
  st.style.display = 'none';
  pre.style.display = 'block';
  pre.textContent = '⏳ Memuat data BMKG...';
  try {
    const res = await fetch('/api/cuaca-medanjohor/preview');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal');
    pre.textContent = json.text || '';
  } catch (e) {
    pre.textContent = 'Error: ' + e.message;
    pre.style.display = 'block';
  }
}

async function queueCuacaBmkgSekarang() {
  const st = document.getElementById('cuaca-status');
  const btn = document.getElementById('cuaca-queue-btn');
  const channelJid = document.getElementById('cuaca-bc-target').value.trim();
  if (!channelJid) {
    st.textContent = '⚠️ Pilih saluran tujuan.';
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
    return;
  }
  btn.disabled = true;
  st.style.display = 'block';
  st.className = 'bc-ch-status ok';
  st.textContent = '⏳ Mengambil BMKG & mengantre broadcast...';
  try {
    const res = await fetch('/api/cuaca-medanjohor/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelJid })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal');
    st.textContent = '✅ ' + (json.message || 'Diantrekan.');
    st.className = 'bc-ch-status ok';
    setTimeout(() => refreshBcHistory(), 2500);
  } catch (e) {
    st.textContent = '❌ ' + e.message;
    st.className = 'bc-ch-status err';
  } finally {
    btn.disabled = false;
  }
}

async function queueMedanBeritaHarian() {
  const target = document.getElementById('bc-target').value.trim();
  const st = document.getElementById('medan-berita-status');
  const btn = document.getElementById('medan-upload-btn');
  if (!target) {
    st.textContent = '⚠️ Pilih saluran tujuan di bagian \"Buat Broadcast Baru\" di atas.';
    st.className = 'bc-ch-status err';
    st.style.display = 'block';
    return;
  }
  const limit = parseInt(document.getElementById('medan-bc-count').value, 10) || 3;
  btn.disabled = true;
  st.style.display = 'block';
  st.className = 'bc-ch-status ok';
  st.textContent = '⏳ Mengunduh gambar & mengantre broadcast...';
  try {
    const res = await fetch('/api/medan-berita/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelJid: target, limit })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal');
    st.textContent = '✅ ' + (json.message || 'Berita diantrekan.');
    st.className = 'bc-ch-status ok';
    setTimeout(() => refreshBcHistory(), 2500);
  } catch (e) {
    st.textContent = '❌ ' + e.message;
    st.className = 'bc-ch-status err';
  } finally {
    btn.disabled = false;
  }
}

async function lookupChannelJid() {
  const inviteInput = document.getElementById('bc-invite-input');
  const jidInput    = document.getElementById('bc-jid-input');
  const nameInput   = document.getElementById('bc-name-input');
  const statusEl    = document.getElementById('bc-ch-status');
  const invite = inviteInput.value.trim();
  if (!invite) { inviteInput.focus(); return; }

  // Ekstrak kode dari URL invite atau pakai langsung jika sudah berupa kode (RegExp string: literal /.../ di dalam template HTML akan membuat \/ hilang di output)
  const match = invite.match(new RegExp('channel/([A-Za-z0-9_-]+)'));
  const code = match ? match[1] : invite;

  statusEl.textContent = '⏳ Mencari informasi saluran...';
  statusEl.className = 'bc-ch-status ok';

  try {
    const res  = await fetch('/api/newsletter/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code }),
    });
    const json = await res.json();
    if (json.ok && json.jid) {
      jidInput.value  = json.jid;
      nameInput.value = nameInput.value || json.name || '';
      statusEl.textContent = '✅ JID ditemukan! Silakan klik Tambah untuk mendaftarkan.';
      statusEl.className = 'bc-ch-status ok';
      inviteInput.value = '';
    } else {
      statusEl.textContent = '❌ ' + (json.error || 'Saluran tidak ditemukan. Pastikan link undangan benar.');
      statusEl.className = 'bc-ch-status err';
    }
  } catch(e) {
    statusEl.textContent = '❌ Error: ' + e.message;
    statusEl.className = 'bc-ch-status err';
  }
}

async function addBcChannel() {
  const jidInput  = document.getElementById('bc-jid-input');
  const nameInput = document.getElementById('bc-name-input');
  const statusEl  = document.getElementById('bc-ch-status');
  const jid  = jidInput.value.trim();
  const name = nameInput.value.trim();

  if (!jid) { jidInput.focus(); return; }
  if (!jid.includes('@')) {
    statusEl.textContent = '⚠️ JID harus mengandung @newsletter atau @g.us';
    statusEl.className = 'bc-ch-status err';
    return;
  }
  statusEl.className = 'bc-ch-status';
  statusEl.style.display = 'none';

  try {
    const res = await fetch('/api/broadcast/channel/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jid, name: name || jid })
    });
    const json = await res.json();
    if (json.ok) {
      statusEl.textContent = '✅ Saluran berhasil ditambahkan! Halaman akan direfresh...';
      statusEl.className = 'bc-ch-status ok';
      jidInput.value = ''; nameInput.value = '';
      setTimeout(() => location.reload(), 1400);
    } else {
      statusEl.textContent = '❌ ' + (json.error || 'Gagal');
      statusEl.className = 'bc-ch-status err';
    }
  } catch(e) {
    statusEl.textContent = '❌ Error: ' + e.message;
    statusEl.className = 'bc-ch-status err';
  }
}

async function deleteBcChannel(jid, name) {
  if (!confirm('Hapus saluran "' + name + '"?')) return;
  try {
    const res = await fetch('/api/broadcast/channel/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jid })
    });
    const json = await res.json();
    if (json.ok) location.reload();
    else alert('Gagal: ' + (json.error || ''));
  } catch(e) { alert('Error: ' + e.message); }
}

async function refreshBcHistory() {
  try {
    const res  = await fetch('/api/broadcast/history');
    const json = await res.json();
    if (!json.ok) return;
    const history  = json.history;
    const channels = json.channels;
    const STATUS_BC = { sent: '✅ Terkirim', pending: '⏳ Mengantre', failed: '❌ Gagal' };
    const fmtD = (iso) => { try { return new Date(iso).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch { return iso||'-'; } };

    const rows = history.length ? history.map(b => {
      const ch = channels.find(c => c.jid === b.channelJid);
      const chName = ch ? ch.name : (b.channelJid || '-');
      const badgeCls = b.status==='sent' ? 'bc-badge-sent' : b.status==='failed' ? 'bc-badge-failed' : 'bc-badge-pending';
      const mediaHtml = b.mediaFilename
        ? (b.mediaMime?.startsWith('video/')
            ? '<div class="bc-video-icon">🎬</div>'
            : '<img class="bc-thumb" src="/broadcast-media/' + esc(b.mediaFilename) + '" data-open-src="/broadcast-media/' + esc(b.mediaFilename) + '" alt="media">')
        : '<span class="text-muted fz12">—</span>';
      return '<tr class="bc-hist-item">'
        + '<td><span class="' + badgeCls + '">' + (STATUS_BC[b.status]||b.status) + '</span></td>'
        + '<td class="fz13 fw5">' + esc(chName) + '</td>'
        + '<td class="fz13 text-muted2" style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc((b.pesan||'').substring(0,60)) + ((b.pesan||'').length>60?'…':'') + '</td>'
        + '<td>' + mediaHtml + '</td>'
        + '<td class="fz12 text-muted2">' + fmtD(b.createdAt) + '</td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="5" class="empty-row">Belum ada riwayat broadcast</td></tr>';

    document.getElementById('bc-hist-tbody').innerHTML = rows;
    document.getElementById('bc-hist-count').textContent = history.length + ' broadcast';

    const opts = channels.map(c =>
      '<option value="' + esc(c.jid) + '">' + esc(c.name) + ' (' + c.jid.split('@')[0] + '…@' + (c.jid.split('@')[1]||'') + ')</option>'
    ).join('');
    const sel = document.getElementById('bc-target');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Pilih saluran —</option>' + opts;
    sel.value = cur;
  } catch(e) { console.error('refreshBcHistory error:', e); }
}
<\/script></body></html>`;
};

// ─── SSE CLIENTS & FILE WATCHER ───────────────────────────
const sseClients = new Set();

const broadcastUpdate = () => {
  const data = JSON.stringify({ laporan: getLaporan() });
  for (const client of sseClients) {
    try { client.write(`event: update\ndata: ${data}\n\n`); }
    catch { sseClients.delete(client); }
  }
};

const broadcastLivechat = () => {
  const data = JSON.stringify({ sessions: getLivechatSessions() });
  for (const client of sseClients) {
    try { client.write(`event: livechat\ndata: ${data}\n\n`); }
    catch { sseClients.delete(client); }
  }
};

const broadcastLivechatNew = (name, text) => {
  const data = JSON.stringify({ name, text });
  for (const client of sseClients) {
    try { client.write(`event: livechat_new\ndata: ${data}\n\n`); }
    catch { sseClients.delete(client); }
  }
};

const watchFile = path.join(__dirname, CONFIG.DATA_DIR, 'laporan_archive.json');
let watchDebounce = null;
const startWatcher = () => {
  if (!fs.existsSync(path.join(__dirname, CONFIG.DATA_DIR))) {
    fs.mkdirSync(path.join(__dirname, CONFIG.DATA_DIR), { recursive: true });
  }
  if (!fs.existsSync(watchFile)) {
    fs.writeFileSync(watchFile, JSON.stringify({ laporan: [] }), 'utf8');
  }
  fs.watch(watchFile, () => {
    clearTimeout(watchDebounce);
    watchDebounce = setTimeout(broadcastUpdate, 300);
  });

  // Watch livechat sessions file
  const lcFile = path.join(__dirname, CONFIG.DATA_DIR, 'livechat_sessions.json');
  if (!fs.existsSync(lcFile)) fs.writeFileSync(lcFile, JSON.stringify({ sessions: [] }), 'utf8');
  let lcDebounce = null;
  fs.watch(lcFile, () => {
    clearTimeout(lcDebounce);
    lcDebounce = setTimeout(broadcastLivechat, 150); // 150ms — sangat cepat
  });
  console.log(`  👁️  Memantau: ${watchFile}`);
};

const server = http.createServer(async (req, res) => {
  const url_  = new URL(req.url, 'http://localhost');
  const path_ = url_.pathname;
  const cookies = parseCookies(req);
  const authed  = validateSession(cookies.session);

  const send = (code, body, type='text/html; charset=utf-8', extra={}) => {
    res.writeHead(code, { 'Content-Type': type, ...extra });
    res.end(body);
  };

  if (path_ === '/login' && req.method === 'GET') return send(200, pageLogin());
  if (path_ === '/login' && req.method === 'POST') {
    const body = await parseBody(req);
    if (body.username === CONFIG.ADMIN_USERNAME && body.password === CONFIG.ADMIN_PASSWORD) {
      const token = createSession();
      return send(302, '', 'text/plain', {
        'Set-Cookie': `session=${token}; HttpOnly; Path=/; Max-Age=${CONFIG.SESSION_EXPIRE_HOURS*3600}`,
        'Location': '/'
      });
    }
    return send(200, pageLogin('Username atau password salah!'));
  }
  if (path_ === '/logout') {
    if (cookies.session) sessions.delete(cookies.session);
    return send(302, '', 'text/plain', { 'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0', 'Location': '/login' });
  }
  if (!authed) return send(302, '', 'text/plain', { 'Location': '/login' });

  // ── SSE endpoint ──
  if (path_ === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    const init = JSON.stringify({ laporan: getLaporan() });
    res.write(`event: update\ndata: ${init}\n\n`);
    const lcInit = JSON.stringify({ sessions: getLivechatSessions() });
    res.write(`event: livechat\ndata: ${lcInit}\n\n`);
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); }
      catch { clearInterval(heartbeat); sseClients.delete(res); }
    }, 25000);
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
    return;
  }

  if (path_ === '/') return send(200, pageDashboard(getLaporan(), getGroups(), getGroupRouting(), getKegiatan(), getBroadcastChannels(), getBroadcastHistory(30), getWeatherBroadcastConfig(), getBeritaPemkoAutoConfig()));
  if (path_ === '/api/laporan') return send(200, JSON.stringify(getLaporan()), 'application/json');

  // ── API: Tambah Grup ──
  if (path_ === '/api/group/add' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { groupId, groupName } = body;
      if (!groupId || !groupId.endsWith('@g.us')) {
        return send(400, JSON.stringify({ ok: false, error: 'Group ID tidak valid' }), 'application/json');
      }
      const added = addLaporanGroup(groupId, groupName || groupId);
      if (!added) {
        return send(200, JSON.stringify({ ok: false, error: 'Grup sudah terdaftar' }), 'application/json');
      }
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Hapus Grup ──
  if (path_ === '/api/group/delete' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { groupId } = body;
      if (!groupId) return send(400, JSON.stringify({ ok: false, error: 'groupId diperlukan' }), 'application/json');
      const removed = removeLaporanGroup(groupId);
      if (!removed) return send(404, JSON.stringify({ ok: false, error: 'Grup tidak ditemukan' }), 'application/json');
      // Hapus juga dari routing jika ada
      const routing = getGroupRouting();
      let changed = false;
      for (const [kat, gid] of Object.entries(routing)) {
        if (gid === groupId) { delete routing[kat]; changed = true; }
      }
      if (changed) setGroupRouting(routing);
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Simpan Routing ──
  if (path_ === '/api/group/routing' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { routing } = body;
      if (typeof routing !== 'object' || routing === null) {
        return send(400, JSON.stringify({ ok: false, error: 'Data routing tidak valid' }), 'application/json');
      }
      setGroupRouting(routing);
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Hapus Laporan ──
  if (path_ === '/api/laporan/delete' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { id } = body;
      if (!id) return send(400, JSON.stringify({ ok: false, error: 'id diperlukan' }), 'application/json');
      const deleted = deleteLaporan(id);
      if (!deleted) return send(404, JSON.stringify({ ok: false, error: 'Laporan tidak ditemukan' }), 'application/json');
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Update Status Laporan ──
  if (path_ === '/api/laporan/status' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { id, status, notify = true } = body;
      if (!id || !status) return send(400, JSON.stringify({ ok: false, error: 'id dan status diperlukan' }), 'application/json');
      const VALID = ['terkirim', 'diproses', 'selesai', 'ditolak'];
      if (!VALID.includes(status)) return send(400, JSON.stringify({ ok: false, error: 'Status tidak valid. Pilih: ' + VALID.join(', ') }), 'application/json');
      const updated = updateLaporanStatus(id, status);
      if (!updated) return send(404, JSON.stringify({ ok: false, error: 'Laporan tidak ditemukan' }), 'application/json');
      // Antrekan notifikasi WA ke pelapor jika diminta
      if (notify) {
        const lap = getLaporanById(id);
        if (lap?.pelapor) {
          queueStatusNotif({
            laporanId: id,
            pelapor: lap.pelapor,
            namaPelapor: lap.namaPelapor || 'Bapak/Ibu',
            kategori: lap.kategori || '-',
            kelurahan: lap.kelurahan || '-',
            statusBaru: status,
          });
        }
      }
      return send(200, JSON.stringify({ ok: true, status }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Tambah Kegiatan ──
  if (path_ === '/api/kegiatan/add' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { nama, tanggal, tempat, deskripsi } = body;
      if (!nama?.trim()) return send(400, JSON.stringify({ ok: false, error: 'Nama kegiatan wajib diisi' }), 'application/json');
      const kegiatan = addKegiatan({ nama: nama.trim(), tanggal: (tanggal||'').trim(), tempat: (tempat||'').trim(), deskripsi: (deskripsi||'').trim() });
      return send(200, JSON.stringify({ ok: true, kegiatan }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Hapus Kegiatan ──
  if (path_ === '/api/kegiatan/delete' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { id } = body;
      if (!id) return send(400, JSON.stringify({ ok: false, error: 'id diperlukan' }), 'application/json');
      const deleted = deleteKegiatan(id);
      if (!deleted) return send(404, JSON.stringify({ ok: false, error: 'Kegiatan tidak ditemukan' }), 'application/json');
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Kirim Feedback ke Pelapor ──
  if (path_ === '/api/feedback' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { laporanId, pelapor, namaPelapor, pesan, foto_base64, foto_mime } = body;

      if (!pelapor || !pesan?.trim()) {
        return send(400, JSON.stringify({ ok: false, error: 'Data tidak lengkap' }), 'application/json');
      }

      let fotoPath = null;
      if (foto_base64) {
        const ext = (foto_mime || 'image/jpeg').split('/')[1]?.replace('jpeg','jpg') || 'jpg';
        const fname = `feedback_${Date.now()}.${ext}`;
        const fpath = path.join(FOTO_FEEDBACK_DIR, fname);
        fs.writeFileSync(fpath, Buffer.from(foto_base64, 'base64'));
        fotoPath = fpath;
      }

      queueFeedback({ laporanId, pelapor, namaPelapor, pesan: pesan.trim(), fotoPath });

      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: LiveChat – Get sessions ──
  if (path_ === '/api/livechat/sessions') {
    return send(200, JSON.stringify(getLivechatSessions()), 'application/json');
  }

  // ── API: LiveChat – Admin reply ──
  if (path_ === '/api/livechat/reply' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { sessionId, text } = body;
      if (!sessionId || !text?.trim()) {
        return send(400, JSON.stringify({ ok: false, error: 'Data tidak lengkap' }), 'application/json');
      }
      const sessions = getLivechatSessions();
      const session  = sessions.find(s => s.id === sessionId);
      if (!session) return send(404, JSON.stringify({ ok: false, error: 'Sesi tidak ditemukan' }), 'application/json');
      if (session.status === 'closed') return send(400, JSON.stringify({ ok: false, error: 'Sesi sudah ditutup' }), 'application/json');

      // Simpan ke riwayat chat
      addLivechatMessage(session.jid, 'admin', text.trim());

      // Antrekan ke bot worker — near-instant (< 2 detik)
      queueLivechatReply({ jid: session.jid, text: text.trim() });

      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: LiveChat – Close session ──
  if (path_ === '/api/livechat/close' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { sessionId } = body;
      if (!sessionId) return send(400, JSON.stringify({ ok: false, error: 'sessionId diperlukan' }), 'application/json');

      const session = getLivechatSessions().find(s => s.id === sessionId);
      if (!session) return send(404, JSON.stringify({ ok: false, error: 'Sesi tidak ditemukan' }), 'application/json');

      closeLivechatSessionById(sessionId);

      // Kirim notifikasi ke user via bot worker
      queueLivechatReply({
        jid: session.jid,
        text: `✅ Sesi LiveChat Anda telah ditutup oleh admin.\n\nTerima kasih sudah menghubungi *Kecamatan Medan Johor*! 🙏\n\nKetik *menu* untuk kembali ke menu utama.`
      });

      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: LiveChat – Mark read ──
  if (path_ === '/api/livechat/read' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      markLivechatRead(body.sessionId);
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch { return send(500, JSON.stringify({ ok: false }), 'application/json'); }
  }

  // ── Export Auth Credentials (untuk Railway free plan) ──
  if (path_ === '/export-auth') {
    const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
    let encoded = '';
    let fileCount = 0;
    let errorMsg = '';

    if (!fs.existsSync(AUTH_DIR) || fs.readdirSync(AUTH_DIR).filter(f => fs.statSync(path.join(AUTH_DIR, f)).isFile()).length === 0) {
      errorMsg = 'Folder auth_info_baileys tidak ditemukan atau kosong. Pastikan bot sudah berhasil pairing terlebih dahulu.';
    } else {
      try {
        const files = {};
        for (const filename of fs.readdirSync(AUTH_DIR)) {
          const filePath = path.join(AUTH_DIR, filename);
          if (!fs.statSync(filePath).isFile()) continue;
          const content = fs.readFileSync(filePath, 'utf8');
          try { files[filename] = JSON.parse(content); }
          catch { files[filename] = content; }
          fileCount++;
        }
        encoded = Buffer.from(JSON.stringify(files)).toString('base64');
      } catch (e) {
        errorMsg = 'Gagal membaca credentials: ' + e.message;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Export Auth — Hallo Johor</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#040d1a;--card:#0e1e38;--border:#1a3356;--cyan:#00c8ff;--green:#00e5a0;--text:#e2eaf5;--muted:#4a6a8a;--red:#ff4d6d}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;padding:32px 16px}
.wrap{max-width:780px;margin:0 auto}
h1{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px;background:linear-gradient(135deg,#fff 30%,var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sub{font-size:13px;color:var(--muted);margin-bottom:28px}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px}
.card h2{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;margin-bottom:14px;color:var(--cyan)}
.badge{display:inline-block;background:rgba(0,229,160,.12);color:var(--green);border:1px solid rgba(0,229,160,.25);border-radius:8px;padding:4px 12px;font-size:12px;font-weight:500;margin-bottom:16px}
.err{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.25);color:#ff8fa3;border-radius:10px;padding:14px;font-size:14px}
textarea{width:100%;background:#060f22;border:1px solid var(--border);border-radius:10px;padding:14px;color:#6dd5ed;font-family:'Courier New',monospace;font-size:11px;line-height:1.5;resize:none;outline:none;height:160px;word-break:break-all}
.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;background:linear-gradient(135deg,#0090c8,var(--cyan));border:none;border-radius:10px;color:#040d1a;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .2s;text-decoration:none}
.btn:hover{opacity:.85}
.btn-back{background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'DM Sans',sans-serif;font-size:13px;margin-right:10px}
.steps{list-style:none;counter-reset:step}
.steps li{counter-increment:step;display:flex;gap:12px;margin-bottom:12px;font-size:13px;color:var(--text)}
.steps li::before{content:counter(step);min-width:24px;height:24px;background:rgba(0,200,255,.15);border:1px solid rgba(0,200,255,.3);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--cyan);flex-shrink:0;margin-top:1px}
.steps li code{background:#0d1f3c;padding:1px 7px;border-radius:5px;font-size:12px;color:var(--cyan)}
.warn{font-size:12px;color:var(--muted);margin-top:14px;padding:12px;background:rgba(255,200,0,.06);border:1px solid rgba(255,200,0,.15);border-radius:8px;line-height:1.6}
</style></head><body>
<div class="wrap">
  <div style="margin-bottom:20px"><a href="/" class="btn btn-back">← Kembali ke Dashboard</a></div>
  <h1>🔑 Export Auth Credentials</h1>
  <p class="sub">Untuk Railway free plan — salin string ini ke Variables agar bot tidak perlu pairing ulang saat redeploy.</p>

  ${errorMsg ? `<div class="card"><div class="err">⚠️ ${esc(errorMsg)}</div></div>` : `
  <div class="card">
    <h2>📦 AUTH_CREDS</h2>
    <div class="badge">✓ ${fileCount} file credentials terbaca</div>
    <textarea id="credsBox" readonly>${encoded}</textarea>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" onclick="copyIt()">📋 Salin AUTH_CREDS</button>
      <span id="copyMsg" style="display:none;align-self:center;font-size:13px;color:var(--green)">✓ Tersalin!</span>
    </div>
    <div class="warn">
      ⚠️ <strong>Jangan bagikan string ini ke siapapun</strong> — berisi kunci akses WhatsApp bot kamu.<br>
      Jangan commit ke GitHub. Simpan hanya di Railway Variables.
    </div>
  </div>

  <div class="card">
    <h2>📋 Cara Pakai</h2>
    <ol class="steps">
      <li>Klik tombol <strong>Salin AUTH_CREDS</strong> di atas</li>
      <li>Buka <strong>Railway Dashboard</strong> → pilih service bot</li>
      <li>Klik tab <strong>Variables</strong> → <strong>+ New Variable</strong></li>
      <li>Isi Name: <code>AUTH_CREDS</code> · Value: paste string yang disalin</li>
      <li>Klik <strong>Save</strong> → Railway akan otomatis redeploy</li>
      <li>Bot langsung terhubung tanpa perlu pairing ulang ✅</li>
    </ol>
  </div>
  `}
</div>
<script>
function copyIt() {
  const box = document.getElementById('credsBox');
  box.select();
  box.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(box.value).then(() => {
    const msg = document.getElementById('copyMsg');
    msg.style.display = 'inline';
    setTimeout(() => msg.style.display = 'none', 2500);
  });
}
</script>
</body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // ── Export Excel ──
  if (path_ === '/export/excel') {
    const laporanData = getLaporan();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hallo Johor Bot';
    wb.created = new Date();

    const ws = wb.addWorksheet('Laporan Pengaduan', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
    });

    // ── Header row ──
    ws.columns = [
      { key: 'no',        width: 12  },
      { key: 'tanggal',   width: 24  },
      { key: 'pelapor',   width: 22  },
      { key: 'nowa',      width: 18  },
      { key: 'kategori',  width: 22  },
      { key: 'kelurahan', width: 20  },
      { key: 'uraian',    width: 42  },
      { key: 'alamat',    width: 42  },
      { key: 'maps',      width: 38  },
      { key: 'foto',      width: 22  },
    ];

    const HEADER_LABELS = [
      'No. Laporan', 'Tanggal', 'Pelapor', 'No. WA',
      'Kategori', 'Kelurahan', 'Uraian', 'Alamat', 'Google Maps', 'Foto Bukti'
    ];

    const HEADER_COLORS = [
      '1E3A5F','1E3A5F','1E3A5F','1E3A5F',
      '2D1B69','1A4731','1A3A4F','1A3A4F','1A3A4F','2D3748'
    ];

    const headerRow = ws.addRow(HEADER_LABELS);
    headerRow.height = 32;
    headerRow.eachCell((cell, colNum) => {
      cell.fill   = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF' + HEADER_COLORS[colNum-1] } };
      cell.font   = { bold:true, color:{ argb:'FFFFFFFF' }, size:11, name:'Arial' };
      cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
      cell.border = {
        top:   { style:'thin', color:{ argb:'FF2A4A7F' } },
        left:  { style:'thin', color:{ argb:'FF2A4A7F' } },
        bottom:{ style:'thin', color:{ argb:'FF2A4A7F' } },
        right: { style:'thin', color:{ argb:'FF2A4A7F' } },
      };
    });

    // Freeze header row
    ws.views = [{ state:'frozen', ySplit:1, activeCell:'A2' }];

    // ── Data rows ──
    const IMG_ROW_HEIGHT = 110;
    const FOTO_COL = 10; // column J (1-indexed)

    for (let i = 0; i < laporanData.length; i++) {
      const l = laporanData[i];
      const hasFoto = !!l.fotoPath;
      const lat = l.koordinat?.lat || l.koordinat?.latitude || '';
      const lon = l.koordinat?.lon || l.koordinat?.longitude || '';
      const mapsUrl = lat && lon ? `https://maps.google.com/?q=${lat},${lon}` : '';
      const tanggalFormatted = l.tanggal
        ? new Date(l.tanggal).toLocaleString('id-ID', { timeZone:'Asia/Jakarta', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : '-';

      const rowValues = [
        `#${String(l.id||0).padStart(4,'0')}`,
        tanggalFormatted,
        l.namaPelapor || '-',
        (l.pelapor||'').replace('@s.whatsapp.net','') || '-',
        l.kategori || '-',
        l.kelurahan || '-',
        l.isi || '-',
        l.alamat || '-',
        mapsUrl,
        hasFoto ? '' : '(Tidak ada foto)',
      ];

      const row = ws.addRow(rowValues);
      row.height = hasFoto ? IMG_ROW_HEIGHT : 20;

      // Maps URL as hyperlink
      if (mapsUrl) {
        const mapsCell = row.getCell(9);
        mapsCell.value = { text: 'Buka Google Maps', hyperlink: mapsUrl };
        mapsCell.font  = { color:{ argb:'FF0070C0' }, underline:true, name:'Arial', size:10 };
      }

      // Zebra stripe
      const bgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FA';
      row.eachCell({ includeEmpty:true }, (cell, colNum) => {
        if (colNum === 9 && mapsUrl) return; // skip hyperlink cell
        cell.font      = cell.font || {};
        cell.font.name = 'Arial';
        cell.font.size = 10;
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: bgColor } };
        cell.alignment = { vertical:'middle', wrapText:true, ...(colNum===1 ? {horizontal:'center'} : {}) };
        cell.border = {
          top:   { style:'hair', color:{ argb:'FFD0D8E4' } },
          left:  { style:'hair', color:{ argb:'FFD0D8E4' } },
          bottom:{ style:'hair', color:{ argb:'FFD0D8E4' } },
          right: { style:'hair', color:{ argb:'FFD0D8E4' } },
        };
      });

      // ── Embed foto ──
      if (hasFoto) {
        const fotoFilename = path.basename(l.fotoPath);
        const fotoFullPath = path.join(__dirname, CONFIG.DATA_DIR, 'foto', fotoFilename);
        if (fs.existsSync(fotoFullPath)) {
          try {
            const ext = fotoFilename.split('.').pop().toLowerCase();
            const imageId = wb.addImage({
              filename: fotoFullPath,
              extension: ext === 'png' ? 'png' : 'jpeg',
            });
            const excelRow = i + 2; // +1 header, +1 because 1-indexed
            ws.addImage(imageId, {
              tl: { col: FOTO_COL - 1, row: excelRow - 1 },       // top-left (0-indexed)
              br: { col: FOTO_COL,     row: excelRow },            // bottom-right (0-indexed)
              editAs: 'oneCell',
            });
          } catch (imgErr) {
            row.getCell(FOTO_COL).value = '(Foto gagal dimuat)';
          }
        } else {
          row.getCell(FOTO_COL).value = '(File foto tidak ditemukan)';
        }
      }
    }

    // ── Summary sheet ──
    const ws2 = wb.addWorksheet('Ringkasan');
    ws2.columns = [
      { key:'label', width:30 },
      { key:'value', width:20 },
    ];

    const nowID = new Date().toLocaleString('id-ID', { timeZone:'Asia/Jakarta', dateStyle:'full', timeStyle:'short' });
    const summaryData = [
      ['RINGKASAN LAPORAN HALLO JOHOR', ''],
      ['Diekspor pada', nowID],
      ['', ''],
      ['Total Laporan', laporanData.length],
    ];

    // Kategori count
    const katCount = {};
    laporanData.forEach(l => { katCount[l.kategori||'Lainnya'] = (katCount[l.kategori||'Lainnya']||0)+1; });
    summaryData.push(['', '']);
    summaryData.push(['REKAPITULASI PER KATEGORI', '']);
    Object.entries(katCount).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => summaryData.push([k, v]));

    const kelCount = {};
    laporanData.forEach(l => { kelCount[l.kelurahan||'Lainnya'] = (kelCount[l.kelurahan||'Lainnya']||0)+1; });
    summaryData.push(['', '']);
    summaryData.push(['REKAPITULASI PER KELURAHAN', '']);
    Object.entries(kelCount).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => summaryData.push([k, v]));

    summaryData.forEach((rowData, idx) => {
      const r = ws2.addRow(rowData);
      r.getCell(1).font = { name:'Arial', size: idx===0||rowData[0].startsWith('REKAP') ? 12 : 10, bold: idx===0||rowData[0].startsWith('REKAP') };
      if (typeof rowData[1] === 'number') {
        r.getCell(2).font   = { name:'Arial', size:10, bold:true, color:{argb:'FF1A4731'} };
        r.getCell(2).alignment = { horizontal:'center' };
      }
    });

    // ── Send file ──
    const filename = `Laporan_HalloJohor_${new Date().toISOString().slice(0,10)}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return res.end(Buffer.from(buffer));
  }

  // ── Serve foto bukti laporan ──
  if (path_.startsWith('/foto/')) {
    const filename = path_.replace('/foto/', '').replace(/[^a-zA-Z0-9._-]/g, '');
    if (!filename) return send(400, 'Bad Request', 'text/plain');
    const fotoFile = path.join(__dirname, CONFIG.DATA_DIR, 'foto', filename);
    if (!fs.existsSync(fotoFile)) return send(404, 'Foto tidak ditemukan', 'text/plain');
    const ext = filename.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const fileBuffer = fs.readFileSync(fotoFile);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
    return res.end(fileBuffer);
  }

  // ── Serve foto livechat ──
  if (path_.startsWith('/foto-livechat/')) {
    const filename = path_.replace('/foto-livechat/', '').replace(/[^a-zA-Z0-9._-]/g, '');
    if (!filename) return send(400, 'Bad Request', 'text/plain');
    const fotoFile = path.join(__dirname, CONFIG.DATA_DIR, 'foto_livechat', filename);
    if (!fs.existsSync(fotoFile)) return send(404, 'Foto tidak ditemukan', 'text/plain');
    const ext = filename.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const fileBuffer = fs.readFileSync(fotoFile);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
    return res.end(fileBuffer);
  }

  // ── Serve broadcast media ──
  if (path_.startsWith('/broadcast-media/')) {
    const filename = path_.replace('/broadcast-media/', '').replace(/[^a-zA-Z0-9._-]/g, '');
    if (!filename) return send(400, 'Bad Request', 'text/plain');
    const mediaFile = path.join(BROADCAST_MEDIA_DIR, filename);
    if (!fs.existsSync(mediaFile)) return send(404, 'Media tidak ditemukan', 'text/plain');
    const ext = filename.split('.').pop().toLowerCase();
    const mimeMap = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', mp4:'video/mp4', mov:'video/quicktime', webm:'video/webm' };
    const mediaMime = mimeMap[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(mediaFile);
    res.writeHead(200, { 'Content-Type': mediaMime, 'Cache-Control': 'public, max-age=86400' });
    return res.end(fileBuffer);
  }

  // ── API: Newsletter – Lookup JID dari invite code ──
  // Karena web.js tidak punya akses ke sock Baileys, kita tulis request ke file
  // lalu bot worker membaca & menulis hasilnya. Polling max 8 detik.
  if (path_ === '/api/newsletter/lookup' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { inviteCode } = body;
      if (!inviteCode) return send(400, JSON.stringify({ ok: false, error: 'inviteCode diperlukan' }), 'application/json');

      // Sanitasi kode: hanya ambil bagian alfanumerik dari URL
      const code = inviteCode.replace(/^.*channel\//i, '').replace(/[^A-Za-z0-9_-]/g, '');
      if (!code) return send(400, JSON.stringify({ ok: false, error: 'Format invite tidak valid' }), 'application/json');

      const reqFile = path.join(__dirname, CONFIG.DATA_DIR, 'newsletter_lookup_req.json');
      const resFile = path.join(__dirname, CONFIG.DATA_DIR, 'newsletter_lookup_res.json');

      // Hapus hasil lama, tulis request baru
      if (fs.existsSync(resFile)) fs.unlinkSync(resFile);
      fs.writeFileSync(reqFile, JSON.stringify({ code, requestedAt: Date.now() }), 'utf8');

      // Poll tunggu hasil dari bot (max 8 detik)
      const timeout = Date.now() + 8000;
      while (Date.now() < timeout) {
        await new Promise(r => setTimeout(r, 400));
        if (fs.existsSync(resFile)) {
          try {
            const result = JSON.parse(fs.readFileSync(resFile, 'utf8'));
            fs.unlinkSync(resFile);
            return send(200, JSON.stringify(result), 'application/json');
          } catch {}
        }
      }
      return send(200, JSON.stringify({ ok: false, error: 'Bot tidak merespons. Pastikan bot sedang berjalan dan terhubung ke WhatsApp.' }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Broadcast – Kirim ──
  if (path_ === '/api/broadcast' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { channelJid, pesan, media_base64, media_mime, media_filename } = body;

      if (!channelJid) return send(400, JSON.stringify({ ok: false, error: 'channelJid diperlukan' }), 'application/json');
      if (!pesan?.trim() && !media_base64) return send(400, JSON.stringify({ ok: false, error: 'Pesan atau media diperlukan' }), 'application/json');

      let mediaFilename = null;
      if (media_base64) {
        const ext = (media_mime || 'image/jpeg').split('/')[1]?.replace('quicktime', 'mov') || 'jpg';
        const safeExt = ext.replace(/[^a-z0-9]/gi, '').substring(0, 8);
        mediaFilename = `bc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${safeExt}`;
        const mediaPath = path.join(BROADCAST_MEDIA_DIR, mediaFilename);
        fs.writeFileSync(mediaPath, Buffer.from(media_base64, 'base64'));
      }

      const entry = queueBroadcast({
        channelJid,
        pesan: (pesan || '').trim(),
        mediaFilename,
        mediaMime: media_mime || null,
      });

      return send(200, JSON.stringify({ ok: true, id: entry.id }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Broadcast – Tambah Saluran ──
  if (path_ === '/api/broadcast/channel/add' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { jid, name } = body;
      if (!jid || !jid.includes('@')) return send(400, JSON.stringify({ ok: false, error: 'JID tidak valid' }), 'application/json');
      const added = addBroadcastChannel(jid, name || jid);
      if (!added) return send(200, JSON.stringify({ ok: false, error: 'Saluran sudah terdaftar' }), 'application/json');
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Broadcast – Hapus Saluran ──
  if (path_ === '/api/broadcast/channel/delete' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { jid } = body;
      if (!jid) return send(400, JSON.stringify({ ok: false, error: 'jid diperlukan' }), 'application/json');
      const removed = removeBroadcastChannel(jid);
      if (!removed) return send(404, JSON.stringify({ ok: false, error: 'Saluran tidak ditemukan' }), 'application/json');
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Broadcast – History & Channels (untuk refresh) ──
  if (path_ === '/api/broadcast/history' && req.method === 'GET') {
    try {
      return send(200, JSON.stringify({
        ok: true,
        history: getBroadcastHistory(30),
        channels: getBroadcastChannels(),
      }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Berita Pemko Medan (portal.medan.go.id/berita) ──
  if (path_ === '/api/cuaca-medanjohor/preview' && req.method === 'GET') {
    try {
      const data = await scrapeMedanJohorCuacaHariIni();
      const text = formatCuacaWhatsApp(data);
      return send(200, JSON.stringify({ ok: true, data, text }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  if (path_ === '/api/cuaca-medanjohor/schedule' && req.method === 'GET') {
    try {
      return send(200, JSON.stringify({ ok: true, ...getWeatherBroadcastConfig() }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  if (path_ === '/api/cuaca-medanjohor/schedule' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      setWeatherBroadcastConfig({
        enabled: !!body.enabled,
        channelJid: (body.channelJid || '').trim(),
      });
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  if (path_ === '/api/cuaca-medanjohor/queue' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const channelJid = (body.channelJid || '').trim();
      if (!channelJid) return send(400, JSON.stringify({ ok: false, error: 'channelJid diperlukan' }), 'application/json');
      const data = await scrapeMedanJohorCuacaHariIni();
      const pesan = formatCuacaWhatsApp(data);
      queueBroadcast({ channelJid, pesan: pesan.trim() });
      return send(200, JSON.stringify({ ok: true, message: 'Prakiraan cuaca diantrekan. Bot akan mengirim sebentar lagi.' }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Automation Berita Pemko Medan ──────────────────────────────────

  if (path_ === '/api/automation/berita-pemko' && req.method === 'GET') {
    try {
      const config = getBeritaPemkoAutoConfig();
      return send(200, JSON.stringify({ ok: true, config }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  if (path_ === '/api/automation/berita-pemko' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      setBeritaPemkoAutoConfig({
        enabled:         body.enabled,
        modePing:        body.modePing,
        modeBroadcast:   body.modeBroadcast,
        pingNumbers:     body.pingNumbers,
        channelJid:      body.channelJid,
        intervalMinutes: body.intervalMinutes,
      });
      return send(200, JSON.stringify({ ok: true, message: 'Konfigurasi automation disimpan.' }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  if (path_ === '/api/automation/berita-pemko/test' && req.method === 'POST') {
    try {
      const cfg = getBeritaPemkoAutoConfig();
      const articles = await scrapePemkoBeritaArticles(3);
      if (!articles.length) {
        return send(200, JSON.stringify({ ok: true, message: 'Scrape OK tapi tidak ada artikel ditemukan di portal.' }), 'application/json');
      }
      const latest = articles[0];
      const isNew = !cfg.lastSeenUrl || cfg.lastSeenUrl !== latest.articleUrl;
      const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      updateBeritaPemkoAutoState({ lastCheckedAt: nowStr });
      return send(200, JSON.stringify({
        ok: true,
        message: isNew
          ? 'Scrape berhasil. Artikel terbaru: "' + latest.title.slice(0, 60) + '..." (belum pernah dikirim — akan diproses saat automation berjalan).'
          : 'Scrape berhasil. Artikel terbaru sudah pernah dikirim sebelumnya ("' + latest.title.slice(0, 50) + '..."). Tidak ada berita baru.',
        isNew,
        latestTitle: latest.title,
        latestUrl:   latest.articleUrl,
        lastSeenUrl: cfg.lastSeenUrl || null,
      }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Pemko Medan Berita ──────────────────────────────────────────────

  if (path_ === '/api/pemko-berita' && req.method === 'GET') {
    try {
      const limit = Math.min(10, Math.max(1, parseInt(url_.searchParams.get('limit') || '5', 10)));
      const items = await scrapePemkoBeritaArticles(limit);
      return send(200, JSON.stringify({ ok: true, items }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  if (path_ === '/api/pemko-berita/send-selected' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const channelJid = (body.channelJid || '').trim();
      const indices = Array.isArray(body.indices) ? body.indices.map(i => parseInt(i, 10)) : [];
      if (!channelJid) {
        return send(400, JSON.stringify({ ok: false, error: 'channelJid diperlukan' }), 'application/json');
      }
      if (!indices.length) {
        return send(400, JSON.stringify({ ok: false, error: 'Pilih minimal 1 berita' }), 'application/json');
      }
      const limit = Math.max(...indices) + 5;
      const articles = await scrapePemkoBeritaArticles(limit);
      if (!articles.length) {
        return send(400, JSON.stringify({ ok: false, error: 'Tidak ada berita di portal Pemko Medan' }), 'application/json');
      }
      const ids = [];
      const t0 = Date.now();
      for (const idx of indices) {
        if (idx < 0 || idx >= articles.length) continue;
        const art = articles[idx];
        let mediaFilename = null;
        let mediaMime = null;
        try {
          const { buffer, mime } = await downloadPemkoImageBuffer(art.imageUrl);
          mediaMime = mime;
          const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
          mediaFilename = `bc_pemko_${t0}_${idx}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
          fs.writeFileSync(path.join(BROADCAST_MEDIA_DIR, mediaFilename), buffer);
        } catch {
          mediaFilename = null;
          mediaMime = null;
        }
        const pesan = `*${art.title}*\n\n${art.description}\n\n🏛️ Pemko Medan\n${art.articleUrl}`;
        const entry = queueBroadcast({ channelJid, pesan, mediaFilename, mediaMime });
        ids.push(entry.id);
      }
      return send(200, JSON.stringify({
        ok: true,
        message: `${ids.length} berita Pemko Medan diantrekan. Bot akan mengirim bergiliran.`,
        queued: ids.length,
        ids,
      }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  // ── API: Kecamatan Medan Johor Berita ────────────────────────────────────

  if (path_ === '/api/medan-berita' && req.method === 'GET') {
    try {
      const limit = Math.min(10, Math.max(1, parseInt(url_.searchParams.get('limit') || '5', 10)));
      const items = await scrapeMedanBeritaArticles(limit);
      return send(200, JSON.stringify({ ok: true, items }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  if (path_ === '/api/medan-berita/send-selected' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const channelJid = (body.channelJid || '').trim();
      const indices = Array.isArray(body.indices) ? body.indices.map(i => parseInt(i, 10)) : [];
      if (!channelJid) {
        return send(400, JSON.stringify({ ok: false, error: 'channelJid diperlukan' }), 'application/json');
      }
      if (!indices.length) {
        return send(400, JSON.stringify({ ok: false, error: 'Pilih minimal 1 berita' }), 'application/json');
      }
      const limit = Math.max(...indices) + 5;
      const articles = await scrapeMedanBeritaArticles(limit);
      if (!articles.length) {
        return send(400, JSON.stringify({ ok: false, error: 'Tidak ada berita di halaman portal' }), 'application/json');
      }
      const ids = [];
      const t0 = Date.now();
      for (const idx of indices) {
        if (idx < 0 || idx >= articles.length) continue;
        const art = articles[idx];
        let mediaFilename = null;
        let mediaMime = null;
        try {
          const { buffer, mime } = await downloadImageBuffer(art.imageUrl);
          mediaMime = mime;
          const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
          mediaFilename = `bc_medan_${t0}_${idx}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
          fs.writeFileSync(path.join(BROADCAST_MEDIA_DIR, mediaFilename), buffer);
        } catch {
          mediaFilename = null;
          mediaMime = null;
        }
        const pesan = `*${art.title}*\n\n${art.description}\n\n📰 Kecamatan Medan Johor\n${art.articleUrl}`;
        const entry = queueBroadcast({
          channelJid,
          pesan,
          mediaFilename,
          mediaMime,
        });
        ids.push(entry.id);
      }
      return send(200, JSON.stringify({
        ok: true,
        message: `${ids.length} berita dipilih dan diantrekan. Bot akan mengirim bergiliran (±2,5 detik antar pesan).`,
        queued: ids.length,
        ids,
      }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }

  if (path_ === '/api/medan-berita/queue' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const channelJid = (body.channelJid || '').trim();
      const limit = Math.min(10, Math.max(1, parseInt(body.limit ?? 3, 10)));
      if (!channelJid) {
        return send(400, JSON.stringify({ ok: false, error: 'channelJid diperlukan' }), 'application/json');
      }
      const articles = await scrapeMedanBeritaArticles(limit);
      if (!articles.length) {
        return send(400, JSON.stringify({ ok: false, error: 'Tidak ada berita di halaman portal' }), 'application/json');
      }
      const ids = [];
      const t0 = Date.now();
      for (let i = 0; i < articles.length; i++) {
        const art = articles[i];
        let mediaFilename = null;
        let mediaMime = null;
        try {
          const { buffer, mime } = await downloadImageBuffer(art.imageUrl);
          mediaMime = mime;
          const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
          mediaFilename = `bc_medan_${t0}_${i}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
          fs.writeFileSync(path.join(BROADCAST_MEDIA_DIR, mediaFilename), buffer);
        } catch {
          mediaFilename = null;
          mediaMime = null;
        }
        const pesan = `*${art.title}*\n\n${art.description}\n\n📰 Kecamatan Medan Johor\n${art.articleUrl}`;
        const entry = queueBroadcast({
          channelJid,
          pesan,
          mediaFilename,
          mediaMime,
        });
        ids.push(entry.id);
      }
      return send(200, JSON.stringify({
        ok: true,
        message: `${ids.length} broadcast berita diantrekan. Bot akan mengirim bergiliran (±2,5 detik antar pesan).`,
        queued: ids.length,
        ids,
      }), 'application/json');
    } catch (err) {
      return send(500, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  }


  return send(404, '404 Not Found', 'text/plain');
});

server.listen(CONFIG.PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  🌐  Dashboard Hallo Johor               ║`);
  console.log(`║  ✅  Berjalan di http://localhost:${CONFIG.PORT}   ║`);
  console.log(`║  👤  Username : ${CONFIG.ADMIN_USERNAME.padEnd(24)}║`);
  console.log(`║  🔑  Password : ${CONFIG.ADMIN_PASSWORD.padEnd(24)}║`);
  console.log(`║  📡  SSE      : Real-time aktif          ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
  console.log(`  Ubah password:`);
  console.log(`  ADMIN_USER=admin ADMIN_PASS=passwordbaru node web.js\n`);
  startWatcher();
});
