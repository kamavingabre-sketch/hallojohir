// Ambil daftar berita dari portal Kecamatan Medan Johor (judul, ringkasan, URL gambar, link artikel)
// Sumber: https://medanjohor.medan.go.id/berita

import { load } from 'cheerio';
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const MEDAN_BERITA_URL = 'https://medanjohor.medan.go.id/berita';

export async function scrapeMedanBeritaArticles(limit = 10) {
  const res = await axios.get(MEDAN_BERITA_URL, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    timeout: 10000
  });
  const html = res.data;
  const $ = load(html);
  const items = [];
  $('.blog-item').each((_, el) => {
    if (items.length >= limit) return false;
    const $article = $(el);
    const $titleA = $article.find('.blog-content a.h6').first();
    const title = $titleA.text().trim();
    let articleUrl = ($titleA.attr('href') || '').trim();
    if (articleUrl && !articleUrl.startsWith('http')) {
      articleUrl = new URL(articleUrl, MEDAN_BERITA_URL).href;
    }
    const $img = $article.find('.blog-img-inner img').first();
    let imageUrl = ($img.attr('src') || '').trim();
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = new URL(imageUrl, MEDAN_BERITA_URL).href;
    }
    let description = $article.find('.blog-content p.my-3').first().text().trim();
    description = description.replace(/\u2003/g, ' ').replace(/\s+/g, ' ');
    if (title) {
      items.push({ title, description, imageUrl, articleUrl: articleUrl || MEDAN_BERITA_URL });
    }
  });
  return items;
}

export async function downloadImageBuffer(imageUrl) {
  const res = await axios.get(imageUrl, {
    headers: { 'User-Agent': UA },
    responseType: 'arraybuffer',
    timeout: 10000
  });
  const ct = (res.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
  if (!ct.startsWith('image/')) throw new Error('Bukan konten gambar');
  return { buffer: Buffer.from(res.data), mime: ct };
}
