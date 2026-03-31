// Ambil daftar berita dari website resmi Kecamatan Medan Johor
// Sumber: https://medanjohor.medan.go.id/berita

import { load } from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const MEDANJOHOR_BERITA_URL = 'https://medanjohor.medan.go.id/berita';
const BASE_URL = 'https://medanjohor.medan.go.id';

/**
 * Ambil daftar artikel dari halaman berita Kecamatan Medan Johor.
 * @param {number} limit - Maks jumlah artikel yang dikembalikan
 * @returns {Promise<Array<{title, description, imageUrl, articleUrl, tanggal, kategori}>>}
 */
export async function scrapeMedanJohorBeritaArticles(limit = 5) {
  const res = await fetch(MEDANJOHOR_BERITA_URL, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Gagal memuat halaman berita Kec. Medan Johor (HTTP ${res.status})`);

  const html = await res.text();
  const $ = load(html);
  const items = [];

  // Strategi 1: Cari container yang punya img + link judul
  // Situs ini menggunakan layout card dengan img, tanggal, kategori, judul, deskripsi
  const candidates = [];

  // Coba berbagai selector container artikel
  const containerSelectors = [
    'article', '.card', '.post-item', '.news-item', '.berita-item',
    '.col-md-4', '.col-sm-6', '.item', '.entry',
  ];

  let found = false;
  for (const sel of containerSelectors) {
    const els = $(sel).filter((_, el) => {
      const t = $(el).text();
      const hasImg = $(el).find('img[src*="storage/berita"]').length > 0;
      const hasLink = $(el).find('a[href*="/berita/"]').length > 0;
      return hasImg && hasLink;
    });
    if (els.length >= 2) {
      els.each((_, el) => {
        if (candidates.length >= limit * 2) return false;
        candidates.push($(el));
      });
      found = true;
      break;
    }
  }

  // Strategi 2: Fallback — cari semua img yang berasal dari storage/berita
  if (!found || candidates.length === 0) {
    $('img[src*="storage/berita"]').each((_, img) => {
      if (candidates.length >= limit * 2) return false;
      // Naik ke parent yang punya link judul
      let $container = $(img).parent();
      for (let i = 0; i < 6; i++) {
        if ($container.find('a[href*="/berita/"]').length > 0) break;
        $container = $container.parent();
      }
      if ($container.find('a[href*="/berita/"]').length > 0) {
        candidates.push($container);
      }
    });
  }

  for (const $el of candidates) {
    if (items.length >= limit) break;

    // ── Image ──
    const $img = $el.find('img[src*="storage/berita"]').first();
    let imageUrl = ($img.attr('src') || '').trim();
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = BASE_URL + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
    }
    if (!imageUrl) continue;

    // ── Judul + URL artikel ──
    const $titleLink = $el.find('a[href*="/berita/"]').filter((_, a) => {
      // Hindari link "Baca Selengkapnya" yang biasanya ada setelah deskripsi
      const txt = $(a).text().trim().toLowerCase();
      return txt.length > 5 && !txt.includes('baca') && !txt.includes('selengkapnya');
    }).first();

    // Kalau tidak ketemu, ambil link berita pertama apapun
    const $anyLink = $el.find('a[href*="/berita/"]').first();
    const $usedLink = $titleLink.length ? $titleLink : $anyLink;

    const title = $usedLink.text().trim();
    if (!title || title.length < 4) continue;

    let articleUrl = ($usedLink.attr('href') || '').trim();
    if (articleUrl && !articleUrl.startsWith('http')) {
      articleUrl = BASE_URL + (articleUrl.startsWith('/') ? '' : '/') + articleUrl;
    }
    if (!articleUrl) articleUrl = MEDANJOHOR_BERITA_URL;

    // ── Deskripsi ──
    let description = '';
    $el.find('p').each((_, p) => {
      const t = $(p).text().trim();
      if (t && t.length > 20 && !t.toLowerCase().includes('baca selengkapnya')) {
        description = t;
        return false;
      }
    });
    if (!description) {
      // Ambil teks dari container, bersihkan dari judul dan tanggal
      description = $el.clone()
        .find('img, a, .tanggal, .date, time').remove().end()
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
    }

    // ── Tanggal ──
    let tanggal = '';
    const $timeEl = $el.find('time').first();
    if ($timeEl.length) {
      tanggal = $timeEl.attr('datetime') || $timeEl.text().trim();
    }
    if (!tanggal) {
      // Cari teks bertanggal — format Indonesia: "Senin, 31 Maret 2026, ..."
      const allText = $el.text();
      const dateMatch = allText.match(
        /(?:Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu),\s+\d{1,2}\s+\w+\s+\d{4}(?:,\s+\d{2}:\d{2}(?::\d{2})?)?/
      );
      if (dateMatch) tanggal = dateMatch[0].trim();
    }

    // ── Kategori ──
    let kategori = '';
    const $katLink = $el.find('a[href*="berita-kategori"]').first();
    if ($katLink.length) {
      kategori = $katLink.text().trim();
    }

    items.push({ title, description, imageUrl, articleUrl, tanggal, kategori });
  }

  if (items.length === 0) {
    throw new Error('Tidak ada artikel yang berhasil diparse dari halaman berita Kec. Medan Johor. Mungkin struktur HTML berubah.');
  }

  return items;
}

/**
 * Unduh gambar dari URL, kembalikan buffer dan mime type.
 */
export async function downloadMedanJohorImage(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': UA, Referer: BASE_URL + '/' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} saat mengunduh gambar`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!ct.startsWith('image/')) throw new Error('Bukan konten gambar');
  return { buffer: buf, mime: ct };
}

/**
 * Format artikel menjadi teks WhatsApp.
 * @param {{title, description, tanggal, kategori, articleUrl}} art
 * @returns {string}
 */
export function formatBeritaWhatsApp(art) {
  let t = '';
  t += `📰 *${art.title}*\n`;
  if (art.tanggal) t += `🗓️ _${art.tanggal}_\n`;
  if (art.kategori) t += `🏷️ Kategori: ${art.kategori}\n`;
  t += `\n`;
  if (art.description) t += `${art.description.substring(0, 300)}${art.description.length > 300 ? '...' : ''}\n\n`;
  t += `🔗 ${art.articleUrl}\n`;
  t += `\n🏙️ *Kecamatan Medan Johor* — Hallo Johor`;
  return t;
}
