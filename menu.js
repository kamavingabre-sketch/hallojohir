// ═══════════════════════════════════════════════
//   MENU CONTENT - Hallo Johor
//   Layanan Kecamatan Medan Johor
// ═══════════════════════════════════════════════

export const MENU_IMAGE_URL = 'https://i.ibb.co.com/Tqw7nWqq/IMG-20260323-215603.jpg';

export const MENU_UTAMA = `🏛️ *Selamat Datang di*
🤝 *HALLO JOHOR* 🤝
_Bot Layanan Kecamatan Medan Johor_

Halo! Saya siap membantu Anda dengan berbagai layanan administrasi kecamatan.

📋 *MENU LAYANAN:*

1️⃣ *Informasi Persyaratan Surat*
   › Pengantar KTP/KK, Domisili, Usaha, dll

2️⃣ *Pengaduan Masyarakat*
   › Laporkan masalah di wilayah Anda

3️⃣ *Informasi Kegiatan Kecamatan*
   › Jadwal & program kecamatan

4️⃣ *Informasi Pajak PBB*
   › SPPT, cara bayar, lokasi bayar

5️⃣ *Kontak & Jam Pelayanan*
   › Nomor & alamat kantor

6️⃣ *Pintar Johor* 📚
   › Perpustakaan Interaktif Digital Rakyat Johor

7️⃣ *Program Kecamatan*
   › RELASI JOHOR, SIGAP JOHOR, UMKM

8️⃣ *Wisata Medan Johor*
   › Kuliner, Hiburan & Taman, Religi & Kesehatan

9️⃣ *Berita Kecamatan*
   › Berita terbaru dari Kecamatan Medan Johor

🔟 *LiveChat Admin*
   › Chat langsung dengan petugas kecamatan

1️⃣1️⃣ *Cek Status Laporan Saya*
   › Lihat riwayat & status laporan yang pernah dikirim

1️⃣2️⃣ *UMKM Binaan Kecamatan Medan Johor* 🏪
   › Direktori usaha mikro, kecil & menengah binaan kecamatan

━━━━━━━━━━━━━━━━━━━━━━━
💡 Ketik *angka menu* (1-12) untuk memilih
━━━━━━━━━━━━━━━━━━━━━━━
🏙️ *#MEDANUNTUKSEMUA*
_Hallo Johor — Hadir untuk Warga Medan Johor_`;

export const MENU_PERSYARATAN = `📋 *INFORMASI PERSYARATAN SURAT*
━━━━━━━━━━━━━━━━━━━━━━━

🪪 *LAYANAN KEPENDUDUKAN:*
*A* — KTP El Baru
*B* — KTP El Hilang
*C* — Perekaman KTP El
*D* — Kartu Keluarga (KK)
*E* — KIA (Kartu Identitas Anak)
*F* — Surat Ket. Pindah Keluar
*G* — Surat Ket. Pindah Masuk

📝 *LAYANAN SURAT KETERANGAN:*
*H* — Surat Pernyataan Ahli Waris
*J* — Surat Domisili Diri
*K* — Surat Domisili Usaha
*L* — Surat Pengantar Nikah
*M* — Surat Keterangan Kematian
*N* — Rekomendasi Akte Kelahiran

📁 *LAYANAN LAINNYA:*
*S* — Legalisasi Surat/Dokumen

━━━━━━━━━━━━━━━━━━━━━━━
💡 Ketik *huruf kode* sesuai daftar di atas (A–G, H, J–N, S)
Atau ketik *0* untuk kembali ke menu`;

// ─── Footer standar persyaratan ───────────────────────────
const FOOTER_PERSYARATAN = `
━━━━━━━━━━━━━━━━━━━━━━━
📍 *Datang ke:*
Kantor Kecamatan Medan Johor
Jl. Karya Cipta No. 16, Medan Johor
🗺️ https://maps.google.com/?q=Kantor+Kecamatan+Medan+Johor

⏰ *Jam Pelayanan:*
Senin - Kamis : 08.00 - 15.00 WIB
Jumat         : 08.00 - 11.30 WIB

📱 *Info & Konfirmasi:*
0813-6777-2047

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *Pastikan semua dokumen sudah lengkap sebelum datang ke kantor.*

🏙️ *#MEDANUNTUKSEMUA*
Ketik *0* untuk kembali ke menu`;

