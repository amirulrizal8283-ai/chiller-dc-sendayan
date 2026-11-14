# Data Movement Chiller — DXN DC Sendayan
Dashboard live (paparan sahaja) bagi semua pergerakan stok cendawan dan baki terkini dalam chiller.

## Sumber data
Dashboard membaca terus 4 fail Google Sheet yang diisi oleh staf melalui portal **Data Center DC Sendayan**. Setiap isian di portal akan dipaparkan dalam masa ±60 saat.

| Arah | Jenis | Fail | Nilai yang dikira |
|---|---|---|---|
| MASUK | Harvest Sendayan | Harvest Cendawan Harian (MUSHROOM DATA HARVEST DC SENDAYAN DASHBOARD 2026) | NET (KG) harian setiap shedhouse, lokasi TKPM Sendayan |
| MASUK | Terima Farm Luar | QC Receiving Other Farm | Jumlah terima selepas reject (lajur K) |
| KELUAR | Stok Keluar | QC Stock Out | 1KG + 200G (pek × 0.2) + 500G (pek × 0.5) |
| KELUAR | RND / Sampel / Gift | QC Stock Issue | Berat (kg) |
| KELUAR | Proses Kering | QC Stock Issue | Berat sebelum kering |
| KELUAR | Sisa / Waste | QC Stock Issue | Total waste (kg) |

**Formula (carry forward):**
- Baki C/F = Baki B/F + Masuk − Keluar ± Pelarasan kiraan fizikal
- Baki C/F akhir bulan = Baki B/F awal bulan berikutnya
- Dikira hari demi hari sejak `TARIKH_MULA` (1 Ogos 2026, baki pembukaan = C/F Julai daripada fail Daily Data Movement EO 2026), jadi baki setiap bulan sentiasa bersambung.

## Pemasangan di GitHub Pages (±10 minit)
1. Log masuk GitHub (akaun `amirulrizal8283-ai`), tekan **New repository**, namakan `chiller-dc-sendayan`, pilih **Public**, tekan **Create repository**.
2. Tekan **uploading an existing file**, kemudian muat naik **kesemua 10 fail** (jika repo sudah wujud: tekan **Add file › Upload files**, muat naik semula `index.html`, `config.js`, `enjin.js`, `sw.js`, dan fail lama akan diganti): `index.html`, `config.js`, `enjin.js`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `logo.jpg`, `PANDUAN.md`. Tekan **Commit changes**.
3. Tekan **Settings › Pages**. Di *Source*, pilih **Deploy from a branch**, branch **main**, folder **/(root)**, tekan **Save**.
4. Selepas 1–2 minit, pautan akan dipaparkan: `https://amirulrizal8283-ai.github.io/chiller-dc-sendayan/`

## Pasang sebagai aplikasi telefon
- **Android (Chrome):** buka pautan › tekan menu ⋮ › **Add to Home screen / Install app**.
- **iPhone (Safari):** buka pautan › tekan ikon Kongsi › **Add to Home Screen**.

## Tetapan (fail `config.js` sahaja)
- `TARIKH_MULA` — tarikh mula pengiraan baki.
- `BAKI_AWAL` — baki chiller (kg) bagi setiap lokasi pada pagi TARIKH_MULA. Kini diisi dengan C/F Julai 2026 daripada fail Daily Data Movement EO 2026 (TKPM 208.7, Rokan 137.6, Semenyih 119.6).
- `KIRAAN_FIZIKAL` — senarai kiraan stok fizikal (stock take). Pada tarikh kiraan, baki sistem ditetapkan kepada baki fizikal dan bezanya dipaparkan sebagai **Pelarasan (varians)**. Contoh:
  ```js
  KIRAAN_FIZIKAL: [
    { tarikh: '2026-11-05', baki: { 'TKPM SENDAYAN': 85.5, 'BUKIT ROKAN': 40, 'SEMENYIH': 12, 'BINJAI': 0 }, catatan: 'Stock take bulanan' },
  ],
  ```
- `SEGAR_LAMA_MINIT` — bulan lama (sebelum bulan lepas) dibaca semula setiap 15 minit.
- `SEGAR_SAAT` — kekerapan muat semula (lalai 60 saat).

Untuk mengubah: di GitHub, buka `config.js` › ikon pensel › ubah nilai › **Commit changes**.

## Syarat
Keempat-empat fail Google Sheet mesti kekal dikongsi **Anyone with the link — Viewer**. Jika akses ditarik balik, dashboard akan memaparkan "Luar talian" dan data terakhir yang disimpan.
