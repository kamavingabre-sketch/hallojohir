// ╔══════════════════════════════════════════════════════════╗
// ║     WhatsApp Bot - Layanan Kecamatan Medan Johor         ║
// ║     Powered by Baileys + Node.js                         ║
// ║     Author: Bot Pelayanan Digital                        ║
// ╚══════════════════════════════════════════════════════════╝

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { handleMessage } from './handler.js';
import { getPendingFeedbacks, markFeedbackDone, getPendingLivechatReplies, markLivechatReplyDone, addLivechatMessage, closeLivechatSession, getPendingStatusNotifs, markStatusNotifDone, getPendingBroadcasts, markBroadcastDone, queueBroadcast, getWeatherBroadcastConfig, markWeatherBroadcastSent, getAutomationConfig, getLastProcessedBerita, setLastProcessedBerita, addAutomationHistory } from './store.js';
import { scrapeMedanJohorCuacaHariIni, formatCuacaWhatsApp } from './bmkg-cuaca.js';
import { scrapePemkoBeritaArticles } from './medan-berita-pemko.js';
import logger from './logger.js';

// ─── Configuration ────────────────────────────────────────
const CONFIG = {
  AUTH_DIR: './auth_info_baileys',
  RECONNECT_DELAY: 5000,
  PAIRING_TIMEOUT: 120,
  MAX_RECONNECT_ATTEMPTS: 10,
};

// Silent pino logger (supaya tidak flood console)
const pinoLogger = pino({ level: 'silent' });