export const PERSYARATAN = {

  // ── A: KTP El Baru ─────────────────────────────────────
  A: `🪪 *PELAYANAN PEMBUATAN KTP EL BARU*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *6 hari kerja* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Fotocopi Kartu Keluarga (KK)
2️⃣  KTP Asli yang lama
${FOOTER_PERSYARATAN}`,

  // ── B: KTP El Hilang ───────────────────────────────────
  B: `🪪 *PELAYANAN PEMBUATAN KTP EL YANG HILANG*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *6 hari kerja* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Fotocopi KTP yang Hilang
2️⃣  Fotocopi Kartu Keluarga (KK)
3️⃣  Surat Keterangan Hilang dari Kepolisian
${FOOTER_PERSYARATAN}`,

  // ── C: Perekaman KTP El ────────────────────────────────
  C: `🪪 *PELAYANAN PEREKAMAN KTP EL*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *5 menit* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Fotocopi Kartu Keluarga (KK)
2️⃣  Yang Bersangkutan hadir langsung
${FOOTER_PERSYARATAN}`,

  // ── D: Kartu Keluarga ──────────────────────────────────
  D: `👨‍👩‍👧‍👦 *PELAYANAN PERMOHONAN KARTU KELUARGA (KK)*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *6 hari kerja* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Fotocopi Akte Kelahiran / Ijazah terakhir
2️⃣  Fotocopi Buku Nikah
3️⃣  KK Asli (yang lama)
${FOOTER_PERSYARATAN}`,

  // ── E: KIA ─────────────────────────────────────────────
  E: `🧒 *PELAYANAN KIA (KARTU IDENTITAS ANAK)*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *6 hari kerja* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Fotocopi Akte Kelahiran
2️⃣  Pas Photo 3×4 sebanyak 2 lembar
    _(Latar biru = tahun lahir genap)_
    _(Latar merah = tahun lahir ganjil)_
    _(Untuk usia 5 tahun ke atas)_
${FOOTER_PERSYARATAN}`,

  // ── F: Pindah Keluar ───────────────────────────────────
  F: `🚚 *PELAYANAN SURAT KETERANGAN PINDAH KELUAR*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *6 hari kerja* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Fotocopi KTP
2️⃣  Fotocopi Kartu Keluarga (KK)
${FOOTER_PERSYARATAN}`,

  // ── G: Pindah Masuk ────────────────────────────────────
  G: `🏠 *PELAYANAN SURAT KETERANGAN PINDAH MASUK*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *6 hari kerja* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Surat Pengantar Pindah asli dari daerah asal
2️⃣  Fotocopi Kartu Keluarga (KK)
${FOOTER_PERSYARATAN}`,

  // ── H: Ahli Waris ──────────────────────────────────────
  H: `📄 *SURAT PERNYATAAN AHLI WARIS*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *3 hari kerja* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Nota Pengantar Lurah kepada Camat Medan Johor
2️⃣  Surat Pernyataan Ahli Waris *(Asli)*
3️⃣  Surat Pernyataan Ahli Waris *(Fotocopy)*
4️⃣  Bagan Silsilah Keluarga Pewaris
5️⃣  Fotocopy Akta Kematian Pewaris
6️⃣  Fotocopy Buku Nikah / Akta Perkawinan Pewaris
7️⃣  Fotocopy KK Terbaru *(Bercode)*, KTP & Akte Kelahiran Para Ahli Waris
8️⃣  Fotocopy KTP dan KK Saksi dari Pihak Suami dan Pihak Istri
9️⃣  Foto Saat Penandatanganan Surat Pernyataan Ahli Waris
🔟  Foto Kuburan / Batu Nisan Pewaris
1️⃣1️⃣ Surat Permohonan seluruh Ahli Waris ke Lurah dan Camat
1️⃣2️⃣ Surat Pernyataan Belum Pernah Membuat Surat Ahli Waris
1️⃣3️⃣ Surat Pernyataan Hanya Menikah satu kali / tidak ada pernikahan lain
1️⃣4️⃣ Surat Pernyataan Kepala Lingkungan
1️⃣5️⃣ Surat Pernyataan dua orang saksi
1️⃣6️⃣ Surat Pernyataan bersama para ahli waris
1️⃣7️⃣ Surat Pernyataan Keabsahan Penandatanganan Pernyataan Ahli Waris
1️⃣8️⃣ Surat Pernyataan Kebenaran Pemeriksaan Para Ahli Waris dari Lurah
${FOOTER_PERSYARATAN}`,

  // ── J: Domisili Diri ───────────────────────────────────
  J: `📄 *SURAT KETERANGAN DOMISILI DIRI*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *10 menit* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Surat Pernyataan yang bersangkutan _(diketahui Kepling)_
2️⃣  Fotokopi KTP
3️⃣  Fotokopi Kartu Keluarga (KK)
${FOOTER_PERSYARATAN}`,

  // ── K: Domisili Usaha ──────────────────────────────────
  K: `📄 *SURAT KETERANGAN DOMISILI USAHA*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *10 menit* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Surat Pernyataan yang bersangkutan _(diketahui Kepling)_
2️⃣  Fotokopi Akte Pendirian Usaha dari Notaris
3️⃣  Fotokopi KTP Pemohon
${FOOTER_PERSYARATAN}`,

  // ── L: Pengantar Nikah ─────────────────────────────────
  L: `📄 *SURAT KETERANGAN PENGANTAR NIKAH*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *10 menit* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Surat Pernyataan orangtua yang bersangkutan _(diketahui Kepling)_
2️⃣  Fotokopi KTP
3️⃣  Fotokopi Kartu Keluarga (KK)
${FOOTER_PERSYARATAN}`,

  // ── M: Surat Keterangan Kematian ───────────────────────
  M: `📄 *SURAT KETERANGAN KEMATIAN*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *10 menit* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

▸ *Jika meninggal di Rumah Sakit:*
1️⃣  Fotokopi Surat Kematian dari Rumah Sakit

▸ *Jika meninggal di Rumah:*
2️⃣  Surat Pernyataan Keluarga _(diketahui Kepling)_

▸ *Dokumen wajib keduanya:*
3️⃣  Fotokopi KTP dan KK yang meninggal
4️⃣  Fotokopi KTP Pelapor
${FOOTER_PERSYARATAN}`,

  // ── N: Rekomendasi Akte Kelahiran ──────────────────────
  N: `📄 *REKOMENDASI PERMOHONAN AKTE KELAHIRAN*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *10 menit* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Fotokopi Surat Lahir dari Rumah Sakit / Bidan
2️⃣  Fotokopi Buku Nikah / Akte Perkawinan
3️⃣  Fotokopi KTP Orangtua
4️⃣  Fotokopi KK Orangtua
5️⃣  Fotokopi KTP 2 orang Saksi
${FOOTER_PERSYARATAN}`,

  // ── S: Legalisasi Surat/Dokumen ────────────────────────
  S: `📁 *PELAYANAN LEGALISASI SURAT / DOKUMEN*
━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Waktu: *10 menit* | 💰 Tarif: *Gratis*

Lengkapi seluruh dokumen berikut:

1️⃣  Fotokopi KK dan KTP
2️⃣  Dokumen Asli yang akan dilegalisir
3️⃣  Fotokopi Dokumen yang akan dilegalisir
${FOOTER_PERSYARATAN}`,
};

