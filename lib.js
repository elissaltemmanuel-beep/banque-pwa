/**
 * Lib.gs — fonctions pures (aucune API Google) : lecture du CSV BoursoBank,
 * fusion incrémentale et calculs du tableau de bord.
 * Testables hors de Google (voir test/run-tests.js).
 */

// Colonnes de l'onglet « Operations » (14). Le CSV en a 13 + une clé unique.
var COLS = ['date', 'date_valeur', 'libelle', 'tags', 'libelle_suggere', 'categorie',
  'categorie_parente', 'montant', 'commentaire', 'numero_compte', 'libelle_compte',
  'solde', 'pointage', 'cle'];

// Revenus : catégories parentes dont les montants positifs sont des entrées d'argent.
// Un montant positif dans une autre catégorie (hors mouvements internes) est un
// remboursement : il vient en déduction du poste.
var INCOME_PARENTS = ['Virements reçus', 'Revenus du travail', "Dépenses d'épargne"];
var INTERNAL_RE = /mouvements?\s+internes?/i;

var MOIS_LONGS_ = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
var MOIS_INITIALES_ = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// ---------------------------------------------------------------- utilitaires

function parseNumber_(s) {
  if (typeof s === 'number') return s;
  var t = String(s == null ? '' : s).replace(/[\s  ]/g, '').replace(',', '.');
  var v = parseFloat(t);
  return isNaN(v) ? 0 : v;
}