// ─── Readline Helper ──────────────────────────────────────
const question = (prompt) => {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

// ─── Delay ───────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Track Reconnect ─────────────────────────────────────
let reconnectCount = 0;

// ─── Restore Auth dari Environment Variable ───────────────
// Dipakai untuk Railway free plan (tanpa persistent volume).
// Set env var AUTH_CREDS dengan output dari script export-auth.js
function restoreAuthFromEnv() {
  const encoded = process.env.AUTH_CREDS;
  if (!encoded) return;
  try {
    const files = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (!fs.existsSync(CONFIG.AUTH_DIR)) {
      fs.mkdirSync(CONFIG.AUTH_DIR, { recursive: true });
    }
    for (const [filename, content] of Object.entries(files)) {
      fs.writeFileSync(
        `${CONFIG.AUTH_DIR}/${filename}`,
        typeof content === 'string' ? content : JSON.stringify(content),
        'utf8'
      );
    }
    logger.info('AUTH', '🔑 Credentials dipulihkan dari AUTH_CREDS env var');
  } catch (err) {
    logger.warn('AUTH', 'Gagal memulihkan AUTH_CREDS', err.message);
  }
}

// ─── Feedback Worker ──────────────────────────────────────
// Poll feedback_queue.json setiap 5 detik, kirim WA ke pelapor
let feedbackInterval = null;
let livechatReplyInterval = null;
let statusNotifInterval = null;
let broadcastInterval = null;

function startFeedbackWorker(sock) {
  // Bersihkan interval lama jika ada (reconnect)
  if (feedbackInterval) clearInterval(feedbackInterval);

  feedbackInterval = setInterval(async () => {
    let pending;
    try { pending = getPendingFeedbacks(); }
    catch { return; }

    for (const fb of pending) {
      try {
        const jid = fb.pelapor.includes('@') ? fb.pelapor : `${fb.pelapor}@s.whatsapp.net`;
        const noLaporan = String(fb.laporanId || '').padStart(4, '0');

        const headerText =
          `✅ *Pembaruan Laporan #${noLaporan}*\n` +
          `Halo ${fb.namaPelapor || 'Bapak/Ibu'}, berikut tanggapan dari *Kecamatan Medan Johor*:\n\n` +
          `${fb.pesan}\n\n` +
          `_Terima kasih telah menggunakan layanan Hallo Johor_ 🏙️`;

        if (fb.fotoPath && fs.existsSync(fb.fotoPath)) {
          // Kirim pesan dengan foto
          const imgBuffer = fs.readFileSync(fb.fotoPath);
          await sock.sendMessage(jid, {
            image: imgBuffer,
            caption: headerText,
            mimetype: 'image/jpeg',
          });
        } else {
          // Kirim teks saja
          await sock.sendMessage(jid, { text: headerText });
        }

        markFeedbackDone(fb.id, 'done');
        logger.success('FEEDBACK', `Balasan terkirim ke ${jid}`, `Laporan #${noLaporan}`);

      } catch (err) {
        markFeedbackDone(fb.id, 'failed');
        logger.error('FEEDBACK', `Gagal kirim balasan ke ${fb.pelapor}`, err.message);
      }

      // Delay antar pesan agar tidak spam
      await delay(1500);
    }
  }, 5000);

  logger.info('FEEDBACK', '📬 Feedback worker aktif (poll setiap 5 detik)');
}

// ─── Status Notif Worker ───────────────────────────────────
// Poll status_notif_queue.json setiap 5 detik
// Kirim notifikasi WA otomatis ke pelapor saat admin ubah status
function startStatusNotifWorker(sock) {
  if (statusNotifInterval) clearInterval(statusNotifInterval);

  statusNotifInterval = setInterval(async () => {
    let pending;
    try { pending = getPendingStatusNotifs(); }
    catch { return; }

    for (const notif of pending) {
      try {
        const jid = notif.pelapor.includes('@') ? notif.pelapor : `${notif.pelapor}@s.whatsapp.net`;
        const noLaporan = String(notif.laporanId || '').padStart(4, '0');

        const STATUS_TEXT = {
          terkirim: '📨 *Terkirim* — laporan Anda telah diterima dan sedang menunggu tindak lanjut.',
          diproses: '⚙️ *Sedang Diproses* — petugas sedang menangani laporan Anda.',
          selesai:  '✅ *Selesai* — laporan Anda telah selesai ditindaklanjuti.',
          ditolak:  '❌ *Ditolak* — laporan Anda tidak dapat diproses.',
        };

        const statusText = STATUS_TEXT[notif.statusBaru] || `📌 *${notif.statusBaru}*`;

        const text =
          `📋 *PEMBARUAN STATUS LAPORAN*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Halo ${notif.namaPelapor || 'Bapak/Ibu'}, status laporan Anda telah diperbarui:\n\n` +
          `📋 *No. Laporan:* #${noLaporan}\n` +
          `🗂 *Kategori:* ${notif.kategori}\n` +
          `🏘️ *Kelurahan:* ${notif.kelurahan}\n\n` +
          `🔄 *Status Terbaru:*\n${statusText}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Ketik *10* untuk melihat semua laporan Anda.\n` +
          `_Hallo Johor — Kecamatan Medan Johor_ 🏙️`;

        await sock.sendMessage(jid, { text });
        markStatusNotifDone(notif.id, 'done');
        logger.success('STATUS', `Notifikasi terkirim ke ${jid}`, `Laporan #${noLaporan} → ${notif.statusBaru}`);

      } catch (err) {
        markStatusNotifDone(notif.id, 'failed');
        logger.error('STATUS', `Gagal kirim notifikasi ke ${notif.pelapor}`, err.message);
      }

      await delay(1500);
    }
  }, 5000);

  logger.info('STATUS', '🔔 Status notif worker aktif (poll setiap 5 detik)');
}

// ─── LiveChat Reply Worker ─────────────────────────────────
// Poll livechat_replies.json setiap 2 detik — near-instant delivery
function startLivechatReplyWorker(sock) {
  if (livechatReplyInterval) clearInterval(livechatReplyInterval);

  livechatReplyInterval = setInterval(async () => {
    let pending;
    try { pending = getPendingLivechatReplies(); }
    catch { return; }

    for (const reply of pending) {
      try {
        const jid = reply.jid.includes('@') ? reply.jid : `${reply.jid}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: reply.text });
        markLivechatReplyDone(reply.id, 'sent');
        logger.success('LIVECHAT', `Reply terkirim ke ${jid}`, `"${reply.text.substring(0, 40)}..."`);
      } catch (err) {
        markLivechatReplyDone(reply.id, 'failed');
        logger.error('LIVECHAT', `Gagal kirim reply ke ${reply.jid}`, err.message);
      }
      await delay(300);
    }
  }, 2000); // 2 detik untuk near-instant delivery

  // Worker untuk menutup sesi yang di-close dari dashboard
  setInterval(() => {
    try {
      const closedFile = './data/livechat_close_queue.json';
      if (!fs.existsSync(closedFile)) return;
      const data = JSON.parse(fs.readFileSync(closedFile, 'utf8'));
      const pending = (data.queue || []).filter(c => c.status === 'pending');
      if (!pending.length) return;
      pending.forEach(async (c) => {
        try {
          const jid = c.jid.includes('@') ? c.jid : `${c.jid}@s.whatsapp.net`;
          await sock.sendMessage(jid, { text: `✅ Sesi LiveChat Anda telah ditutup oleh admin.\n\nTerima kasih! Ketik *menu* untuk kembali ke menu utama.` });
          c.status = 'done';
          fs.writeFileSync(closedFile, JSON.stringify(data, null, 2), 'utf8');
          // Clear session
          const { clearSession } = await import('./store.js');
          clearSession(jid);
        } catch {}
      });
    } catch {}
  }, 3000);

  logger.info('LIVECHAT', '💬 LiveChat reply worker aktif (poll setiap 2 detik)');
}

// ─── Newsletter Lookup Worker ─────────────────────────────
// Dibaca dari dashboard: file newsletter_lookup_req.json
// Hasilnya ditulis ke newsletter_lookup_res.json
function startNewsletterLookupWorker(sock) {
  const REQ_FILE = './data/newsletter_lookup_req.json';
  const RES_FILE = './data/newsletter_lookup_res.json';

  setInterval(async () => {
    if (!fs.existsSync(REQ_FILE)) return;
    let req;
    try {
      req = JSON.parse(fs.readFileSync(REQ_FILE, 'utf8'));
      fs.unlinkSync(REQ_FILE); // hapus segera agar tidak diproses dua kali
    } catch { return; }

    if (!req?.code) return;
    // Abaikan request yang sudah lebih dari 15 detik (sudah timeout di web)
    if (Date.now() - (req.requestedAt || 0) > 15000) return;

    try {
      const meta = await sock.newsletterMetadata('invite', req.code);
      fs.writeFileSync(RES_FILE, JSON.stringify({
        ok: true,
        jid: meta.id,
        name: meta.name || meta.id,
        description: meta.description || '',
        subscribers: meta.subscribers || 0,
      }), 'utf8');
      logger.success('NEWSLETTER', `Lookup berhasil: ${meta.name} (${meta.id})`);
    } catch (err) {
      fs.writeFileSync(RES_FILE, JSON.stringify({
        ok: false,
        error: 'Saluran tidak ditemukan atau link sudah kadaluarsa: ' + err.message,
      }), 'utf8');
      logger.warn('NEWSLETTER', `Lookup gagal untuk kode: ${req.code}`, err.message);
    }
  }, 1000);

  logger.info('NEWSLETTER', '🔍 Newsletter lookup worker aktif');
}

// ─── Broadcast Worker ────────────────────────────────────
// Poll broadcast_queue.json setiap 5 detik
// Kirim pesan/foto/video ke saluran WhatsApp (newsletter / grup)
function startBroadcastWorker(sock) {
  if (broadcastInterval) clearInterval(broadcastInterval);

  broadcastInterval = setInterval(async () => {
    let pending;
    try { pending = getPendingBroadcasts(); }
    catch { return; }

    for (const bc of pending) {
      try {
        const jid = bc.channelJid;
        if (!jid) { markBroadcastDone(bc.id, 'failed', 'channelJid kosong'); continue; }

        const isNewsletter = jid.endsWith('@newsletter');
        const mediaPath = bc.mediaFilename
          ? path.join(__dirname, 'data', 'broadcast_media', bc.mediaFilename)
          : null;
        const hasMedia = mediaPath && fs.existsSync(mediaPath);

        // Saluran (@newsletter) dan grup: Baileys memakai sendMessage; relayMessage mengode plaintext untuk newsletter.
        const sendFn = (payload) => sock.sendMessage(jid, payload);

        if (hasMedia) {
          const mediaBuffer = fs.readFileSync(mediaPath);
          const isVideo = (bc.mediaMime || '').startsWith('video/');
          try {
            if (isVideo) {
              await sendFn({ video: mediaBuffer, caption: bc.pesan || '', mimetype: bc.mediaMime || 'video/mp4' });
            } else {
              await sendFn({ image: mediaBuffer, caption: bc.pesan || '', mimetype: bc.mediaMime || 'image/jpeg' });
            }
          } catch (mediaErr) {
            if (isNewsletter) {
              // Fallback ke teks saja — bug Baileys: media newsletter pakai CDN path berbeda (/o1/ vs /m1/)
              logger.warn('BROADCAST', `Media ke newsletter gagal, fallback ke teks`, mediaErr.message);
              const fallbackText = [bc.pesan, '_(Foto/video tidak dapat dikirim ke saluran saat ini)_'].filter(Boolean).join('\n');
              await sock.sendMessage(jid, { text: fallbackText });
            } else {
              throw mediaErr;
            }
          }
        } else if (bc.pesan) {
          await sendFn({ text: bc.pesan });
        } else {
          markBroadcastDone(bc.id, 'failed', 'Tidak ada pesan maupun media');
          continue;
        }

        markBroadcastDone(bc.id, 'sent');
        logger.success('BROADCAST', `Broadcast terkirim → ${jid} ${isNewsletter ? '[newsletter]' : '[grup]'}`, bc.pesan?.substring(0, 40) || `[${bc.mediaMime}]`);

      } catch (err) {
        markBroadcastDone(bc.id, 'failed', err.message);
        logger.error('BROADCAST', `Gagal broadcast → ${bc.channelJid}`, err.message);
      }

      // Jeda antar kirim agar tidak rate-limit
      await delay(2500);
    }
  }, 5000);

  logger.info('BROADCAST', '📢 Broadcast worker aktif (poll setiap 5 detik)');
}

function wibTimeParts() {
  const parts = {};
  for (const { type, value } of new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())) {
    if (type !== 'literal') parts[type] = value;
  }
  return parts;
}

/** Antrian teks prakiraan BMKG setiap hari ±00:00 WIB (jendela menit ke-0–12, cek tiap ~40 dtk). */
function startWeatherScheduler() {
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    const cfg = getWeatherBroadcastConfig();
    if (!cfg.enabled || !cfg.channelJid) return;
    const p = wibTimeParts();
    const ymd = `${p.year}-${p.month}-${p.day}`;
    if (cfg.lastSentDate === ymd) return;
    const h = parseInt(p.hour, 10);
    const m = parseInt(p.minute, 10);
    if (h !== 0 || m > 12) return;
    busy = true;
    try {
      const data = await scrapeMedanJohorCuacaHariIni();
      const pesan = formatCuacaWhatsApp(data);
      queueBroadcast({ channelJid: cfg.channelJid, pesan: pesan.trim() });
      markWeatherBroadcastSent(ymd);
      logger.success('CUACA', `Jadwal 00:00 WIB: prakiraan BMKG diantrekan → ${cfg.channelJid}`);
    } catch (err) {
      logger.warn('CUACA', 'Gagal jadwal BMKG (akan dicoba lagi dalam jendela 00:00)', err.message);
    } finally {
      busy = false;
    }
  }, 40_000);
  logger.info('CUACA', '⏰ Penjadwal prakiraan BMKG aktif (00:00 WIB, jika diaktifkan di dashboard)');
}

/** Automation berita Pemko Medan: cek berita baru sesuai interval yang dikonfigurasi. */
function startAutomationScheduler(sock) {
  let lastCheck = 0;
  setInterval(async () => {
    const config = getAutomationConfig();
    if (!config.enabled || !config.target) return;

    const now = Date.now();
    const intervalMs = (config.intervalMinutes || 30) * 60 * 1000;
    if (now - lastCheck < intervalMs) return;

    lastCheck = now;
    try {
      const beritaBaru = await scrapePemkoBeritaArticles(5); // Ambil 5 berita terbaru
      const lastProcessed = getLastProcessedBerita() || [];

      // Cari berita yang belum diproses
      const newItems = beritaBaru.filter(item => !lastProcessed.some(lp => lp.title === item.title && lp.articleUrl === item.articleUrl));

      if (newItems.length === 0) return; // Tidak ada berita baru

      // Proses berita baru (ambil yang paling baru saja untuk demo)
      const item = newItems[0];
      let message = `📰 *Berita Baru dari Pemko Medan*\n\n📌 *${item.title}*\n\n${item.description}\n\n🔗 Baca selengkapnya: ${item.articleUrl}`;

      if (config.action === 'broadcast') {
        queueBroadcast({ channelJid: config.target, pesan: message });
        addAutomationHistory({
          action: 'broadcast',
          target: config.target,
          title: item.title,
          status: 'success'
        });
        logger.success('AUTOMATION', `Berita baru dikirim ke channel: ${item.title}`);
      } else if (config.action === 'ping') {
        // Kirim pesan pribadi ke nomor WA
        const jid = config.target.includes('@') ? config.target : `${config.target}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        addAutomationHistory({
          action: 'ping',
          target: config.target,
          title: item.title,
          status: 'success'
        });
        logger.success('AUTOMATION', `Berita baru dikirim ke nomor: ${config.target} - ${item.title}`);
      }

      // Update last processed
      const updatedProcessed = [...lastProcessed, ...newItems.map(i => ({ title: i.title, articleUrl: i.articleUrl, processedAt: new Date().toISOString() }))];
      setLastProcessedBerita(updatedProcessed.slice(-20)); // Simpan maksimal 20 berita terakhir

    } catch (err) {
      logger.error('AUTOMATION', 'Gagal cek berita baru', err.message);
      addAutomationHistory({
        action: config.action,
        target: config.target,
        title: 'Error Check',
        status: 'failed',
        error: err.message
      });
    }
  }, 60_000); // Cek setiap 1 menit
  logger.info('AUTOMATION', '🤖 Automation berita Pemko Medan aktif (jika diaktifkan di dashboard)');
}

// ─── Start Bot ───────────────────────────────────────────
async function startBot() {
  logger.banner();
  logger.info('BOOT', 'Inisialisasi sistem bot...');
  await delay(500);

  // Pulihkan auth dari env var jika tersedia (Railway free plan)
  restoreAuthFromEnv();

  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.AUTH_DIR);
  logger.info('AUTH', 'Auth state dimuat', CONFIG.AUTH_DIR);

  // Fetch latest Baileys version
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info('VERSION', `Baileys v${version.join('.')}`, isLatest ? '(latest)' : '(outdated)');

  // Create WA Socket
  const sock = makeWASocket({
    version,
    logger: pinoLogger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pinoLogger),
    },
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    getMessage: async () => {
      return { conversation: 'hello' };
    }
  });

  // ─── Pairing Code Handler ─────────────────────────────
  if (!sock.authState.creds.registered) {
    await delay(2000); // Delay penting agar handshake tidak error

    logger.divider();
    logger.info('PAIR', 'Akun belum terdaftar. Memulai proses Pairing Code...');
    logger.divider();

    // Railway / non-interactive: baca dari env var PHONE_NUMBER
    // Lokal: input manual via terminal
    let phoneNumber;
    if (process.env.PHONE_NUMBER) {
      phoneNumber = process.env.PHONE_NUMBER;
      logger.info('PAIR', `Menggunakan PHONE_NUMBER dari environment: ${phoneNumber}`);
    } else {
      phoneNumber = await question(
        '\n📱 Masukkan nomor WhatsApp (format: 628xxxxxxxxxx): '
      );
    }

    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!phoneNumber.startsWith('62')) {
      phoneNumber = '62' + phoneNumber.replace(/^0/, '');
    }

    logger.info('PAIR', `Nomor yang digunakan: +${phoneNumber}`);
    logger.info('PAIR', 'Meminta pairing code...');

    await delay(3000); // Delay untuk stabilisasi koneksi sebelum request

    try {
      const code = await sock.requestPairingCode(phoneNumber);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

      logger.divider();
      console.log(`\n`);
      console.log(`  ╔══════════════════════════════╗`);
      console.log(`  ║   🔑  PAIRING CODE ANDA      ║`);
      console.log(`  ║                              ║`);
      console.log(`  ║      \x1b[33m\x1b[1m${formattedCode}\x1b[0m          ║`);
      console.log(`  ║                              ║`);
      console.log(`  ╚══════════════════════════════╝`);
      console.log(`\n`);
      logger.info('PAIR', 'Cara pairing:');
      logger.info('PAIR', '1. Buka WhatsApp di HP');
      logger.info('PAIR', '2. Tap tiga titik > Perangkat Tertaut');
      logger.info('PAIR', '3. Tap "Tautkan Perangkat"');
      logger.info('PAIR', '4. Masukkan kode pairing di atas');
      logger.divider();
      logger.info('PAIR', `Kode kedaluwarsa dalam ${CONFIG.PAIRING_TIMEOUT} detik...`);
    } catch (err) {
      logger.error('PAIR', 'Gagal mendapatkan pairing code', err.message);
      logger.warn('PAIR', 'Mencoba restart dalam 5 detik...');
      await delay(5000);
      return startBot();
    }
  }

  // ─── Connection Update ────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, isOnline } = update;

    if (connection === 'connecting') {
      logger.state('CONNECTING', 'Menghubungkan ke server WhatsApp...');
    }

    if (connection === 'open') {
      reconnectCount = 0;
      const botJid = sock.user?.id;
      const botName = sock.user?.name;
      logger.success('CONNECTED', `Bot terhubung!`, `${botName} (${botJid})`);
      logger.divider();
      logger.success('READY', '🚀 Bot siap menerima pesan!');
      logger.info('READY', 'Ketik Ctrl+C untuk menghentikan bot');
      logger.divider();
      startFeedbackWorker(sock);
      startStatusNotifWorker(sock);
      startLivechatReplyWorker(sock);
      startBroadcastWorker(sock);
      startNewsletterLookupWorker(sock);
      startAutomationScheduler(sock);
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      logger.warn('CONNECTION', `Koneksi terputus`, `Kode: ${reason}`);

      if (reason === DisconnectReason.badSession) {
        logger.error('AUTH', 'Sesi rusak! Hapus folder auth_info_baileys dan jalankan ulang.');
        process.exit(1);
      } else if (reason === DisconnectReason.connectionReplaced) {
        logger.error('AUTH', 'Sesi digantikan perangkat lain. Bot berhenti.');
        process.exit(1);
      } else if (reason === DisconnectReason.loggedOut) {
        logger.error('AUTH', 'Bot di-logout! Hapus folder auth dan jalankan ulang.');
        process.exit(1);
      } else {
        logger.warn('RECONNECT', `Disconnect (${reason}). Mencoba reconnect...`);
        await scheduleReconnect();
      }
    }

    if (isOnline !== undefined) {
      logger.state('ONLINE STATUS', isOnline ? '🟢 Online' : '🔴 Offline');
    }
  });

  // ─── Credentials Update ───────────────────────────────
  sock.ev.on('creds.update', async () => {
    await saveCreds();
    logger.info('AUTH', 'Credentials disimpan');
  });

  // ─── Message Handler ──────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (!msg.message) continue;

      try {
        await handleMessage(sock, msg);
      } catch (err) {
        logger.error('HANDLER', `Error memproses pesan`, err.message);
        console.error(err);
      }
    }
  });

  // ─── Group Events ─────────────────────────────────────
  sock.ev.on('groups.update', (updates) => {
    for (const update of updates) {
      logger.info('GROUP', `Update grup: ${update.id}`, JSON.stringify(update).substring(0, 80));
    }
  });

  sock.ev.on('group-participants.update', ({ id, participants, action }) => {
    logger.info('GROUP', `Grup ${id}: ${action}`, participants.join(', '));
  });

  // ─── Reconnect Scheduler ──────────────────────────────
  async function scheduleReconnect() {
    if (reconnectCount >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
      logger.error('RECONNECT', `Gagal reconnect setelah ${CONFIG.MAX_RECONNECT_ATTEMPTS} percobaan. Bot berhenti.`);
      process.exit(1);
    }
    reconnectCount++;
    const waitTime = CONFIG.RECONNECT_DELAY * reconnectCount;
    logger.info('RECONNECT', `Percobaan ke-${reconnectCount}/${CONFIG.MAX_RECONNECT_ATTEMPTS}`, `tunggu ${waitTime / 1000}s`);
    await delay(waitTime);
    startBot();
  }

  return sock;
}

// ─── Process Handlers ─────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('SYSTEM', 'Uncaught Exception', err.message);
  console.error(err);
});

process.on('unhandledRejection', (err) => {
  logger.error('SYSTEM', 'Unhandled Rejection', err?.message || String(err));
});

process.on('SIGINT', () => {
  logger.warn('SYSTEM', 'Menerima SIGINT. Bot dihentikan dengan aman...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.warn('SYSTEM', 'Menerima SIGTERM. Bot dihentikan...');
  process.exit(0);
});

// ─── Run ──────────────────────────────────────────────────
startWeatherScheduler();
startBot().catch(err => {
  logger.error('BOOT', 'Gagal menjalankan bot', err.message);
  console.error(err);
  process.exit(1);
});