// MENU_KEGIATAN sekarang dibuild secara dinamis via buildKegiatanMenu() di store.js
// agar admin dapat mengelola kegiatan lewat dashboard web.

export const MENU_PBB = `💰 *INFORMASI PAJAK PBB*
━━━━━━━━━━━━━━━━━━━━━━━

*Tentang SPPT PBB:*
SPPT (Surat Pemberitahuan Pajak Terutang) adalah dokumen tagihan PBB tahunan.

📅 *Jadwal Distribusi SPPT:*
Biasanya dibagikan antara bulan Maret-April setiap tahun melalui RT/RW setempat.

💳 *Cara Pembayaran PBB:*
✅ Melalui Bank Sumut
✅ Melalui ATM (dengan kode bayar SPPT)
✅ Indomaret / Alfamart (tunjukkan SPPT)
✅ Kantor Pos terdekat
✅ Aplikasi mobile banking

📍 *Lokasi Pembayaran Terdekat:*
Kantor Kelurahan masing-masing (pada periode tertentu)

📞 *Kontak Petugas PBB:*
Hubungi Kantor Kecamatan Medan Johor
📱 0813-6777-2047

⚠️ *Batas Pembayaran:* 31 Agustus setiap tahun (hindari denda!)

━━━━━━━━━━━━━━━━━━━━━━━
🏙️ *#MEDANUNTUKSEMUA*
Ketik *0* untuk kembali ke menu`;