function toIso_(s) {
  s = String(s == null ? '' : s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function round2_(v) { return Math.round(v * 100) / 100; }

function addDays_(iso, n) {
  var p = iso.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
}

function daysInMonth_(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

function shiftMonth_(key, n) {
  var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1 + n;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return y + '-' + pad2_(m + 1);
}

function median_(arr) {
  var a = arr.slice().sort(function (x, y) { return x - y; });
  var n = a.length;
  if (!n) return 0;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

function slug_(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}

// ------------------------------------------------------------------- lecture

/**
 * table : tableau de lignes (en-tête comprise) issu de Utilities.parseCsv.
 * Retourne les lignes de stockage (14 colonnes) par date CROISSANTE, chacune avec une
 * clé unique « date|libellé|montant|n » (n = rang d'une opération identique le même jour).
 * Les colonnes sont lues PAR POSITION : le CSV a deux colonnes nommées « Solde ».
 */
function toStorageRows(table) {
  if (!table || table.length < 2) throw new Error('Le fichier CSV est vide.');
  var head = String(table[0][0] || '').replace(/^﻿/, '').toLowerCase();
  if (head.indexOf('date') !== 0 || table[0].length < 13) {
    throw new Error('Format de fichier inattendu : ce n\'est pas un export d\'opérations BoursoBank.');
  }
  var out = [];
  for (var i = 1; i < table.length; i++) {
    var r = table[i];
    if (!r || r.length < 13) continue;
    var d = toIso_(r[0]);
    if (!d) continue;
    out.push([d, toIso_(r[1]) || d, String(r[2]), String(r[3]), String(r[4]), String(r[5]),
      String(r[6]), parseNumber_(r[7]), String(r[8]), String(r[9]), String(r[10]),
      parseNumber_(r[11]), String(r[12]), '']);
  }
  out.reverse(); // le fichier est du plus récent au plus ancien
  var counts = {};
  out.forEach(function (row) {
    var base = row[0] + '|' + row[2] + '|' + row[7];
    counts[base] = (counts[base] || 0) + 1;
    row[13] = base + '|' + counts[base];
  });
  return out;
}

/**
 * Import incrémental : l'ancien reste figé, les `overlapDays` derniers jours sont
 * remplacés par la version du nouvel export (réécritures récentes de la banque).
 * Si le nouvel export ne remonte pas jusqu'à cette date, on part de son premier jour.
 */
function mergeIncremental(existing, incoming, todayIso, overlapDays) {
  if (!incoming.length) throw new Error('Le nouvel export ne contient aucune opération.');
  if (!existing.length) {
    return { rows: incoming, kept: 0, replaced: 0, added: incoming.length, cutoff: null };
  }
  var cutoff = addDays_(todayIso, -(overlapDays == null ? 45 : overlapDays));
  if (incoming[0][0] > cutoff) cutoff = incoming[0][0];
  var kept = existing.filter(function (r) { return r[0] < cutoff; });
  var tail = incoming.filter(function (r) { return r[0] >= cutoff; });
  return {
    rows: kept.concat(tail),
    kept: kept.length,
    replaced: existing.length - kept.length,
    added: tail.length,
    cutoff: cutoff
  };
}


// ------------------------------------------------- règles de catégorisation

var DEFAULT_RULES_ = [
  { re: /\b(DGFIP|FINANCES PUBLIQUES|TRESOR PUBLIC|IMPOTS?)\b/, poste: 'Impôts & Taxes' },
  { re: /\b(BOULANGERIE|PATISSERIE|BOUCHERIE|FROMAGERIE|SUPERETTE|SUPERMARCHE|EPICERIE|MARCHE)\b/, poste: 'Vie quotidienne', sous: 'Alimentation' },
  { re: /\b(RESTO|RESTAURANT|BRASSERIE|BISTRO|PIZZERIA|PIZZA|SUSHI|CAFE|COFFEE|BAR|PUB|TRATTORIA)\b/, poste: 'Loisirs et sorties', sous: 'Restaurants et bars' },
  { re: /\b(CLUB|BOOTCAMP|BOOT CAMP|FITNESS|CINEMA|THEATRE|CONCERT|FESTIVAL|BILLETTERIE|MUSEE)\b/, poste: 'Loisirs et sorties', sous: 'Sorties et culture' },
  { re: /\b(PHARMACIE|PHARM|DOCTOLIB|DENTISTE|OPTIQUE|LABORATOIRE|LABO)\b/, poste: 'Santé' }
];

/** Majuscules, sans accents ni ponctuation : sert à comparer un libellé à un motif. */
function norm_(s) {
  return String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').trim();
}

/**
 * Applique les règles (motif contenu dans le libellé → poste). Les règles de l'utilisateur
 * priment sur la banque ; les règles intégrées ne touchent que les opérations « Non catégorisé ».
 */
function applyRules_(rows, rules) {
  var user = (rules || []).map(function (r) {
    var a = r.montant === '' || r.montant == null ? null : Math.abs(parseNumber_(r.montant));
    return { m: norm_(r.motif), poste: String(r.poste || '').trim(), sous: String(r.sous || '').trim(), amt: a || null };
  }).filter(function (r) { return r.m && r.poste; })
    .sort(function (a, b) { return (b.amt ? 1 : 0) - (a.amt ? 1 : 0) || b.m.length - a.m.length; });
  return rows.map(function (r) {
    var hay = ' ' + norm_(r[2] + ' ' + r[4]) + ' ', i, c;
    for (i = 0; i < user.length; i++) {
      if (hay.indexOf(user[i].m) > -1 && (user[i].amt == null || Math.abs(Math.abs(r[7]) - user[i].amt) < 0.005)) {
        c = r.slice(); c[6] = user[i].poste; c[5] = user[i].sous || user[i].poste; return c;
      }
    }
    if (r[6] === 'Virements émis') { c = r.slice(); c[6] = 'Virements'; c[5] = r[5] === 'Virements émis' ? 'Virements' : r[5]; return c; }
    if (!r[6] || /non\s*cat/i.test(r[6])) {
      for (i = 0; i < DEFAULT_RULES_.length; i++) {
        if (DEFAULT_RULES_[i].re.test(hay.trim())) { c = r.slice(); c[6] = DEFAULT_RULES_[i].poste; c[5] = DEFAULT_RULES_[i].sous || (r[5] && !/non\s*cat/i.test(r[5]) ? r[5] : c[6]); return c; }
      }
    }
    return r;
  });
}

// ----------------------------------------------------------------- agrégats

/**
 * rows : lignes de stockage triées par date croissante. todayIso : « aujourd'hui ».
 * Retourne tout ce que l'écran affiche (JSON simple).
 */
function aggregate(rows, todayIso, opts) {
  opts = opts || {};
  rows = applyRules_(rows, opts.rules);
  var salaryRe = new RegExp(opts.salaryPattern || '(?!)', 'i');
  // le solde du CSV est celui de la date d'export : les opérations datées après ne sont pas encore confirmées
  var cut = opts.exportDate && opts.exportDate < todayIso ? opts.exportDate : todayIso;
  var cur = todayIso.slice(0, 7), y = +todayIso.slice(0, 4), m = +todayIso.slice(5, 7);
  var day = +todayIso.slice(8, 10), dim = daysInMonth_(y, m), remaining = dim - day, i, d;

  var months = [], histKeys = [];
  for (i = 11; i >= 0; i--) months.push(shiftMonth_(cur, -i));
  for (i = 12; i >= 1; i--) histKeys.push(shiftMonth_(cur, -i));

  var spend = {}, subSpend = {}, dep = {}, rev = {}, lastBal = {}, dailyBal = {};
  var depDay = {}, revDay = {};
  var yr = {}, ytdCut = todayIso.slice(5);
  var futurs = 0, futursList = [], salaryByMonth = {}, salaryFirstDay = {}, salaryThisMonth = false, futureSalary = null;
  var card90 = 0, win90 = addDays_(todayIso, -90);
  var solde = null, lastRealDate = null, internalCount = 0;

  function bump(obj, k1, k2, v) { if (!obj[k1]) obj[k1] = {}; obj[k1][k2] = (obj[k1][k2] || 0) + v; }

  rows.forEach(function (r) {
    var date = r[0], amt = r[7], par = r[6] || 'Non catégorisé', cat = r[5] || par, mk = date.slice(0, 7);
    if (date > cut) { // opération programmée ou postérieure à l'export : pas encore confirmée
      futurs += amt;
      futursList.push([date, r[4] || r[2], amt]);
      if (salaryRe.test(r[2]) && amt > 0) {
        if (mk === cur) salaryThisMonth = true;
        if (!futureSalary || date < futureSalary) futureSalary = date;
      }
      return;
    }
    solde = r[11];
    lastRealDate = date;
    lastBal[mk] = r[11];
    dailyBal[date] = r[11];
    if (INTERNAL_RE.test(par) || INTERNAL_RE.test(cat)) { internalCount++; return; }
    if (salaryRe.test(r[2]) && amt > 0) {
      salaryByMonth[mk] = (salaryByMonth[mk] || 0) + amt;
      if (!(mk in salaryFirstDay)) salaryFirstDay[mk] = +date.slice(8, 10);
      if (mk === cur) salaryThisMonth = true;
    }
    var dd = +date.slice(8, 10), depV = 0, revV = 0;
    if (INCOME_PARENTS.indexOf(par) > -1) {
      if (amt > 0) revV = amt; else depV = -amt;
    } else {
      depV = -amt;
      bump(spend, par, mk, -amt);
      if (!subSpend[par]) subSpend[par] = {};
      bump(subSpend[par], cat, mk, -amt);
      if (date > win90 && amt < 0 && /^CARTE/i.test(r[2])) card90 += -amt;
    }
    dep[mk] = (dep[mk] || 0) + depV;
    rev[mk] = (rev[mk] || 0) + revV;
    var yk = date.slice(0, 4), Y = yr[yk] || (yr[yk] = { rev: 0, dep: 0, tax: 0, yRev: 0, yDep: 0, yTax: 0, by: {} });
    var isTax = INCOME_PARENTS.indexOf(par) < 0 && /imp[oô]ts?/i.test(par), inYtd = date.slice(5) <= ytdCut;
    Y.rev += revV; Y.dep += depV; if (isTax) Y.tax += depV;
    if (inYtd) { Y.yRev += revV; Y.yDep += depV; if (isTax) Y.yTax += depV; }
    if (INCOME_PARENTS.indexOf(par) < 0) Y.by[par] = (Y.by[par] || 0) + depV;
    if (!depDay[mk]) { depDay[mk] = []; revDay[mk] = []; }
    depDay[mk][dd] = (depDay[mk][dd] || 0) + depV;
    revDay[mk][dd] = (revDay[mk][dd] || 0) + revV;
  });
  if (solde == null) solde = 0;

  // courbe du solde du mois en cours (jour par jour)
  var prevEnd = lastBal[shiftMonth_(cur, -1)];
  var carry = prevEnd != null ? prevEnd : null;
  if (carry == null) {
    for (d = 1; d <= day && carry == null; d++) {
      if (dailyBal[cur + '-' + pad2_(d)] != null) carry = dailyBal[cur + '-' + pad2_(d)];
    }
    if (carry == null) carry = solde;
  }
  var bal = [], depCum = [], revCum = [], cd = 0, cr = 0;
  for (d = 1; d <= day; d++) {
    var iso = cur + '-' + pad2_(d);
    if (dailyBal[iso] != null) carry = dailyBal[iso];
    bal.push(round2_(carry));
    cd += (depDay[cur] && depDay[cur][d]) || 0;
    cr += (revDay[cur] && revDay[cur][d]) || 0;
    depCum.push(round2_(cd));
    revCum.push(round2_(cr));
  }

  // « rythme habituel » : dépenses cumulées moyennes des 12 mois précédents, jour par jour
  var habit = [], usable = histKeys.filter(function (k) { return depDay[k]; });
  for (d = 1; d <= dim; d++) {
    var tot = 0;
    usable.forEach(function (k) {
      var c = 0, arr = depDay[k], last = daysInMonth_(+k.slice(0, 4), +k.slice(5, 7));
      for (var j = 1; j <= Math.min(d, last); j++) c += arr[j] || 0;
      tot += c;
    });
    habit.push(usable.length ? round2_(tot / usable.length) : 0);
  }

  // projection de fin de mois
  var courantes = Math.round((card90 / 90) * remaining);
  var salaryExpected = 0, salaryDay = null;
  if (!salaryThisMonth && remaining > 0) {
    var last3 = [-1, -2, -3].map(function (k) { return shiftMonth_(cur, k); });
    var vals = last3.map(function (k) { return salaryByMonth[k]; }).filter(Boolean);
    var dayVals = last3.map(function (k) { return salaryFirstDay[k]; }).filter(Boolean);
    if (vals.length) {
      salaryExpected = Math.round(median_(vals));
      var avgDay = Math.round(dayVals.reduce(function (a, b) { return a + b; }, 0) / dayVals.length);
      salaryDay = Math.min(dim, Math.max(avgDay, day + 1));
    }
  }
  var projValue = round2_(solde + futurs + salaryExpected - courantes);
  // atterrissage : le solde juste avant la prochaine paie (date de paie inconnue : estimée
  // d'après le jour de versement des 6 derniers mois, ou connue si la paie est déjà programmée)
  var payDays = Object.keys(salaryFirstDay).filter(function (k) { return k < cur; }).sort().slice(-6)
    .map(function (k) { return salaryFirstDay[k]; });
  var payDay = payDays.length ? Math.round(median_(payDays)) : null;
  var payIso = null, payKnown = false, payLate = false;
  if (futureSalary) { payIso = futureSalary; payKnown = true; }
  else if (payDay) {
    var pdCur = Math.min(dim, payDay);
    if (!salaryThisMonth) {
      if (pdCur > day) payIso = cur + '-' + pad2_(pdCur);
      else { payIso = addDays_(todayIso, 1); payLate = true; } // paie attendue mais pas encore reçue
    } else {
      var nk = shiftMonth_(cur, 1);
      payIso = nk + '-' + pad2_(Math.min(daysInMonth_(+nk.slice(0, 4), +nk.slice(5, 7)), payDay));
    }
  }
  var landing = null;
  if (payIso) {
    var landIso = addDays_(payIso, -1);
    if (landIso < todayIso) landIso = todayIso;
    var landDays = Math.round((Date.UTC(+landIso.slice(0, 4), +landIso.slice(5, 7) - 1, +landIso.slice(8, 10)) -
      Date.UTC(+cut.slice(0, 4), +cut.slice(5, 7) - 1, +cut.slice(8, 10))) / 86400000);
    var landFut = futursList.reduce(function (a, f) { return f[0] <= landIso ? a + f[2] : a; }, 0);
    landing = {
      date: landIso, payDate: payIso, payKnown: payKnown, payLate: payLate, days: landDays,
      payMin: payDays.length ? Math.min.apply(null, payDays) : null,
      payMax: payDays.length ? Math.max.apply(null, payDays) : null,
      exportAge: daysBetween_(cut, todayIso), exportDate: cut,
      value: round2_(solde + landFut - (card90 / 90) * landDays),
      futSum: round2_(landFut), perDay: round2_(card90 / 90), spend: round2_((card90 / 90) * landDays),
      fut: futursList.filter(function (f) { return f[0] <= landIso; }).slice(-14)
    };
  }
  var pts = [[day, round2_(solde)]];
  if (landing && landing.date.slice(0, 7) === cur && landing.days > 0) {
    pts.push([+landing.date.slice(8, 10), landing.value]);
  } else if (remaining > 0) {
    if (salaryExpected > 0) {
      var before = solde + futurs - courantes * Math.max(0, (salaryDay - 1 - day)) / remaining;
      pts.push([Math.max(day, salaryDay - 1), round2_(before)]);
      pts.push([salaryDay, round2_(before + salaryExpected)]);
      if (salaryDay < dim) pts.push([dim, projValue]);
    } else {
      pts.push([dim, projValue]);
    }
  }
  var depEnd = round2_((dep[cur] || 0) + courantes + (futurs < 0 ? -futurs : 0));
  var revEnd = round2_((rev[cur] || 0) + salaryExpected + (futurs > 0 ? futurs : 0));

  // 12 derniers mois (barres)
  var series = [], carryM = null;
  months.forEach(function (k) {
    var b = k === cur ? solde : lastBal[k];
    if (b == null) b = carryM;
    if (b == null) b = 0;
    carryM = b;
    series.push({
      k: k, lab: MOIS_INITIALES_[+k.slice(5, 7) - 1], bal: round2_(b),
      rev: round2_(rev[k] || 0), dep: round2_(dep[k] || 0)
    });
  });

  // postes (catégories parentes) et sous-postes (catégories)
  var cats = [];
  Object.keys(spend).forEach(function (par) {
    var s = round2_(spend[par][cur] || 0);
    var h = histKeys.map(function (k) { return round2_(spend[par][k] || 0); });
    if (!s && h.every(function (v) { return v === 0; })) return;
    var subs = Object.keys(subSpend[par]).map(function (c) {
      return {
        n: c, spent: round2_(subSpend[par][c][cur] || 0),
        hist: histKeys.map(function (k) { return round2_(subSpend[par][c][k] || 0); })
      };
    }).filter(function (x) { return x.spent || x.hist.some(function (v) { return v; }); })
      .sort(function (a, b) { return b.spent - a.spent; });
    cats.push({ id: slug_(par), n: par, spent: s, hist: h, subs: subs, ops: [] });
  });
  cats.sort(function (a, b) { return b.spent - a.spent; });
  var catIdx = {};
  cats.forEach(function (c) { catIdx[c.n] = c; });

  // opérations récentes (les plus récentes d'abord)
  var opsAll = [];
  for (i = rows.length - 1; i >= 0; i--) {
    var r = rows[i], fut = r[0] > todayIso ? 1 : 0, row = [r[0], r[4] || r[2], r[6] || '', r[7], fut];
    if (opsAll.length < 600) opsAll.push(row);
    var c = catIdx[r[6] || 'Non catégorisé'];
    if (c && c.ops.length < 40) c.ops.push([r[0], r[4] || r[2], r[7], fut]);
  }

  return {
    today: { iso: todayIso, day: day, days: dim, month: cur,
      label: MOIS_LONGS_[m - 1].charAt(0).toUpperCase() + MOIS_LONGS_[m - 1].slice(1) + ' ' + y,
      monthName: MOIS_LONGS_[m - 1] },
    solde: round2_(solde),
    proj: {
      value: projValue, futurs: round2_(futurs), futursList: futursList.slice(-10),
      salary: { expected: salaryExpected, day: salaryDay }, courantes: courantes, landing: landing,
      depEnd: depEnd, revEnd: revEnd
    },
    curve: { bal: bal, proj: pts, depCum: depCum, revCum: revCum, habit: habit },
    months: series,
    cats: cats,
    subs: detectSubscriptions_(rows, todayIso),
    bilan: bilan_(yr, y),
    ops: opsAll,
    stats: {
      rows: rows.length, from: rows.length ? rows[0][0] : null,
      to: rows.length ? rows[rows.length - 1][0] : null,
      lastRealDate: lastRealDate, internal: internalCount
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { COLS: COLS, toStorageRows: toStorageRows, mergeIncremental: mergeIncremental,
    aggregate: aggregate, addDays_: addDays_, parseNumber_: parseNumber_ };
}


// ------------------------------------------------------------ abonnements

/** Clé de regroupement d'un libellé : sans date, numéro ni mot générique (CARTE, PRLV…). */
function subKey_(label) {
  return String(label || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(CARTE|CB|PRLV|PRELEVEMENT|SEPA|VIR|VIREMENT|PAIEMENT|ACHAT|FACTURE|FACT|REF|ECH|ECHEANCE)\b/g, ' ')
    .replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1; }).slice(0, 3).join(' ');
}

function daysBetween_(a, b) {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) -
    Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
}

/**
 * Prélèvements récurrents : au moins 3 passages sur 3 mois différents, environ un par mois,
 * montant stable. Retourne { list, total, count } (total = abonnements encore actifs, par mois).
 */
function detectSubscriptions_(rows, todayIso) {
  var groups = {};
  rows.forEach(function (r) {
    var date = r[0], amt = r[7], par = r[6] || '', cat = r[5] || par;
    if (date > todayIso || amt >= 0) return;
    if (INTERNAL_RE.test(par) || INTERNAL_RE.test(cat) || INCOME_PARENTS.indexOf(par) > -1) return;
    var k = subKey_(r[2]);
    if (!k) return;
    (groups[k] = groups[k] || []).push({ d: date, a: -amt, n: r[4] || r[2], p: par || 'Non catégorisé' });
  });
  var list = [];
  Object.keys(groups).forEach(function (k) {
    var g = groups[k].sort(function (x, z) { return x.d < z.d ? -1 : x.d > z.d ? 1 : 0; });
    var months = {};
    g.forEach(function (o) { months[o.d.slice(0, 7)] = 1; });
    if (g.length < 3 || Object.keys(months).length < 3) return;
    var recent = g.slice(-8), gaps = [];
    for (var i = 1; i < recent.length; i++) gaps.push(daysBetween_(recent[i - 1].d, recent[i].d));
    var okGaps = gaps.filter(function (x) { return x >= 24 && x <= 38; }).length;
    if (median_(gaps) < 26 || median_(gaps) > 35 || okGaps / gaps.length < 0.7) return;
    // montant stable : au plus 2 niveaux de prix (une hausse), chacun vu au moins 2 fois
    var levels = [];
    g.slice(-6).forEach(function (o) {
      var lv = levels.filter(function (l) { return Math.abs(l.a - o.a) <= l.a * 0.03; })[0];
      if (lv) lv.n++; else levels.push({ a: o.a, n: 1 });
    });
    if (levels.length > 2 || levels.some(function (l) { return l.n < 2; })) return;
    var last = g[g.length - 1], amt = last.a, hausse = null, j;
    for (j = g.length - 1; j > 0 && Math.abs(g[j - 1].a - amt) <= amt * 0.02; j--) {}
    if (j > 0 && g[j].d >= addDays_(todayIso, -100) && Math.abs(g[j - 1].a - amt) > 0.5 && amt > g[j - 1].a) {
      hausse = { from: round2_(g[j - 1].a), to: round2_(amt), date: g[j].d };
    }
    var nm = shiftMonth_(last.d.slice(0, 7), 1);
    var next = nm + '-' + pad2_(Math.min(+last.d.slice(8, 10), daysInMonth_(+nm.slice(0, 4), +nm.slice(5, 7))));
    list.push({
      n: last.n, amt: round2_(amt), par: last.p, last: last.d, next: next, count: g.length,
      since: g[0].d, active: daysBetween_(last.d, todayIso) <= 45, hausse: hausse,
      nouveau: g[0].d >= addDays_(todayIso, -100)
    });
  });
  list.sort(function (a, b) { return b.amt - a.amt; });
  var total = 0, count = 0;
  list.forEach(function (x) { if (x.active) { total += x.amt; count++; } });
  return { list: list, total: round2_(total), count: count };
}

// ------------------------------------------------------------ bilan annuel

function bilan_(yr, y) {
  function one(k) {
    var Y = yr[k];
    if (!Y) return null;
    var top = Object.keys(Y.by).map(function (p) { return [p, round2_(Y.by[p])]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    return { y: +k, rev: round2_(Y.rev), dep: round2_(Y.dep), tax: round2_(Y.tax),
      yRev: round2_(Y.yRev), yDep: round2_(Y.yDep), yTax: round2_(Y.yTax), top: top };
  }
  return { cur: one(String(y)), prev: one(String(y - 1)) };
}
