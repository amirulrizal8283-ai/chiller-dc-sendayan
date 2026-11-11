/* ==========================================================================
 *  ENJIN DATA MOVEMENT CHILLER — DXN DC SENDAYAN
 *  Membaca 4 fail Google Sheet (gviz CSV), menukar setiap baris kepada satu
 *  rekod pergerakan (MASUK / KELUAR, kg) dan mengira baki chiller.
 *
 *  Formula:  BAKI = BAKI AWAL + Σ MASUK − Σ KELUAR
 *  MASUK  : Harvest Sendayan (bersih selepas reject) + Terima Farm Luar (bersih)
 *  KELUAR : Stok Keluar (1KG + 200G + 500G) + RND/Sampel/Gift + Proses Kering + Sisa/Waste
 * ========================================================================== */
(function (root) {
  'use strict';

  const BULAN_BM = ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'];
  const BULAN_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const BULAN_PENDEK = ['JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'OGO', 'SEP', 'OKT', 'NOV', 'DIS'];
  const tajukKes = s => s.charAt(0) + s.slice(1).toLowerCase();

  const JENIS = {
    HARVEST: 'Harvest Sendayan',
    TERIMA: 'Terima Farm Luar',
    JUALAN: 'Stok Keluar',
    RND: 'RND / Sampel / Gift',
    KERING: 'Proses Kering',
    SISA: 'Sisa / Waste'
  };
  const LOKASI_TETAP = ['TKPM SENDAYAN', 'BUKIT ROKAN', 'SEMENYIH', 'BINJAI', 'LAIN-LAIN'];

  /* ---------- Utiliti ---------- */
  function csv(teks) {
    const baris = []; let r = [], s = '', q = false;
    for (let i = 0; i < teks.length; i++) {
      const c = teks[i];
      if (q) {
        if (c === '"') { if (teks[i + 1] === '"') { s += '"'; i++; } else q = false; }
        else s += c;
      } else if (c === '"') q = true;
      else if (c === ',') { r.push(s); s = ''; }
      else if (c === '\n') { r.push(s); baris.push(r); r = []; s = ''; }
      else if (c !== '\r') s += c;
    }
    if (s !== '' || r.length) { r.push(s); baris.push(r); }
    return baris;
  }

  function nombor(x) {
    if (x === null || x === undefined) return NaN;
    const s = String(x).replace(/,/g, '').replace(/kg/i, '').trim();
    if (s === '' || s === '-') return NaN;
    if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
    return parseFloat(s);
  }
  const n0 = x => { const v = nombor(x); return isNaN(v) ? 0 : v; };

  /** 'd/m/yyyy', 'dd-mm-yyyy', 'yyyy-mm-dd' → 'YYYY-MM-DD' (null jika bukan tarikh sah) */
  function tarikh(x) {
    if (!x) return null;
    const s = String(x).trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})$/);
    let y, mo, d;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
    else if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else return null;
    if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function lokasi(x) {
    const s = String(x || '').toUpperCase().trim();
    if (!s) return '';
    if (/TKPM|SENDAYAN/.test(s)) return 'TKPM SENDAYAN';
    if (/ROKAN/.test(s)) return 'BUKIT ROKAN';
    if (/SEMENYIH/.test(s)) return 'SEMENYIH';
    if (/BINJAI/.test(s)) return 'BINJAI';
    if (/^FARM$|JITRA|LAIN/.test(s)) return 'LAIN-LAIN';
    return s;
  }
  const bulat = v => Math.round(v * 100) / 100;

  /* ---------- Nama tab bagi setiap bulan ---------- */
  function calonTab(format, tahun, b) {
    const bm = BULAN_BM[b], en = BULAN_EN[b];
    const asas = {
      'BM': [bm, tajukKes(bm), en, BULAN_PENDEK[b]],
      'Tajuk': [tajukKes(bm), bm, tajukKes(en), en],
      'BM TAHUN': [bm + ' ' + tahun, tajukKes(bm) + ' ' + tahun, en + ' ' + tahun, bm]
    }[format] || [bm];
    return asas.filter((v, i, a) => a.indexOf(v) === i);
  }

  /* ---------- Tarikh dalam tab bulan ----------
   * Setiap tab mewakili satu bulan. Jika staf tersalah taip bulan/tahun (cth. "18/6/2026" dalam
   * tab Mei, atau "17/9/2023" dalam tab September), rekod TIDAK dibuang: hari dikekalkan, bulan
   * dan tahun diambil daripada tab, dan rekod dibenderakan untuk dibetulkan dalam fail asal.
   * Ini sama dengan cara ringkasan bulanan dalam fail sumber mengira (semua baris dalam tab).
   */
  function hariTerakhir(ym) { return new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(); }
  function tarikhTab(raw, ym, bolehKosong) {
    const t = tarikh(raw);
    if (t && t.slice(0, 7) === ym) return { t };
    if (t) {
      const d = Math.min(+t.slice(8, 10), hariTerakhir(ym));
      return { t: ym + '-' + String(d).padStart(2, '0'), isu: 'Tarikh "' + String(raw).trim() + '" berada di luar bulan tab; dikira sebagai ' + d + '/' + (+ym.slice(5, 7)) + '/' + ym.slice(0, 4) };
    }
    if (bolehKosong && String(raw || '').trim() === '') {
      const d = hariTerakhir(ym);
      return { t: ym + '-' + String(d).padStart(2, '0'), isu: 'Tarikh kosong; dikira pada hari terakhir bulan' };
    }
    return null;
  }

  /* ---------- Parser setiap fail ---------- */
  // 1. QC REJECT DETAIL HARVEST — A:Tarikh B:Shedhouse C:Bersih(kg) G:Jumlah reject H:Kasar
  function parseReject(rows, ym) {
    const out = [];
    rows.forEach((r, i) => {
      const shed = String(r[1] || '').trim();
      if (!shed) return;                                   // baris ringkasan tiada shedhouse
      const tt = tarikhTab(r[0], ym); if (!tt) return;
      const bersih = nombor(r[2]); if (isNaN(bersih)) return;
      const rej = n0(r[6]), kasar = n0(r[7]);
      if (bersih === 0 && rej === 0) return;
      out.push({ t: tt.t, isu: tt.isu, asal: r[0], arah: 'MASUK', jenis: JENIS.HARVEST, lokasi: 'TKPM SENDAYAN', kg: bersih, reject: rej, kasar,
        ket: 'Shedhouse ' + shed, kunci: tt.t + '|' + shed, baris: i + 1 });
    });
    return out;
  }

  // 2. QC RECEIVING OTHER FARM — A:Bil B:Tarikh C:Lokasi D:Terima kg F:200g kg J:Jumlah reject K:Bersih
  function parseReceiving(rows, ym) {
    const out = [];
    rows.forEach((r, i) => {
      if (isNaN(nombor(r[0]))) return;                    // baris rekod sentiasa ada No. Bil
      const lok = lokasi(r[2]); if (!lok) return;
      const tt = tarikhTab(r[1], ym); if (!tt) return;
      const terima = n0(r[3]), kg200 = n0(r[5]), rej = n0(r[9]);
      let bersih = nombor(r[10]);
      if (isNaN(bersih)) bersih = terima + kg200 - rej;
      if (bersih === 0 && terima === 0 && kg200 === 0) return;
      out.push({ t: tt.t, isu: tt.isu, asal: r[1], arah: 'MASUK', jenis: JENIS.TERIMA, lokasi: lok, kg: bersih, reject: rej, kasar: terima + kg200,
        ket: 'Terima ' + bulat(terima + kg200) + ' kg' + (rej ? ', reject ' + bulat(rej) + ' kg' : ''), kunci: tt.t + '|' + lok + '|' + bulat(terima + kg200), baris: i + 1 });
    });
    return out;
  }

  // 3. QC STOCK OUT — susunan kalendar, 5 blok × 6 lajur: Tarikh | Lokasi | 1KG | 200GM(PEK) | 200GM(KG) | 500GM(PEK)
  const LOKASI_STOCKOUT = ['TKPM', 'SEMENYIH', 'ROKAN', 'BINJAI', 'FARM'];
  function parseStockOut(rows, ym) {
    const out = [], semasa = {};
    rows.forEach((r, i) => {
      for (let b = 0; b * 6 + 1 < r.length; b++) {
        const c = b * 6;
        const t = tarikh(r[c]);
        if (t) semasa[b] = t;
        const label = String(r[c + 1] || '').toUpperCase().trim();
        if (LOKASI_STOCKOUT.indexOf(label) < 0 || !semasa[b]) continue;
        const tt = semasa[b];
        if (tt.slice(0, 7) !== ym) continue;
        const kg1 = n0(r[c + 2]), pek200 = n0(r[c + 3]), pek500 = n0(r[c + 5]);
        let kg200 = nombor(r[c + 4]); if (isNaN(kg200)) kg200 = pek200 * 0.2;
        const kg = kg1 + kg200 + pek500 * 0.5;
        if (kg <= 0) continue;
        const pecahan = [];
        if (kg1) pecahan.push('1KG: ' + kg1);
        if (pek200) pecahan.push('200G: ' + pek200 + ' pek');
        if (pek500) pecahan.push('500G: ' + pek500 + ' pek');
        out.push({ t: tt, arah: 'KELUAR', jenis: JENIS.JUALAN, lokasi: lokasi(label), kg: bulat(kg), ket: pecahan.join(' · '), baris: i + 1 });
      }
    });
    return out;
  }

  // 4. QC STOCK ISSUE — 3 jadual dalam satu tab: 1. RND/Sampel/Gift, 2. Pengeringan, 3. Sisa/Waste
  //    Dikecualikan (tidak ditolak daripada chiller, dipaparkan sebagai MAKLUMAT):
  //    • Jenis cendawan bukan tiram (cth. GANODERMA) — bukan stok chiller
  //    • Sisa pulangan Sales/pelanggan — stok itu sudah ditolak dalam QC Stock Out
  const BUKAN_CHILLER = /GANODERMA|LINGZHI|REISHI/i;
  const SISA_PULANGAN = /DARI SALES|DARI CUSTOMER|DARI PELANGGAN|SALES TAK JUAL|PULANGAN|RETURN/i;
  function parseIssue(rows, ym) {
    const out = []; let sek = null, ix = {};
    const cari = (r, label) => r.findIndex(x => String(x || '').trim().toUpperCase() === label);
    const cariMula = (r, awalan) => r.findIndex(x => String(x || '').trim().toUpperCase().indexOf(awalan) === 0);
    rows.forEach((r, i) => {
      // Kesan tajuk jadual. SISA mesti disemak dahulu kerana tajuknya juga mengandungi "Disediakan Oleh".
      if (cari(r, 'KATEGORI SISA') >= 0) {
        sek = 'SISA'; ix = { lok: cari(r, 'LOKASI STOK'), jc: cari(r, 'JENIS CENDAWAN'), ket: cari(r, 'KATEGORI SISA'),
          kg: cariMula(r, 'TOTAL WASTE'), sebab: cariMula(r, 'SEBAB'), rem: cari(r, 'REMARK') }; return; }
      if (cari(r, 'TUJUAN') >= 0) {
        sek = 'RND'; ix = { lok: cari(r, 'LOKASI STOK'), jc: cari(r, 'JENIS CENDAWAN'), ket: cari(r, 'TUJUAN'), kat: cari(r, 'KATEGORI'), kg: cariMula(r, 'KUANTITI') };
        if (ix.kg < 0) ix.kg = ix.ket + 1; return; }
      if (cari(r, 'DISEDIAKAN OLEH') >= 0 || cariMula(r, 'BERAT SEBELUM') >= 0) {
        sek = 'KERING'; ix = { lok: cari(r, 'LOKASI STOK'), jc: cari(r, 'JENIS CENDAWAN'), kg: cariMula(r, 'BERAT SEBELUM'), sel: cariMula(r, 'BERAT SELEPAS') };
        if (ix.kg < 0) ix.kg = ix.lok + 2; if (ix.sel < 0) ix.sel = ix.kg + 1; return; }
      if (/^\s*\d\.\s/.test(String(r[0] || ''))) return;     // baris tajuk seksyen "1. REKOD ..."
      if (!sek || ix.lok < 0 || ix.kg < 0) return;
      const kg = nombor(r[ix.kg]); if (isNaN(kg) || kg <= 0) return;
      const lokRaw = String(r[ix.lok] || '').trim();
      const tt = tarikhTab(r[0], ym, !!lokRaw); if (!tt) return;
      const lok = lokasi(lokRaw) || 'TKPM SENDAYAN';
      const jc = ix.jc >= 0 ? String(r[ix.jc] || '').trim() : '';
      let ket = '';
      if (sek === 'RND') ket = [ix.kat >= 0 ? r[ix.kat] : '', r[ix.ket]].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
      if (sek === 'KERING') ket = 'Selepas kering ' + (nombor(r[ix.sel]) || 0) + ' kg';
      if (sek === 'SISA') ket = [r[ix.ket], ix.sebab >= 0 ? r[ix.sebab] : '', ix.rem >= 0 ? r[ix.rem] : ''].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
      const rek = { t: tt.t, isu: tt.isu, asal: r[0], arah: 'KELUAR', jenis: JENIS[sek], lokasi: lok, kg, ket: (jc && !/TIRAM/i.test(jc) ? jc + ' · ' : '') + ket, baris: i + 1 };
      if (BUKAN_CHILLER.test(jc)) { rek.arah = 'MAKLUMAT'; rek.sebab = 'Bukan stok chiller (' + jc + ')'; }
      else if (sek === 'SISA' && SISA_PULANGAN.test(ket)) { rek.arah = 'MAKLUMAT'; rek.sebab = 'Sisa pulangan Sales/pelanggan — sudah ditolak dalam Stock Out'; }
      out.push(rek);
    });
    return out;
  }

  const PARSER = { REJECT: parseReject, RECEIVING: parseReceiving, STOCKOUT: parseStockOut, ISSUE: parseIssue };

  /* ---------- Muat turun ---------- */
  function urlGviz(id, tab) {
    return 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&headers=0&sheet=' +
      encodeURIComponent(tab) + '&t=' + Date.now();
  }

  /** Tab yang salah nama dikembalikan Google sebagai tab pertama (DASHBOARD). Kesan dan tolak. */
  function tabDashboard(teks) {
    return /DASHBOARD|RINGKASAN TAHUNAN/i.test(teks.slice(0, 600));
  }

  async function bacaBulan(fetcher, kod, fail, tahun, b, cacheTab) {
    const ym = tahun + '-' + String(b + 1).padStart(2, '0');
    const kunciCache = kod + ':' + ym;
    let calon = calonTab(fail.format, tahun, b);
    if (cacheTab && cacheTab[kunciCache]) calon = [cacheTab[kunciCache]].concat(calon.filter(c => c !== cacheTab[kunciCache]));
    for (const tab of calon) {
      const teks = await fetcher(urlGviz(fail.id, tab));
      const rows = csv(teks);
      const rekod = PARSER[kod](rows, ym);
      if (rekod.length || !tabDashboard(teks)) {
        if (cacheTab) cacheTab[kunciCache] = tab;
        rekod.forEach(x => { x.sumber = fail.nama; x.tab = tab; x.kod = kod; });
        return { ym, tab, rekod, jumpa: true };
      }
    }
    return { ym, tab: null, rekod: [], jumpa: false };
  }

  function senaraiBulan(mula, kini) {
    const out = []; let y = +mula.slice(0, 4), m = +mula.slice(5, 7) - 1;
    const yk = kini.getFullYear(), mk = kini.getMonth();
    while (y < yk || (y === yk && m <= mk)) { out.push([y, m]); m++; if (m > 11) { m = 0; y++; } }
    return out;
  }

  /**
   * Muat semua bulan dari TARIKH_MULA hingga bulan semasa.
   * Bulan semasa dan bulan lepas sentiasa dibaca semula (staf mungkin isi lewat).
   * Bulan lebih lama diambil dari cacheBulan jika umurnya < SEGAR_LAMA_MINIT,
   * supaya tidak membebankan Google dengan 40+ permintaan setiap minit.
   */
  async function muatSemua(cfg, fetcher, cacheTab, kini, cacheBulan) {
    kini = kini || new Date();
    const bulan = senaraiBulan(cfg.TARIKH_MULA, kini);
    const lepas = new Date(kini.getFullYear(), kini.getMonth() - 1, 1);
    const ymSegar = lepas.getFullYear() + '-' + String(lepas.getMonth() + 1).padStart(2, '0');
    const hadUmur = (cfg.SEGAR_LAMA_MINIT || 15) * 60000;
    const kerja = [];
    Object.keys(cfg.FAIL).forEach(kod => bulan.forEach(([y, b]) => {
      const ym = y + '-' + String(b + 1).padStart(2, '0');
      const k = kod + ':' + ym, c = cacheBulan && cacheBulan[k];
      if (ym < ymSegar && c && !c.ralat && (kini.getTime() - c.masa) < hadUmur) {
        kerja.push(Promise.resolve({ kod, ym, tab: c.tab, rekod: c.rekod, jumpa: !!c.tab, cache: true }));
        return;
      }
      kerja.push(bacaBulan(fetcher, kod, cfg.FAIL[kod], y, b, cacheTab)
        .then(r => { r.kod = kod; if (cacheBulan) cacheBulan[k] = { masa: kini.getTime(), tab: r.tab, rekod: r.rekod }; return r; })
        .catch(e => {
          // Gagal baca: guna cache lama (jika ada) supaya baki tidak melompat
          if (c) return { kod, ym, tab: c.tab, rekod: c.rekod, jumpa: !!c.tab, cache: true, amaran: String(e && e.message || e) };
          return { kod, ym, ralat: String(e && e.message || e), rekod: [] };
        }));
    }));
    const hasil = await Promise.all(kerja);
    const rekod = [].concat.apply([], hasil.map(h => h.rekod));
    return { hasil, rekod };
  }

  /* ---------- Pengiraan ---------- */
  /**
   * Baki dikira HARI DEMI HARI dari TARIKH_MULA (lalai 1 Jan 2026):
   *   Baki C/F hari ini = Baki B/F + Masuk − Keluar (+ Pelarasan kiraan fizikal)
   *   Baki C/F akhir bulan = Baki B/F awal bulan berikutnya (carry forward automatik)
   * Kiraan fizikal (KIRAAN_FIZIKAL dalam config.js) diambil pada AKHIR hari tersebut.
   * Pada tarikh itu baki sistem ditetapkan kepada baki fizikal, dan beza direkod sebagai
   * PELARASAN (varians) untuk jejak audit.
   */
  const tStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  function kira(cfg, rekodSemua, hariIni) {
    const mula = cfg.TARIKH_MULA;
    const dalamTempoh = rekodSemua.filter(r => r.t >= mula && r.t <= hariIni);
    const maklumat = dalamTempoh.filter(r => r.arah !== 'MASUK' && r.arah !== 'KELUAR');
    const isuTarikh = dalamTempoh.filter(r => r.isu);
    const rekod = dalamTempoh.filter(r => r.arah === 'MASUK' || r.arah === 'KELUAR')
      .sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : (a.arah === 'MASUK' ? -1 : 1));
    const kiraan = (cfg.KIRAAN_FIZIKAL || [])
      .map(k => Object.assign({}, k, { tarikh: tarikh(k.tarikh) || k.tarikh }))
      .filter(k => k.tarikh >= mula && k.tarikh <= hariIni && k.baki)
      .sort((a, b) => a.tarikh < b.tarikh ? -1 : 1);

    const lokasiSet = LOKASI_TETAP.slice();
    const tambahLok = l => { if (lokasiSet.indexOf(l) < 0) lokasiSet.push(l); };
    rekod.forEach(r => tambahLok(r.lokasi));
    kiraan.forEach(k => Object.keys(k.baki).forEach(l => tambahLok(lokasi(l) || l)));

    const ikutHari = {};
    rekod.forEach(r => (ikutHari[r.t] || (ikutHari[r.t] = [])).push(r));
    const kiraanHari = {};
    kiraan.forEach(k => kiraanHari[k.tarikh] = k);

    const baki = {}; lokasiSet.forEach(l => baki[l] = +((cfg.BAKI_AWAL || {})[l] || 0));
    const jumlahBaki = () => lokasiSet.reduce((a, l) => a + baki[l], 0);
    const awal = jumlahBaki();

    const siri = [], bulanan = [], pelarasan = [];
    const ymKini = hariIni.slice(0, 7);
    const pl = {}; lokasiSet.forEach(l => pl[l] = { lokasi: l, awal: baki[l], bf: baki[l], masuk: 0, keluar: 0, pelarasan: 0, reject: 0, masukTh: 0, keluarTh: 0 });
    let bln = null;

    for (let d = new Date(mula + 'T00:00:00'); ; d.setDate(d.getDate() + 1)) {
      const t = tStr(d);
      if (t > hariIni) break;
      const ym = t.slice(0, 7);
      if (!bln || bln.ym !== ym) {
        bln = { ym, bf: bulat(jumlahBaki()), masuk: 0, keluar: 0, pelarasan: 0, reject: 0, jenis: {}, bfLokasi: {} };
        lokasiSet.forEach(l => bln.bfLokasi[l] = bulat(baki[l]));
        bulanan.push(bln);
        if (ym === ymKini) lokasiSet.forEach(l => pl[l].bf = baki[l]);
      }
      let hm = 0, hk = 0, hr = 0, hp = 0;
      (ikutHari[t] || []).forEach(r => {
        if (r.arah === 'MASUK') { baki[r.lokasi] += r.kg; hm += r.kg; hr += r.reject || 0; }
        else { baki[r.lokasi] -= r.kg; hk += r.kg; }
        bln.jenis[r.jenis] = (bln.jenis[r.jenis] || 0) + r.kg;
        const p = pl[r.lokasi];
        if (r.arah === 'MASUK') { p.masukTh += r.kg; if (ym === ymKini) { p.masuk += r.kg; p.reject += r.reject || 0; } }
        else { p.keluarTh += r.kg; if (ym === ymKini) p.keluar += r.kg; }
      });
      const k = kiraanHari[t];
      if (k) Object.keys(k.baki).forEach(l0 => {
        const l = lokasi(l0) || l0, fiz = +k.baki[l0];
        if (isNaN(fiz)) return;
        const beza = bulat(fiz - baki[l]);
        pelarasan.push({ t, lokasi: l, sistem: bulat(baki[l]), fizikal: fiz, beza, catatan: k.catatan || '' });
        baki[l] = fiz; hp += beza;
        if (ym === ymKini) pl[l].pelarasan += beza;
      });
      bln.masuk += hm; bln.keluar += hk; bln.reject += hr; bln.pelarasan += hp;
      bln.cf = bulat(jumlahBaki());
      siri.push({ t, masuk: bulat(hm), keluar: bulat(hk), reject: bulat(hr), pelarasan: bulat(hp), baki: bulat(jumlahBaki()) });
    }
    bulanan.forEach(b => { b.masuk = bulat(b.masuk); b.keluar = bulat(b.keluar); b.reject = bulat(b.reject); b.pelarasan = bulat(b.pelarasan);
      Object.keys(b.jenis).forEach(j => b.jenis[j] = bulat(b.jenis[j])); });

    const perLokasi = lokasiSet.map(l => Object.assign(pl[l], { baki: bulat(baki[l]), bf: bulat(pl[l].bf),
      masuk: bulat(pl[l].masuk), keluar: bulat(pl[l].keluar), pelarasan: bulat(pl[l].pelarasan) }));
    const semasa = bulanan[bulanan.length - 1] || { bf: awal, masuk: 0, keluar: 0, pelarasan: 0, reject: 0, cf: awal };

    // Semakan integriti: rekod berganda
    const kiraKunci = {}; const ganda = [];
    rekod.forEach(r => { if (!r.kunci) return; const kk = r.kod + '|' + r.kunci; kiraKunci[kk] = (kiraKunci[kk] || 0) + 1; if (kiraKunci[kk] === 2) ganda.push(r); });

    // Hari baki keseluruhan negatif (petunjuk rekod masuk tertinggal / baki awal salah)
    const hariNegatif = siri.filter(s => s.baki < -0.05);

    return {
      rekod, perLokasi, siri, bulanan, pelarasan, ganda, hariNegatif, maklumat, isuTarikh,
      kiraanAkhir: kiraan.length ? kiraan[kiraan.length - 1].tarikh : null,
      jumlah: { awal: bulat(awal), bf: semasa.bf, masuk: semasa.masuk, keluar: semasa.keluar, pelarasan: semasa.pelarasan,
        reject: semasa.reject, baki: bulat(jumlahBaki()), ym: semasa.ym }
    };
  }

  const api = { csv, tarikh, tarikhTab, nombor, lokasi, calonTab, parseReject, parseReceiving, parseStockOut, parseIssue, muatSemua, kira, JENIS, LOKASI_TETAP, BULAN_BM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ENJIN = api;
})(typeof window !== 'undefined' ? window : this);