export const MENU_KONTAK = `📞 *KONTAK & JAM PELAYANAN*
━━━━━━━━━━━━━━━━━━━━━━━

🏛️ *KANTOR KECAMATAN MEDAN JOHOR*
📍 Jl. Karya Cipta No. 16, Medan Johor
🗺️ https://maps.google.com/?q=Kantor+Kecamatan+Medan+Johor
📱 WhatsApp/Telp: *0813-6777-2047*
📧 Email: kec.medanjohor@pemkomedan.go.id
🌐 Website: *medanjohor.pemkomedan.go.id*

━━━━━━━━━━━━━━━━━━━━━━━
📱 *MEDIA SOSIAL:*

👤 Facebook  : *Kecamatan Medan Johor*
📸 Instagram : *@kec.medanjohor*

━━━━━━━━━━━━━━━━━━━━━━━
🕐 *JAM PELAYANAN:*
Senin - Kamis: 08.00 - 15.00 WIB
Jumat:          08.00 - 11.30 WIB
Sabtu - Minggu: TUTUP

━━━━━━━━━━━━━━━━━━━━━━━
🏘️ *KELURAHAN DI KECAMATAN MEDAN JOHOR:*

• Kel. Gedung Johor
• Kel. Pangkalan Masyhur
• Kel. Kwala Bekala
• Kel. Kedai Durian
• Kel. Suka Maju
• Kel. Titi Kuning

💡 Untuk kontak Kepling/RT/RW, hubungi kantor kelurahan setempat.

━━━━━━━━━━━━━━━━━━━━━━━
🏙️ *#MEDANUNTUKSEMUA*
Ketik *0* untuk kembali ke menu`;

export const MENU_PINTAR_JOHOR = `📚 *PINTAR JOHOR*
_Perpustakaan Interaktif Digital Rakyat Johor_
━━━━━━━━━━━━━━━━━━━━━━━

✨ *Inovasi Digital untuk Warga Medan Johor!*

🧠 *Apa itu Pintar Johor?*
Pintar Johor adalah platform perpustakaan digital interaktif pertama milik Kecamatan Medan Johor — dirancang untuk mencerdaskan warga dengan cara yang mudah, menyenangkan, dan bisa diakses dari mana saja, kapan saja!

📖 *Fitur Unggulan:*
📰 Baca artikel & berita lokal terkini
🎓 Materi edukasi warga & kesehatan
📋 Informasi program & kebijakan kecamatan
💡 Tips kehidupan sehari-hari
🏛️ Arsip sejarah & budaya Medan Johor
🔍 Pencarian cerdas berbasis AI

🌟 *Mengapa Pintar Johor?*
✅ Gratis untuk seluruh warga Johor
✅ Bisa diakses via HP maupun komputer
✅ Konten terus diperbarui
✅ Ramah untuk semua usia

━━━━━━━━━━━━━━━━━━━━━━━
🌐 *Akses Sekarang:*
🔗  https://bit.ly/pintarjohor

━━━━━━━━━━━━━━━━━━━━━━━
🏙️ *#MEDANUNTUKSEMUA | #PINTARJOHOR*
_Warga Cerdas, Kecamatan Maju!_
Ketik *0* untuk kembali ke menu`;

