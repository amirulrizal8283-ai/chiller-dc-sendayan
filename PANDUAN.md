# Data Movement Chiller — DXN DC Sendayan
Dashboard live (paparan sahaja) bagi semua pergerakan stok cendawan dan baki terkini dalam chiller.

## Sumber data
Dashboard membaca terus 4 fail Google Sheet yang diisi oleh staf melalui portal **Data Center DC Sendayan**. Setiap isian di portal akan dipaparkan dalam masa ±60 saat.

| Arah | Jenis | Fail | Nilai yang dikira |
|---|---|---|---|
| MASUK | Harvest Sendayan | QC Reject Detail Harvest | Berat bersih selepas reject (lajur C), lokasi TKPM Sendayan |
| MASUK | Terima Farm Luar | QC Receiving Other Farm | Jumlah terima selepas reject (lajur K) |
| KELUAR | Stok Keluar | QC Stock Out | 1KG + 200G (pek × 0.2) + 500G (pek × 0.5) |
| KELUAR | RND / Sampel / Gift | QC Stock Issue | Berat (kg) |
| KELUAR | Proses Kering | QC Stock Issue | Berat sebelum kering |
| KELUAR | Sisa / Waste | QC Stock Issue | Total waste (kg) |

**Formula:** Baki = Baki Awal + Masuk − Keluar

## Pemasangan di GitHub Pages (±10 minit)
1. Log masuk GitHub (akaun `amirulrizal8283-ai`), tekan **New repository**, namakan `chiller-dc-sendayan`, pilih **Public**, tekan **Create repository**.
2. Tekan **uploading an existing file**, kemudian muat naik **kesemua 8 fail**: `index.html`, `config.js`, `enjin.js`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `PANDUAN.md`. Tekan **Commit changes**.
3. Tekan **Settings › Pages**. Di *Source*, pilih **Deploy from a branch**, branch **main**, folder **/(root)**, tekan **Save**.
4. Selepas 1–2 minit, pautan akan dipaparkan: `https://amirulrizal8283-ai.github.io/chiller-dc-sendayan/`

## Pasang sebagai aplikasi telefon
- **Android (Chrome):** buka pautan › tekan menu ⋮ › **Add to Home screen / Install app**.
- **iPhone (Safari):** buka pautan › tekan ikon Kongsi › **Add to Home Screen**.

## Tetapan (fail `config.js` sahaja)
- `TARIKH_MULA` — tarikh mula pengiraan baki.
- `BAKI_AWAL` — baki fizikal chiller (kg) bagi setiap lokasi pada tarikh mula. **Wajib diisi selepas kiraan stok fizikal**, jika tidak baki akan bermula dari 0.
- `SEGAR_SAAT` — kekerapan muat semula (lalai 60 saat).

Untuk mengubah: di GitHub, buka `config.js` › ikon pensel › ubah nilai › **Commit changes**.

## Syarat
Keempat-empat fail Google Sheet mesti kekal dikongsi **Anyone with the link — Viewer**. Jika akses ditarik balik, dashboard akan memaparkan "Luar talian" dan data terakhir yang disimpan.
