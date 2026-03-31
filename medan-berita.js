// Ambil daftar berita dari portal Kecamatan Medan Johor (judul, ringkasan, URL gambar, link artikel)
// Sumber: https://medanjohor.go.id/berita

import { load } from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const MEDAN_BERITA_URL = 'https://medanjohor.go.id/berita';

export async function scrapeMedanBeritaArticles(limit = 10) {
  const res = await fetch(MEDAN_BERITA_URL, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
  });
  if (!res.ok) throw new Error(`Gagal memuat halaman berita (HTTP ${res.status})`);
  const html = await res.text();
  const $ = load(html);
  const items = [];
  $('article.entry.main-entry').each((_, el) => {
    if (items.length >= limit) return false;
    const $article = $(el);
    const $titleA = $article.find('h3.entry-title a').first();
    const title = $titleA.text().trim();
    let articleUrl = ($titleA.attr('href') || '').trim();
    if (articleUrl && !articleUrl.startsWith('http')) {
      articleUrl = new URL(articleUrl, MEDAN_BERITA_URL).href;
    }
    const $img = $article.find('.entry-image img').first();
    let imageUrl = ($img.attr('src') || '').trim();
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = new URL(imageUrl, MEDAN_BERITA_URL).href;
    }
    let description = $article.find('.entry-body p').first().text().trim();
    description = description.replace(/\u2003/g, ' ').replace(/\s+/g, ' ');
    if (title && imageUrl) {
      items.push({ title, description, imageUrl, articleUrl: articleUrl || MEDAN_BERITA_URL });
    }
  });
  return items;
}

export async function downloadImageBuffer(imageUrl) {
  const res = await fetch(imageUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!ct.startsWith('image/')) throw new Error('Bukan konten gambar');
  return { buffer: buf, mime: ct };
}