export const MENU_PROGRAM = `🌟 *PROGRAM UNGGULAN KECAMATAN MEDAN JOHOR*
━━━━━━━━━━━━━━━━━━━━━━━

♻️ *RELASI JOHOR*
(Relawan Sampah Liar Johor)
Program penanganan sampah liar berbasis komunitas.
Warga dapat melaporkan titik sampah liar untuk ditindaklanjuti.

🛡️ *SIGAP JOHOR*
(Sistem Gerak Cepat Pengamanan Johor)
Sistem keamanan lingkungan yang melibatkan seluruh warga untuk merespons gangguan keamanan secara cepat.

🏪 *UMKM BINAAN KECAMATAN MEDAN JOHOR*
Pendampingan dan pelatihan bagi pelaku usaha mikro, kecil, dan menengah di wilayah Kecamatan Medan Johor.
Ketik *12* di menu utama untuk melihat direktori lengkap UMKM binaan.

🕌 *SAHABAT JUMAT*
_(Silaturahmi dan Aspirasi Bersama Aparatur Johor untuk Ummat)_
_"Dengar Umat, Gerak Cepat."_

Program kehadiran langsung Camat dan jajaran aparatur kecamatan secara bergilir di masjid-masjid se-Kecamatan Medan Johor setiap hari Jumat — menyerap aspirasi warga secara langsung, humanis, dan ditindaklanjuti secara cepat dan terukur.

📌 *Fokus aspirasi:*
› Kebersihan & sampah
› Keamanan lingkungan
› Infrastruktur
› Pelayanan administrasi
› Program sosial keagamaan

⚡ Setiap aspirasi direkap mingguan dan ditindaklanjuti dalam ≤14 hari.

📚 *PINTAR JOHOR*
(Perpustakaan Interaktif Digital Rakyat Johor)
Platform literasi digital pertama Kecamatan Medan Johor. Warga dapat mengakses artikel, materi edukasi, informasi program, dan konten bermanfaat lainnya secara gratis dari HP atau komputer.
🔗 https://bit.ly/pintarjohor

━━━━━━━━━━━━━━━━━━━━━━━
📞 Info lebih lanjut:
📱 0813-6777-2047
🌐 medanjohor.pemkomedan.go.id
📸 Instagram: @kec.medanjohor

🏙️ *#MEDANUNTUKSEMUA*
Ketik *0* untuk kembali ke menu`;

// ═══════════════════════════════════════════════
//   MENU PARIWISATA - Wisata Kecamatan Medan Johor
// ═══════════════════════════════════════════════

export const MENU_PARIWISATA = `🗺️ *WISATA KECAMATAN MEDAN JOHOR*
━━━━━━━━━━━━━━━━━━━━━━━

Pilih kategori wisata:

🍜 *W1* — Kuliner Khas Medan Johor
🎡 *W2* — Hiburan, Rekreasi & Taman
🕌 *W3* — Wisata Religi
🏥 *W4* — Fasilitas Kesehatan

━━━━━━━━━━━━━━━━━━━━━━━
Ketik *W1 / W2 / W3 / W4* untuk detail
Atau ketik *0* untuk kembali ke menu

🏙️ *#MEDANUNTUKSEMUA*`;

