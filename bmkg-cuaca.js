// Prakiraan cuaca Kec. Medan Johor (6 kelurahan) dari portal BMKG
// https://www.bmkg.go.id/cuaca/prakiraan-cuaca/12.71.11

import { load } from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const BMKG_MEDAN_JOHOR_URL = 'https://www.bmkg.go.id/cuaca/prakiraan-cuaca/12.71.11';

/** Urutan resmi sesuai BMKG (desa/kelurahan di kecamatan). */
export const KELURAHAN_BMKG_ORDER = [
  'Suka Maju',
  'Titi Kuning',
  'Kedai Durian',
  'Pangkalan Mansur',
  'Gedung Johor',
  'Kwala Bekala',
];

export function getWibYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function norm(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function headerMatchesToday(headerText, now = new Date()) {
  const t = norm(headerText);
  if (!t || t.toLowerCase().includes('kelurahan')) return false;
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(now);
  const mon = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short' }).format(now);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(now);
  return t.includes(wd) && t.includes(mon) && t.includes(day);
}

function parseCuacaCell(raw) {
  const t = norm(raw.replace(/\u00a0/g, ' '));
  const m = t.match(/^(.+?)[\s]*(\d+[–-]\d+\s*°C)[\s]*([\d–-]+%)\s*$/u)
    || t.match(/(.+?)(\d+[–-]\d+\s*°C)([\d–-]+%)/u);
  if (!m) return { kondisi: t || '—', suhu: '', lembab: '' };
  return { kondisi: norm(m[1]), suhu: norm(m[2]), lembab: norm(m[3]) };
}

export async function scrapeMedanJohorCuacaHariIni() {
  const res = await fetch(BMKG_MEDAN_JOHOR_URL, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' },
  });
  if (!res.ok) throw new Error(`BMKG HTTP ${res.status}`);
  const html = await res.text();
  const $ = load(html);

  let $table = null;
  $('table').each((_, el) => {
    const txt = $(el).text();
    if (txt.includes('Kelurahan') && (txt.includes('Desa') || KELURAHAN_BMKG_ORDER.some(k => txt.includes(k)))) {
      $table = $(el);
      return false;
    }
    return undefined;
  });
  if (!$table || !$table.length) throw new Error('Tabel prakiraan BMKG tidak ditemukan (layout berubah?)');

  const $headerRow = $table.find('thead tr').first().length
    ? $table.find('thead tr').first()
    : $table.find('tr').has('th').first();
  const headers = [];
  $headerRow.find('th').each((_, th) => {
    headers.push(norm($(th).text()));
  });
  if (headers.length < 2) throw new Error('Header tabel BMKG tidak valid');

  let colIndex = headers.findIndex((h, i) => i > 0 && headerMatchesToday(h));
  if (colIndex < 0) colIndex = 1;
  const headerLabel = headers[colIndex] || headers[1] || 'Hari ini';

  const rawRows = [];
  const $rows = $table.find('tbody tr').length ? $table.find('tbody tr') : $table.find('tr').filter((_, tr) => $(tr).find('td').length > colIndex);
  $rows.each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find('td');
    if (tds.length <= colIndex) return;
    const $nameCell = tds.eq(0);
    let name = $nameCell.find('a').first().text().trim();
    if (!name) name = norm($nameCell.text()).split(/\n/)[0].trim();
    if (!name || name.length < 3 || /kelurahan|desa/i.test(name)) return;
    const cellHtml = tds.eq(colIndex);
    const parsed = parseCuacaCell(cellHtml.text());
    rawRows.push({ kelurahan: name, ...parsed });
  });

  const byName = new Map(rawRows.map(r => [r.kelurahan, r]));
  const rows = [];
  for (const k of KELURAHAN_BMKG_ORDER) {
    let r = byName.get(k);
    if (!r) {
      r = rawRows.find(x => x.kelurahan === k || x.kelurahan.replace(/\s/g, '') === k.replace(/\s/g, ''));
    }
    if (!r) {
      const fuzzy = rawRows.find(x => x.kelurahan.includes(k) || k.includes(x.kelurahan));
      if (fuzzy) r = fuzzy;
    }
    if (r) rows.push({ kelurahan: k, kondisi: r.kondisi, suhu: r.suhu, lembab: r.lembab });
  }
  if (rows.length < 3) throw new Error(`Data cuaca kurang lengkap (${rows.length} kelurahan terbaca)`);

  return {
    headerLabel,
    tanggalWib: getWibYmd(),
    rows,
    sourceUrl: BMKG_MEDAN_JOHOR_URL,
  };
}

const KONDISI_EMOJI = [
  [/hujan\s*lebat|hujan\s*sedang/i, '⛈️'],
  [/hujan/i, '🌧️'],
  [/berawan/i, '⛅'],
  [/cerah\s*berawan/i, '🌤️'],
  [/cerah/i, '☀️'],
  [/kabut|asap/i, '🌫️'],
  [/petir|kilat/i, '⚡'],
];

function emojiKondisi(k) {
  for (const [re, e] of KONDISI_EMOJI) if (re.test(k)) return e;
  return '🌡️';
}

export function formatCuacaWhatsApp(data) {
  const longDate = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  let t = '';
  t += `🌤️ *PRAKIRAAN CUACA HARI INI*\n`;
  t += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  t += `📍 *Kecamatan Medan Johor*\n`;
  t += `🗓️ _${longDate} (WIB)_\n`;
  t += `📡 *Sumber:* BMKG — data kolom *${data.headerLabel}*\n`;
  t += `🔗 ${data.sourceUrl}\n\n`;
  t += `Halo warga Johor! 👋\n`;
  t += `Cuaca besok bisa berubah — gunakan info ini untuk siaga payung ☂️, jadwal outdoor, dan keselamatan keluarga.\n\n`;
  t += `*Ringkasan per kelurahan:*\n\n`;

  for (const r of data.rows) {
    const em = emojiKondisi(r.kondisi);
    t += `${em} *${r.kelurahan}*\n`;
    t += `   _${r.kondisi}_\n`;
    if (r.suhu) t += `   🌡️ ${r.suhu}`;
    if (r.lembab) t += `  ·  💧 Kelembapan ${r.lembab}`;
    t += `\n\n`;
  }

  t += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  t += `_Prakiraan resmi BMKG. Tetap jaga kesehatan & waspada perubahan cuaca._\n`;
  t += `🏙️ *#MEDANUNTUKSEMUA* — *Hallo Johor*`;
  return t;
}
