/* ==========================================================================
 *  KONFIGURASI — DATA MOVEMENT CHILLER DC SENDAYAN
 *  Ubah fail ini sahaja. Kod aplikasi (index.html, enjin.js) tidak perlu disentuh.
 * ========================================================================== */
window.KONFIG = {
  NAMA_APP: 'Data Movement Chiller',
  LOKASI_APP: 'DXN DC Sendayan',

  /* Tarikh mula pengiraan baki (YYYY-MM-DD).
     Semua pergerakan SEBELUM tarikh ini diabaikan. */
  TARIKH_MULA: '2026-10-01',

  /* Baki fizikal dalam chiller pada TARIKH_MULA (kg), mengikut lokasi stok.
     Isi selepas kiraan stok fizikal (stock count). Biarkan 0 jika tiada. */
  BAKI_AWAL: {
    'TKPM SENDAYAN': 0,
    'BUKIT ROKAN': 0,
    'SEMENYIH': 0,
    'BINJAI': 0,
    'LAIN-LAIN': 0
  },

  /* Kekerapan muat semula data (saat). */
  SEGAR_SAAT: 60,

  /* Fail sumber — fail yang sama diisi oleh staf melalui portal Data Center DC Sendayan.
     Fail mesti dikongsi "Anyone with the link — Viewer". */
  FAIL: {
    REJECT:    { id: '1xkjHKNN_RKkQneYgYqsJGlppU_gWLCEckcDyaBGKdiY', nama: 'QC Reject Detail Harvest',  format: 'BM' },
    RECEIVING: { id: '1-k4ifNsH_thfq1yzYqbbK-pymiHLsJSq2JePl43RhTE', nama: 'QC Receiving Other Farm', format: 'Tajuk' },
    STOCKOUT:  { id: '1peU8oh5xxYp0o8aj-0Puscw2am2mYAXRls_olpVwxjA', nama: 'QC Stock Out',            format: 'BM TAHUN' },
    ISSUE:     { id: '1oNwLPI_SNxt3hSPi05gxiNtu_49RL9Z0e9i999UALIo', nama: 'QC Stock Issue',          format: 'BM' }
  }
};