export const WISATA = {
  W1: `🍜 *KULINER KHAS MEDAN JOHOR*
━━━━━━━━━━━━━━━━━━━━━━━

Nikmati cita rasa terbaik di Kecamatan Medan Johor!

🍜 *Simpul Kota*
   📍 Komplek J City, Jl. Karya Wisata, Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/Xsp5AesYUkjFiq4D9
   ⏰ Buka:  24JAM
   💬 Comfy place buat warga Medan Johor, wajib dicoba!

🍛 *Tenank*
   📍 GMFC+89C, Gg. Eka Mulia, Gedung Johor, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/daHQf8ZQKaEoS86B7
   ⏰ Buka: 11.00 - 22.00WIB
   💬 Cafe dengan tema pantai di tengah Kota Medan!

🍲 *Comel Tropical Drink*
   📍 Samping Asrama Haji, Jl. Jenderal Besar A.H. Nasution, Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/W2aV8RFBHznGyP5P7
   ⏰ Buka: 16.00 – 21.00 WIB
   💬 Tempat bagus nyaman dengan suasana asik!

🥩 *J - Walk Park*
   📍 Komplek J City, Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/a76SaegTeLL7eiWk7
   ⏰ Buka: 09.00 – 23.00 WIB
   💬 Cocok untuk tempat nongki untuk semua kalangan umur!

🍢 *Alun Alun*
   📍 Jl. Karya Wisata No.26, Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/nohPJKagtmrnuW738
   ⏰ Buka: 10.00 – 22.00 WIB
   💬 Resto dengan set gaya taman dan rumah kayu, sangat nyaman!

🫓 *Kilat Kuphi*
   📍 Jl. Karya Kasih No.26e, Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/AB5XMhaG1vi2ij676
   ⏰ Buka: 07.30 – 02.00 WIB
   💬 Tempat nongkrong yang recommended banget di Medan Johor!

━━━━━━━━━━━━━━━━━━━━━━━
🏙️ *#MEDANUNTUKSEMUA*
Ketik *0* untuk kembali ke menu`,

  W2: `🎡 *HIBURAN, REKREASI & TAMAN MEDAN JOHOR*
━━━━━━━━━━━━━━━━━━━━━━━

Destinasi hiburan & ruang terbuka untuk keluarga!

🌳 *Taman Cadika Pramuka*
   📍 Jl. Karya Wisata, Pangkalan Masyhur
   🗺️ https://maps.google.com/?q=3.529949,98.662668
   ⏰ Buka: 06.00 – 18.00 WIB
   💰 Tiket: Rp 3.000
   💬 Danau, jogging track, kuda, kano, BMX, spot foto & area bermain anak

🏊 *Kolam Renang Citra Wisata*
   📍 Lokasi: GMJ6+V8X, Pangkalan Masyhur, Kec. Medan Johor, Kota Medan, Sumatera Utara 20146
   🗺️ https://maps.app.goo.gl/Fx82wXb4uvzm3aEw7
   ⏰ Buka: 06.00 – 17.00 WIB
   💰 Tiket: Senin-Jumat: Rp. 10.000, Sabtu dan Minggu: Rp. 15.000.
   💬 Kolam renang keluarga, tersedia kolam anak

🌿 *RTH Pangkalan Masyhur*
   📍 Jl. Karya Wisata, Pangkalan Masyhur
   🗺️ https://maps.google.com/?q=RTH+Pangkalan+Masyhur+Medan+Johor
   ⏰ Buka setiap hari
   💰 Gratis
   💬 Ruang Terbuka Hijau, cocok untuk piknik keluarga

🌱 *Taman Lingkungan Suka Maju*
   📍 Komplek Perumahan Suka Maju
   🗺️ https://maps.google.com/?q=Perumahan+Suka+Maju+Medan+Johor
   ⏰ Buka setiap hari
   💰 Gratis
   💬 Taman bermain anak, area santai warga perumahan

🌊 *Danau & Area Hijau Kwala Bekala*
   📍 Jl. Letjend Djamin Ginting, Kwala Bekala
   🗺️ https://maps.google.com/?q=Danau+Kwala+Bekala+Medan+Johor
   ⏰ Pagi - Sore hari
   💬 Pemandangan asri, spot foto natural, area jogging

🏞️ *Jalur Hijau Jl. Karya Jaya*
   📍 Sepanjang Jl. Karya Jaya, Suka Maju
   🗺️ https://maps.google.com/?q=Jl+Karya+Jaya+Suka+Maju+Medan+Johor
   💬 Jalur pedestrian teduh, pepohonan rindang sepanjang jalan

━━━━━━━━━━━━━━━━━━━━━━━
💡 Jaga kebersihan taman untuk kenyamanan bersama!

🏙️ *#MEDANUNTUKSEMUA*
Ketik *0* untuk kembali ke menu`,

  W3: `🕌 *WISATA RELIGI MEDAN JOHOR*
━━━━━━━━━━━━━━━━━━━━━━━

Destinasi ibadah dan wisata religi:

🕌 *Masjid An-Nazhirin*
   📍 Jl. Eka Warni, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/rW5CuBB7pLDTeypF7
   💬 Masjid aktif, pusat kajian & program Tahfiz Quran

🕌 *Masjid Baiturrahman*
   📍 Jl. Karya Wisata, Komp. Johor Indah Permai I, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/Ptk4ZG5PfeKHtVRT8
   💬 Terbaik ketiga Masjid Mandiri Kota Medan, program sosial aktif

🕌 *Masjid Al-Badar*
   📍 Jl. Karya Darma No.19, Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/Cw77RsLjhBHxUwrY8
   💬 Masjid warga Pangkalan Masyhur, kegiatan pengajian rutin

🕌 *Masjid Al-Muslimin*
   📍 Kel. Suka Maju, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/nNdKE8UDERR45vTk7
   💬 Pusat ibadah dan kegiatan keagamaan warga Suka Maju

🕌 *Masjid Al-Munawwaroh*
   📍 Kel. Suka Maju, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/HaeNAzwEQR3Vu5nLA
   💬 Masjid aktif, kegiatan Safari Ramadan & sosial kemasyarakatan

⛪ *Gereja Katolik Stasi Santo Yosef*
   📍 Jl. Karya Murni Kav 01, Kel. Gedung Johor, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/uuQoDthkNZ8Qupyv8
   ⏰ Misa: Minggu 07.30 WIB
   💬 Gereja Katolik Stasi, Paroki Padang Bulan Keuskupan Agung Medan

⛪ *Gereja HKBP Gedung Johor*
   📍 Jl. A.H. Nasution (Gang Horas), Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/HQjs64zeyFyMgkLK9
   💬 Gereja HKBP Resort Medan Johor, aktif kegiatan jemaat

⛪ *GKSI My Home Medan*
   📍 Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/hWG8jMcozLm1kDAg9
   💬 Gereja Kristen Setia Indonesia, terbuka untuk jemaat

⛪ *Gereja GKPI Johor Indah*
   📍 Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/MtBzkHJMBZNsdsRQ8
   ⏰ Ibadah: Minggu 07.00 WIB
   💬 Gereja GKPI, berdiri sejak 1982, aktif melayani jemaat

━━━━━━━━━━━━━━━━━━━━━━━
💡 Mohon jaga ketertiban & kesopanan saat berkunjung

🏙️ *#MEDANUNTUKSEMUA*
Ketik *0* untuk kembali ke menu`,

  W4: `🏥 *FASILITAS KESEHATAN MEDAN JOHOR*
━━━━━━━━━━━━━━━━━━━━━━━

Fasilitas kesehatan di Kecamatan Medan Johor:

🏥 *RSU Mitra Sejati*
   📍 Jl. Jenderal Besar A.H. Nasution No.7, Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/T1XgStek2ZTceFj58
   ⏰ Buka: 24 Jam (IGD & Rawat Inap)
   📞 (061) 7875967
   💬 Rumah sakit swasta, dokter spesialis, IGD 24 jam

🏨 *Puskesmas UPT Medan Johor*
   📍 Jl. Karya Jaya No.29B, Pangkalan Masyhur, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/9RKT2uU62zkbbPmm7
   ⏰ Senin - Kamis: 08.00 – 14.00 WIB
   ⏰ Jumat: 08.00 – 11.00 WIB
   📞 (061) 75041273
   💰 Gratis (peserta BPJS)
   💬 Layanan kesehatan dasar, KIA, imunisasi & KB

🏨 *Puskesmas Gedung Johor*
   📍 Jl. Karya Jaya No.248, Kel. Gedung Johor, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/Bp7wSx8C1TktmGfW6
   ⏰ Senin - Kamis: 08.00 – 14.00 WIB
   ⏰ Jumat: 08.00 – 11.00 WIB
   💰 Gratis (peserta BPJS)
   💬 Layanan kesehatan dasar untuk warga Gedung Johor

🏨 *Pustu Kwala Bekala*
   📍 Kel. Kwala Bekala, Kec. Medan Johor
   🗺️ https://maps.app.goo.gl/tqt6n66HbFBccuCr9
   ⏰ Senin - Jumat: 08.00 – 14.00 WIB
   💰 Gratis (peserta BPJS)
   💬 Puskesmas Pembantu, layanan kesehatan dasar warga Kwala Bekala

━━━━━━━━━━━━━━━━━━━━━━━
🆘 *Darurat Medis?* Hubungi *119* (gratis 24 jam)

🏙️ *#MEDANUNTUKSEMUA*
Ketik *0* untuk kembali ke menu`,

};

