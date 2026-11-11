/* ==========================================================================
 *  KONFIGURASI — DATA MOVEMENT CHILLER DC SENDAYAN
 *  Ubah fail ini sahaja. Kod aplikasi (index.html, enjin.js) tidak perlu disentuh.
 * ========================================================================== */
window.KONFIG = {
  NAMA_APP: 'Data Movement Chiller',
  LOKASI_APP: 'DXN DC Sendayan',

  /* Tarikh mula pengiraan (YYYY-MM-DD). Baki dibawa ke hadapan (carry forward)
     hari demi hari dan bulan demi bulan dari tarikh ini hingga hari ini. */
  TARIKH_MULA: '2026-08-01',

  /* Baki dalam chiller pada pagi TARIKH_MULA (kg), mengikut lokasi stok.
     SUMBER: fail "DAILY DATA MOVEMENT EO 2026 - INTERACTIVE DASHBOARD", tab DASHBOARD DATA,
     CLOSING (KG) bulan JULY 2026. Julai ialah bulan terakhir yang direkod lengkap dalam fail EO
     dan disahkan sepadan dengan fail QC (Received, Reject dan Used sama).
     Baki ini sudah mengambil kira write-off WASTE / RETURN yang direkod dalam fail EO. */
  BAKI_AWAL: {
    'TKPM SENDAYAN': 208.7,
    'BUKIT ROKAN': 137.6,
    'SEMENYIH': 119.6,
    'BINJAI': 0,
    'LAIN-LAIN': 0
  },
  SUMBER_BAKI_AWAL: 'C/F Julai 2026 — Daily Data Movement EO 2026',

  /* KIRAAN STOK FIZIKAL (stock take) — sangat disyorkan sekurang-kurangnya sebulan sekali.
     Kiraan dibuat pada AKHIR hari operasi. Pada tarikh itu baki sistem ditetapkan kepada
     baki fizikal, dan bezanya dipaparkan sebagai PELARASAN (varians) untuk jejak audit.
     Lokasi yang tidak disenaraikan tidak dilaraskan.
     Contoh:
       { tarikh: '2026-11-05', baki: { 'TKPM SENDAYAN': 85.5, 'BUKIT ROKAN': 40, 'SEMENYIH': 12, 'BINJAI': 0 },
         catatan: 'Stock take bulanan oleh PIC QC' },
  */
  KIRAAN_FIZIKAL: [
  ],

  /* Kekerapan muat semula data bulan semasa & bulan lepas (saat). */
  SEGAR_SAAT: 60,
  /* Bulan yang lebih lama dibaca semula setiap (minit) — data lama jarang berubah. */
  SEGAR_LAMA_MINIT: 15,

  /* Fail sumber — fail yang sama diisi oleh staf melalui portal Data Center DC Sendayan.
     Fail mesti dikongsi "Anyone with the link — Viewer". */
  FAIL: {
    REJECT:    { id: '1xkjHKNN_RKkQneYgYqsJGlppU_gWLCEckcDyaBGKdiY', nama: 'QC Reject Detail Harvest',  format: 'BM' },
    RECEIVING: { id: '1-k4ifNsH_thfq1yzYqbbK-pymiHLsJSq2JePl43RhTE', nama: 'QC Receiving Other Farm', format: 'Tajuk' },
    STOCKOUT:  { id: '1peU8oh5xxYp0o8aj-0Puscw2am2mYAXRls_olpVwxjA', nama: 'QC Stock Out',            format: 'BM TAHUN' },
    ISSUE:     { id: '1oNwLPI_SNxt3hSPi05gxiNtu_49RL9Z0e9i999UALIo', nama: 'QC Stock Issue',          format: 'BM' }
  }
};
