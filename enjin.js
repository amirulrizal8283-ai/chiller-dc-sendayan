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
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    let y, mo, d;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
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

  /* ---------- Parser setiap fail ---------- */
  // 1. QC REJECT DETAIL HARVEST — A:Tarikh B:Shedhouse C:Bersih(kg) G:Jumlah reject H:Kasar
  function parseReject(rows, ym) {
    const out = [];
    rows.forEach((r, i) => {
      const t = tarikh(r[0]);
      if (!t || t.slice(0, 7) !== ym) return;
      const bersih = nombor(r[2]); if (isNaN(bersih)) return;
      const rej = n0(r[6]), kasar = n0(r[7]);
      if (bersih === 0 && rej === 0) return;
      out.push({ t, arah: 'MASUK', jenis: JENIS.HARVEST, lokasi: 'TKPM SENDAYAN', kg: bersih, reject: rej, kasar,
        ket: 'Shedhouse ' + (r[1] || '-').trim(), kunci: t + '|' + (r[1] || '').trim(), baris: i + 1 });
    });
    return out;
  }

  // 2. QC RECEIVING OTHER FARM — B:Tarikh C:Lokasi D:Terima kg F:200g kg J:Jumlah reject K:Bersih
  function parseReceiving(rows, ym) {
    const out = [];
    rows.forEach((r, i) => {
      const t = tarikh(r[1]);
      if (!t || t.slice(0, 7) !== ym) return;
      const lok = lokasi(r[2]); if (!lok) return;
      const terima = n0(r[3]), kg200 = n0(r[5]), rej = n0(r[9]);
      let bersih = nombor(r[10]);
      if (isNaN(bersih)) bersih = terima + kg200 - rej;
      if (bersih === 0 && terima === 0 && kg200 === 0) return;
      out.push({ t, arah: 'MASUK', jenis: JENIS.TERIMA, lokasi: lok, kg: bersih, reject: rej, kasar: terima + kg200,
        ket: 'Terima ' + bulat(terima + kg200) + ' kg' + (rej ? ', reject ' + bulat(rej) + ' kg' : ''), kunci: t + '|' + lok + '|' + bulat(terima + kg200), baris: i + 1 });
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

  // 4. QC STOCK ISSUE — 3 jadual dalam satu tab: RND/Sampel/Gift, Proses Kering, Sisa/Waste
  function parseIssue(rows, ym) {
    const out = []; let sek = null, ix = {};
    const cari = (r, label) => r.findIndex(x => String(x || '').trim().toUpperCase() === label);
    rows.forEach((r, i) => {
      if (cari(r, 'TUJUAN') >= 0) { sek = 'RND'; ix = { lok: cari(r, 'LOKASI STOK'), ket: cari(r, 'TUJUAN') }; ix.kg = ix.ket + 1; return; }
      if (cari(r, 'DISEDIAKAN OLEH') >= 0) { sek = 'KERING'; ix = { lok: cari(r, 'LOKASI STOK') }; ix.kg = ix.lok + 2; ix.ket = ix.kg + 1; return; }
      if (cari(r, 'KATEGORI SISA') >= 0) { sek = 'SISA'; ix = { lok: cari(r, 'LOKASI STOK'), ket: cari(r, 'KATEGORI SISA'), kg: cari(r, 'TOTAL WASTE (KG)') }; return; }
      if (!sek || ix.lok < 0 || ix.kg < 0) return;
      const t = tarikh(r[0]);
      if (!t || t.slice(0, 7) !== ym) return;
      const kg = nombor(r[ix.kg]); if (isNaN(kg) || kg <= 0) return;
      const lok = lokasi(r[ix.lok]) || 'TKPM SENDAYAN';
      let ket = String(r[ix.ket] || '').trim();
      if (sek === 'KERING') ket = 'Selepas kering ' + (nombor(r[ix.ket]) || 0) + ' kg';
      out.push({ t, arah: 'KELUAR', jenis: JENIS[sek], lokasi: lok, kg, ket, baris: i + 1 });
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

  async function muatSemua(cfg, fetcher, cacheTab, kini) {
    kini = kini || new Date();
    const bulan = senaraiBulan(cfg.TARIKH_MULA, kini);
    const kerja = [];
    Object.keys(cfg.FAIL).forEach(kod => bulan.forEach(([y, b]) =>
      kerja.push(bacaBulan(fetcher, kod, cfg.FAIL[kod], y, b, cacheTab)
        .then(r => Object.assign(r, { kod }))
        .catch(e => ({ kod, ym: y + '-' + String(b + 1).padStart(2, '0'), ralat: String(e && e.message || e), rekod: [] })))));
    const hasil = await Promise.all(kerja);
    const rekod = [].concat.apply([], hasil.map(h => h.rekod));
    return { hasil, rekod };
  }

  /* ---------- Pengiraan ---------- */
  function kira(cfg, rekodSemua, hariIni) {
    const mula = cfg.TARIKH_MULA;
    const rekod = rekodSemua.filter(r => r.t >= mula && r.t <= hariIni)
      .sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : (a.arah === 'MASUK' ? -1 : 1));
    const lokasiSet = LOKASI_TETAP.slice();
    rekod.forEach(r => { if (lokasiSet.indexOf(r.lokasi) < 0) lokasiSet.push(r.lokasi); });

    const perLokasi = {};
    lokasiSet.forEach(l => perLokasi[l] = { lokasi: l, awal: +(cfg.BAKI_AWAL[l] || 0), masuk: 0, keluar: 0, reject: 0 });
    const jenis = {}; const harian = {};
    rekod.forEach(r => {
      const p = perLokasi[r.lokasi];
      if (r.arah === 'MASUK') { p.masuk += r.kg; p.reject += r.reject || 0; } else p.keluar += r.kg;
      jenis[r.jenis] = (jenis[r.jenis] || 0) + r.kg;
      const h = harian[r.t] || (harian[r.t] = { masuk: 0, keluar: 0, reject: 0 });
      if (r.arah === 'MASUK') { h.masuk += r.kg; h.reject += r.reject || 0; } else h.keluar += r.kg;
    });
    let awal = 0, masuk = 0, keluar = 0, reject = 0;
    lokasiSet.forEach(l => { const p = perLokasi[l]; p.baki = p.awal + p.masuk - p.keluar; awal += p.awal; masuk += p.masuk; keluar += p.keluar; reject += p.reject; });

    // Siri harian dari tarikh mula hingga hari ini (termasuk hari tanpa pergerakan)
    const siri = []; let baki = awal;
    for (let d = new Date(mula + 'T00:00:00'); ; d.setDate(d.getDate() + 1)) {
      const t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (t > hariIni) break;
      const h = harian[t] || { masuk: 0, keluar: 0, reject: 0 };
      baki += h.masuk - h.keluar;
      siri.push({ t, masuk: bulat(h.masuk), keluar: bulat(h.keluar), reject: bulat(h.reject), baki: bulat(baki) });
    }

    // Semakan integriti: rekod berganda
    const kiraKunci = {}; const ganda = [];
    rekod.forEach(r => { if (!r.kunci) return; const k = r.kod + '|' + r.kunci; kiraKunci[k] = (kiraKunci[k] || 0) + 1; if (kiraKunci[k] === 2) ganda.push(r); });

    return {
      rekod, perLokasi: lokasiSet.map(l => perLokasi[l]), jenis, siri,
      jumlah: { awal: bulat(awal), masuk: bulat(masuk), keluar: bulat(keluar), reject: bulat(reject), baki: bulat(awal + masuk - keluar) },
      ganda
    };
  }

  const api = { csv, tarikh, nombor, lokasi, calonTab, parseReject, parseReceiving, parseStockOut, parseIssue, muatSemua, kira, JENIS, LOKASI_TETAP, BULAN_BM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ENJIN = api;
})(typeof window !== 'undefined' ? window : this);