// Kategori pengaduan
export const KATEGORI_PENGADUAN = [
  { id: '1', label: 'Sampah Liar', emoji: '🗑️' },
  { id: '2', label: 'Gangguan Ketertiban', emoji: '⚠️' },
  { id: '3', label: 'Lampu Jalan Mati', emoji: '💡' },
  { id: '4', label: 'Drainase Tersumbat', emoji: '🌊' },
  { id: '5', label: 'Administrasi Pelayanan', emoji: '📋' },
  { id: '6', label: 'Bangunan Liar', emoji: '🏚️' },
  { id: '7', label: 'Orang Terlantar / ODGJ', emoji: '🫂' },
  { id: '8', label: 'Lainnya', emoji: '📌' },
];

export const KELURAHAN_LIST = [
  { id: '1', label: 'Gedung Johor' },
  { id: '2', label: 'Pangkalan Masyhur' },
  { id: '3', label: 'Kwala Bekala' },
  { id: '4', label: 'Kedai Durian' },
  { id: '5', label: 'Suka Maju' },
  { id: '6', label: 'Titi Kuning' },
];

export const buildKategoriMenu = () => {
  let text = `📢 *PENGADUAN MASYARAKAT*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `Pilih *kategori* pengaduan Anda:\n\n`;
  for (const k of KATEGORI_PENGADUAN) {
    text += `${k.emoji} *${k.id}* — ${k.label}\n`;
  }
  text += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Ketik *angka* kategori (1-${KATEGORI_PENGADUAN.length})\nAtau ketik *0* untuk batal`;
  return text;
};

export const buildKelurahanMenu = () => {
  let text = `🏘️ *PILIH KELURAHAN*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `Lokasi kejadian berada di kelurahan mana?\n\n`;
  for (const k of KELURAHAN_LIST) {
    text += `*${k.id}* — ${k.label}\n`;
  }
  text += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Ketik *angka* kelurahan (1-6)\nAtau ketik *0* untuk batal`;
  return text;
};

/**
 * Build pesan WhatsApp untuk direktori UMKM Binaan.
 * @param {Array<{id,nama,alamat,mapsUrl,kategori,kontak}>} umkmList
 * @param {number} page - halaman (1-based), tiap halaman 5 item
 */
export const buildUmkmMenu = (umkmList, page = 1) => {
  const PAGE_SIZE = 5;
  const total = umkmList.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const items = umkmList.slice(start, start + PAGE_SIZE);

  let text = `🏪 *UMKM BINAAN KECAMATAN MEDAN JOHOR*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (total === 0) {
    text += `📭 *Belum ada data UMKM yang tersedia.*\n\n`;
    text += `Hubungi Kantor Kecamatan Medan Johor untuk informasi lebih lanjut.\n`;
  } else {
    text += `📊 Total: *${total} UMKM* terdaftar`;
    if (totalPages > 1) text += ` (halaman ${safePage}/${totalPages})`;
    text += `\n\n`;

    items.forEach((u, i) => {
      const no = start + i + 1;
      text += `*${no}. ${u.nama}*\n`;
      if (u.kategori) text += `   🏷️ ${u.kategori}\n`;
      if (u.alamat)   text += `   📍 ${u.alamat}\n`;
      if (u.kontak)   text += `   📱 ${u.kontak}\n`;
      if (u.mapsUrl)  text += `   🗺️ ${u.mapsUrl}\n`;
      text += `\n`;
    });

    if (totalPages > 1) {
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
      if (safePage < totalPages) text += `Ketik *umkm${safePage + 1}* untuk halaman berikutnya\n`;
      if (safePage > 1)          text += `Ketik *umkm${safePage - 1}* untuk halaman sebelumnya\n`;
    }
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📞 Info & pendaftaran UMKM:\n`;
  text += `*Kantor Kecamatan Medan Johor*\n`;
  text += `📱 0813-6777-2047\n\n`;
  text += `🏙️ *#MEDANUNTUKSEMUA*\n`;
  text += `Ketik *0* untuk kembali ke menu`;
  return text;
};
