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
var INCOME_PARENTS = ['Virements reçus', 'Revenus du travail', "Dépenses d'épargne", 'Revenus exceptionnels'];
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
  // certains exports (anciens) n'ont pas la colonne « Tags » : on la réinsère à vide
  if (table[0].length === 12 && !/tag/i.test(String(table[0][3] || ''))) {
    table = table.map(function (r) { if (r && r.length >= 12) { r = r.slice(); r.splice(3, 0, ''); } return r; });
  }
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

/**
 * Export plus ancien (complément d'historique) : on ne garde que ses opérations antérieures
 * à la première date déjà connue, sans toucher à l'existant.
 */
/**
 * Choix de l'export de base : dernière date des opérations d'abord ; à égalité, le fichier déposé en dernier
 * (modifiedTime) fait foi, puis le plus long.
 */
function sortBases_(parsed) {
  return parsed.slice().sort(function (a, b) {
    var da = a.rows[a.rows.length - 1][0], db = b.rows[b.rows.length - 1][0];
    if (da !== db) return da < db ? 1 : -1;
    var ma = String(a.f.modifiedTime || ''), mb = String(b.f.modifiedTime || '');
    if (ma !== mb) return ma < mb ? 1 : -1;
    return b.rows.length - a.rows.length;
  });
}

/**
 * Rapprochement : la dernière opération de l'export déposé en dernier doit se retrouver, avec le même solde,
 * à la fin des opérations gardées. ok = false => l'appli n'affiche pas ce que dit le dernier export.
 */
function balanceCheck_(rows, parsed) {
  if (!rows.length || !parsed.length) return null;
  var newest = parsed.slice().sort(function (a, b) { return String(a.f.modifiedTime || '') < String(b.f.modifiedTime || '') ? 1 : -1; })[0];
  var nl = newest.rows[newest.rows.length - 1], fl = rows[rows.length - 1];
  var same = nl[0] === fl[0] && Math.abs((+nl[11]) - (+fl[11])) < 0.005;
  return { ok: nl[0] < fl[0] || same, file: newest.f.name, fileDate: nl[0], fileBal: nl[11], appDate: fl[0], appBal: fl[11] };
}

function mergeHistory(existing, incoming) {
  if (!existing.length) return { rows: incoming, added: incoming.length };
  var first = existing[0][0];
  var older = incoming.filter(function (r) { return r[0] < first; });
  return { rows: older.concat(existing), added: older.length };
}


// ------------------------------------------------- règles de catégorisation

var DEFAULT_RULES_ = [
  { re: /\b(DGFIP|FINANCES PUBLIQUES|TRESOR PUBLIC|IMPOTS?)\b/, poste: 'Impôts & Taxes' },
  { re: /\b(BOULANGERIE|PATISSERIE|BOUCHERIE|FROMAGERIE|SUPERETTE|SUPERMARCHE|EPICERIE|MARCHE)\b/, poste: 'Alimentation', sous: 'Boulangerie' },
  { re: /\b(RESTO|RESTAURANT|BRASSERIE|BISTRO|PIZZERIA|PIZZA|SUSHI|CAFE|COFFEE|BAR|PUB|TRATTORIA)\b/, poste: 'Loisirs et sorties', sous: 'Restaurants et bars' },
  { re: /\b(CLUB|BOOTCAMP|BOOT CAMP|FITNESS|CINEMA|THEATRE|CONCERT|FESTIVAL|BILLETTERIE|MUSEE)\b/, poste: 'Loisirs et sorties', sous: 'Sorties et culture' },
  { re: /\b(PHARMACIE|PHARM|DOCTOLIB|DENTISTE|OPTIQUE|LABORATOIRE|LABO)\b/, poste: 'Santé' }
];

/**
 * Grands postes : regroupe les catégories de la banque (propres à BoursoBank, donc sans donnée
 * personnelle) en 10 postes. Les règles par libellé de l'utilisateur passent avant.
 */
var TAXO_ = [
  [/^ALIMENTATION$/, 'Alimentation', 'Courses'],
  [/^ENERGIE/, 'Logement', 'Énergie'],
  [/^ASSURANCE HABITATION/, 'Logement', 'Assurance habitation'],
  [/^LIVRES CD DVD/, 'Shopping et équipement', 'Livres et loisirs'],
  [/^ELECTRONIQUE/, 'Shopping et équipement', 'Électronique'],
  [/^VETEMENTS/, 'Shopping et équipement', 'Vêtements'],
  [/^(BRICOLAGE|MOBILIER)/, 'Shopping et équipement', 'Maison, déco et bricolage'],
  [/^EQUIPEMENTS SPORTIFS/, 'Shopping et équipement', 'Équipements sportifs et artistiques'],
  [/^(VIE QUOTIDIENNE|VIE QUOTIDIENNE AUTRES)$/, 'Shopping et équipement', 'Autres achats'],
  [/^BIEN ETRE/, 'Divers', 'Coiffeur et soins'],
  [/^TABAC/, 'Divers', 'Tabac'],
  [/^RESTAURANTS/, 'Loisirs et sorties', 'Restaurants et bars'],
  [/^DIVERTISSEMENT/, 'Loisirs et sorties', 'Sorties et culture'],
  [/^CLUB/, 'Loisirs et sorties', 'Sport et associations'],
  [/^DEPENSES JEUX/, 'Loisirs et sorties', 'Jeux'],
  [/^LOISIRS/, 'Loisirs et sorties', 'Autres loisirs'],
  [/^HEBERGEMENT/, 'Transports et voyages', 'Hébergement'],
  [/^(AGENCES DE VOYAGES|LOCATION DE VEHICULES)/, 'Transports et voyages', 'Agences et locations'],
  [/^TAXIS/, 'Transports et voyages', 'Taxis'],
  [/^TRANSPORTS LONGUE/, 'Transports et voyages', 'Train et avion'],
  [/^TRANSPORTS QUOTIDIENS/, 'Transports et voyages', 'Transports du quotidien'],
  [/^VOYAGES TRANSPORTS/, 'Transports et voyages', 'Autres transports'],
  [/^MULTIMEDIA/, 'Abonnements et télécoms', 'Internet et TV'],
  [/^TELEPHONIE/, 'Abonnements et télécoms', 'Mobile'],
  [/^JOURNAUX/, 'Abonnements et télécoms', 'Presse'],
  [/^ABONNEMENTS/, 'Abonnements et télécoms', 'Autres abonnements'],
  [/^(ASSURANCES AUTO|CARBURANT|ENTRETIEN|PARKING|PEAGES|AUTO MOTO)/, 'Divers', 'Auto et moto'],
  [/^DONS ET CADEAUX/, 'Divers', 'Cadeaux et dons'],
  [/^(ETUDES|EDUCATION)/, 'Divers', 'Éducation'],
  [/^REMBOURSEMENT DE FRAIS/, 'Revenus exceptionnels', 'Offres bancaires'],
  [/^SERVICES/, 'Divers', 'Services'],
  [/^AUTRES DEPENSES/, 'Divers', 'Autres']
];

function taxo_(cat) {
  var k = norm_(cat);
  for (var i = 0; i < TAXO_.length; i++) if (TAXO_[i][0].test(k)) return TAXO_[i];
  return null;
}

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
    var par = r[6] || '', cat = r[5] || '';
    if (INCOME_PARENTS.indexOf(par) > -1 || INTERNAL_RE.test(par) || INTERNAL_RE.test(cat)) return r;
    if (par === 'Virements émis') { c = r.slice(); c[6] = 'Famille et proches'; c[5] = 'Virements'; return c; }
    if (!par || /non\s*cat/i.test(par)) {
      for (i = 0; i < DEFAULT_RULES_.length; i++) {
        if (DEFAULT_RULES_[i].re.test(hay.trim())) { c = r.slice(); c[6] = DEFAULT_RULES_[i].poste; c[5] = DEFAULT_RULES_[i].sous || (cat && !/non\s*cat/i.test(cat) ? cat : c[6]); return c; }
      }
      return r;
    }
    var t = taxo_(cat);
    if (t) { c = r.slice(); c[6] = t[1]; c[5] = t[2]; return c; }
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

  var firstK = rows.length ? rows.reduce(function (m, r) { return r[0] < m ? r[0] : m; }, rows[0][0]).slice(0, 7) : cur;
  var nAll = Math.min(96, (y - +firstK.slice(0, 4)) * 12 + (m - +firstK.slice(5, 7)) + 1), allKeys = [];
  for (i = nAll - 1; i >= 0; i--) allKeys.push(shiftMonth_(cur, -i));

  var spend = {}, spendTD = {}, subSpendTD = {}, subSpend = {}, dep = {}, rev = {}, lastBal = {}, dailyBal = {};
  var depDay = {}, revDay = {};
  var yr = {}, ytdCut = todayIso.slice(5);
  var upcP = {}, upcS = {}, sav = {}, revExc = {}, excM = {}, revOps = {};
  var futurs = 0, futursList = [], salaryByMonth = {}, salaryFirstDay = {}, salaryThisMonth = false, futureSalary = null;
  var card90 = 0, win90 = addDays_(todayIso, -90);
  var solde = null, lastRealDate = null, internalCount = 0, presumed = 0;

  function bump(obj, k1, k2, v) { if (!obj[k1]) obj[k1] = {}; obj[k1][k2] = (obj[k1][k2] || 0) + v; }

  rows.forEach(function (r) {
    var date = r[0], amt = r[7], par = r[6] || 'Non catégorisé', cat = r[5] || par, mk = date.slice(0, 7);
    if (date > todayIso) { // opération programmée, pas encore passée
      if (amt < 0 && mk === cur && !INTERNAL_RE.test(par) && !INTERNAL_RE.test(cat) && INCOME_PARENTS.indexOf(par) < 0) {
        upcP[par] = (upcP[par] || 0) - amt;
        if (!upcS[par]) upcS[par] = {};
        upcS[par][cat] = (upcS[par][cat] || 0) - amt;
        // une dépense programmée ce mois-ci compte dans les dépenses du mois
        bump(spend, par, mk, -amt);
        if (!subSpend[par]) subSpend[par] = {};
        bump(subSpend[par], cat, mk, -amt);
      }
      futurs += amt;
      futursList.push([date, r[4] || r[2], amt]);
      if (salaryRe.test(r[2]) && amt > 0) {
        if (mk === cur) salaryThisMonth = true;
        if (!futureSalary || date < futureSalary) futureSalary = date;
      }
      return;
    }
    // après la date de l'export, le solde du CSV n'a pas bougé : on présume l'opération exécutée
    if (date > cut) { solde = (solde == null ? r[11] : solde) + amt; presumed++; } else solde = r[11];
    lastRealDate = date;
    lastBal[mk] = solde;
    dailyBal[date] = solde;
    if (INTERNAL_RE.test(par) || INTERNAL_RE.test(cat)) { internalCount++; if (!/^apport/i.test(cat)) sav[mk] = (sav[mk] || 0) - amt; return; }
    if (salaryRe.test(r[2]) && amt > 0) {
      salaryByMonth[mk] = (salaryByMonth[mk] || 0) + amt;
      if (!(mk in salaryFirstDay)) salaryFirstDay[mk] = +date.slice(8, 10);
      if (mk === cur) salaryThisMonth = true;
    }
    var dd = +date.slice(8, 10), depV = 0, revV = 0;
    if (INCOME_PARENTS.indexOf(par) > -1) {
      if (amt > 0) { revV = amt; (revOps[mk] || (revOps[mk] = [])).push([date, r[4] || r[2], cat, round2_(amt), par]); if ((amt >= 1500 && !salaryRe.test(r[2])) || par === 'Revenus exceptionnels') revExc[mk] = (revExc[mk] || 0) + amt; } else depV = -amt;
    } else {
      depV = -amt;
      bump(spend, par, mk, -amt);
      if (dd <= day) bump(spendTD, par, mk, -amt);
      if (!subSpend[par]) subSpend[par] = {};
      bump(subSpend[par], cat, mk, -amt);
      if (dd <= day) { if (!subSpendTD[par]) subSpendTD[par] = {}; bump(subSpendTD[par], cat, mk, -amt); }
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

  // ---- analyses : exceptionnel, doublons, commerçants, indicateurs, prévision à 30 jours
  var subsRes = detectSubscriptions_(rows, todayIso);
  var recurKeys = {}; subsRes.list.forEach(function (x) { recurKeys[x.k] = 1; });
  var win12 = shiftMonth_(cur, -11) + '-01';
  var excP = {}, excS = {}, excOps = [], dupMap = {}, merch = {};
  rows.forEach(function (r) {
    var date = r[0], amt = r[7];
    if (date > todayIso || amt >= 0) return;
    var par = r[6] || 'Non catégorisé', cat = r[5] || par, mk = date.slice(0, 7);
    if (INTERNAL_RE.test(par) || INTERNAL_RE.test(cat) || INCOME_PARENTS.indexOf(par) > -1) return;
    var key = subKey_(r[2]);
    if (-amt >= 500 && !recurKeys[key]) {
      bump(excP, par, mk, -amt);
      if (!excS[par]) excS[par] = {};
      bump(excS[par], cat, mk, -amt);
      excM[mk] = (excM[mk] || 0) + (-amt);
      if (date >= win12) excOps.push([date, r[4] || r[2], par, amt]);
    }
    if (date >= win12) {
      if (-amt >= 100) { var dk = date + '|' + key + '|' + amt; (dupMap[dk] = dupMap[dk] || { d: date, l: r[4] || r[2], a: amt, n: 0 }).n++; }
      if (par !== 'Famille et proches' && cat !== 'Crédit maison' && !/imp[oô]ts/i.test(par) && key) {
        var mk2 = String(r[4] || key).toLowerCase(), mm = merch[mk2] || (merch[mk2] = { n: r[4] || key, s: 0, c: 0 });
        mm.s += -amt; mm.c++;
      }
    }
  });
  var dups = Object.keys(dupMap).map(function (k2) { return dupMap[k2]; }).filter(function (x) { return x.n >= 2; })
    .sort(function (a, b) { return a.a - b.a; }).slice(0, 6);
  var merchants = Object.keys(merch).map(function (k2) { return { n: merch[k2].n, s: round2_(merch[k2].s), c: merch[k2].c }; })
    .sort(function (a, b) { return b.s - a.s; }).slice(0, 8);
  excOps.sort(function (a, b) { return a[3] - b[3]; });

  var salVals = Object.keys(salaryByMonth).filter(function (k2) { return k2 < cur; }).sort().slice(-6).map(function (k2) { return salaryByMonth[k2]; });
  var salaryMonthly = salVals.length ? Math.round(median_(salVals)) : 0;
  var creditSub = subsRes.list.filter(function (x) { return x.active && /cr[ée]dit/i.test(x.par + ' ' + x.c); })[0];
  var d3 = 0, n3 = 0;
  for (i = 1; i <= 3; i++) { var k3 = shiftMonth_(cur, -i); d3 += dep[k3] || 0; n3 += daysInMonth_(+k3.slice(0, 4), +k3.slice(5, 7)); }
  var dailySpend = n3 ? d3 / n3 : 0;
  var t12 = { rev: 0, dep: 0, revExc: 0, sav: 0, exc: 0, n: 0 };
  for (i = 12; i >= 1; i--) {
    var k4 = shiftMonth_(cur, -i);
    if (k4 < firstK) continue;
    t12.rev += rev[k4] || 0; t12.dep += dep[k4] || 0; t12.revExc += revExc[k4] || 0; t12.sav += sav[k4] || 0; t12.exc += excM[k4] || 0; t12.n++;
  }
  Object.keys(t12).forEach(function (k5) { t12[k5] = round2_(t12[k5]); });
  var kpi = {
    salary: salaryMonthly, fixed: subsRes.total, rest: round2_(salaryMonthly - subsRes.total),
    credit: creditSub ? creditSub.amt : 0, effort: salaryMonthly && creditSub ? round2_(creditSub.amt / salaryMonthly) : null,
    daily: round2_(dailySpend), treso: dailySpend > 0 && solde > 0 ? Math.round(solde / dailySpend) : null, t12: t12
  };

  var fDaily = card90 / 90, fBal = solde - fDaily * daysBetween_(cut, todayIso), fEnd = addDays_(todayIso, 30), fEvs = {}, fList = [];
  function addEv(d, l, a, kind) { (fEvs[d] = fEvs[d] || []).push(a); fList.push({ d: d, l: l, a: round2_(a), k: kind || '' }); }
  futursList.forEach(function (f) { if (f[0] > todayIso && f[0] <= fEnd) addEv(f[0], f[1], f[2], 'prog'); });
  subsRes.list.forEach(function (x) {
    if (!x.active) return;
    var dN = x.last, guard = 0;
    while (guard++ < 14) {
      var nm2 = shiftMonth_(dN.slice(0, 7), 1);
      dN = nm2 + '-' + pad2_(Math.min(+x.last.slice(8, 10), daysInMonth_(+nm2.slice(0, 4), +nm2.slice(5, 7))));
      if (dN > todayIso) break;
    }
    if (dN > todayIso && dN <= fEnd) {
      var dupe = futursList.some(function (f) { return subKey_(f[1]) === x.k && Math.abs(daysBetween_(f[0], dN)) <= 5; });
      if (!dupe) addEv(dN, x.n, -x.amt, 'rec');
    }
  });
  if (payIso && !payKnown && payIso > todayIso && payIso <= fEnd && salaryMonthly > 0) addEv(payIso, 'Paie estimée', salaryMonthly, 'pay');
  var fPts = [], fLow = { d: todayIso, v: round2_(fBal) };
  for (i = 0; i <= 30; i++) {
    var dd = addDays_(todayIso, i);
    if (i > 0) fBal -= fDaily;
    (fEvs[dd] || []).forEach(function (a) { fBal += a; });
    fPts.push(round2_(fBal));
    if (fBal < fLow.v) fLow = { d: dd, v: round2_(fBal) };
  }
  var forecast = { start: todayIso, pts: fPts, low: fLow, events: fList.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }), daily: round2_(fDaily) };

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

  // tous les mois disponibles (pour le filtre de période)
  var seriesAll = [], carryA = null, daily = {}, carryD = null, dStart = Math.max(0, allKeys.length - 36);
  allKeys.forEach(function (k, ix) {
    var b = k === cur ? solde : lastBal[k];
    if (b == null) b = carryA;
    if (b == null) b = 0;
    carryA = b;
    seriesAll.push({ k: k, bal: round2_(b), rev: round2_(rev[k] || 0), dep: round2_(dep[k] || 0), sav: round2_(sav[k] || 0), revExc: round2_(revExc[k] || 0), exc: round2_(excM[k] || 0) });
    var dimk = daysInMonth_(+k.slice(0, 4), +k.slice(5, 7)), bb = [], dd = [], rr = [];
    for (var dj = 1; dj <= dimk; dj++) {
      var isoj = k + '-' + pad2_(dj);
      if (dailyBal[isoj] != null) carryD = dailyBal[isoj];
      bb.push(carryD == null ? null : round2_(carryD));
      dd.push(round2_((depDay[k] && depDay[k][dj]) || 0));
      rr.push(round2_((revDay[k] && revDay[k][dj]) || 0));
    }
    if (ix >= dStart) daily[k] = { b: bb, d: dd, r: rr };
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
        hist: histKeys.map(function (k) { return round2_(subSpend[par][c][k] || 0); }),
        all: allKeys.map(function (k) { return round2_(subSpend[par][c][k] || 0); }),
        td: allKeys.map(function (k) { return round2_((subSpendTD[par] && subSpendTD[par][c] && subSpendTD[par][c][k]) || 0); }),
        upc: round2_((upcS[par] && upcS[par][c]) || 0),
        exc: allKeys.map(function (k) { return round2_((excS[par] && excS[par][c] && excS[par][c][k]) || 0); })
      };
    }).filter(function (x) { return x.spent || x.hist.some(function (v) { return v; }); })
      .sort(function (a, b) { return b.spent - a.spent; });
    cats.push({ id: slug_(par), n: par, spent: s, hist: h, all: allKeys.map(function (k) { return round2_(spend[par][k] || 0); }), td: allKeys.map(function (k) { return round2_((spendTD[par] && spendTD[par][k]) || 0); }), upc: round2_(upcP[par] || 0), exc: allKeys.map(function (k) { return round2_((excP[par] && excP[par][k]) || 0); }), subs: subs, ops: [] });
  });
  cats.sort(function (a, b) { return b.spent - a.spent; });
  var catIdx = {};
  cats.forEach(function (c) { catIdx[c.n] = c; });

  // historique par marchand (toutes les opérations, pas seulement les 600 dernières) : [nb, dernière date, dernier montant, plus grosse date, plus gros montant, {mois: [total, total au même jour du mois]}]
  var merch = {}, dayNow = +todayIso.slice(8, 10);
  rows.forEach(function (r) {
    if (!(r[7] < 0) || r[0] > todayIso || r[6] === 'Mouvements internes') return;
    var k = String(r[4] || r[2] || '').replace(/^(CARTE|PRLV|VIR|SEPA|PAIEMENT)\s+/gi, '').replace(/\s+/g, ' ').trim();
    if (!k) return;
    var m = merch[k] || (merch[k] = [0, '', 0, '', 0, {}, []]), mo = r[0].slice(0, 7), x = m[5][mo] || (m[5][mo] = [0, 0]), amt = -r[7];
    m[6].push([r[0], round2_(amt), r[6] || '', r[5] || '']);
    m[0]++; if (r[0] >= m[1]) { m[1] = r[0]; m[2] = round2_(amt); } if (amt > m[4]) { m[3] = r[0]; m[4] = round2_(amt); }
    x[0] = round2_(x[0] + amt); if (+r[0].slice(8, 10) <= dayNow) x[1] = round2_(x[1] + amt);
  });

  // opérations récentes (les plus récentes d'abord)
  var opsAll = [], subIdx = {};
  cats.forEach(function (c) { c.subs.forEach(function (s) { s.ops = []; subIdx[c.n + '\u0001' + s.n] = s; }); });
  for (i = rows.length - 1; i >= 0; i--) {
    var r = rows[i], fut = r[0] > todayIso ? 1 : 0, row = [r[0], r[4] || r[2], r[6] || '', r[7], fut];
    if (opsAll.length < 600) opsAll.push(row);
    var c = catIdx[r[6] || 'Non catégorisé'];
    if (c && c.ops.length < 40) c.ops.push([r[0], r[4] || r[2], r[7], fut]);
    var sb = subIdx[(r[6] || 'Non catégorisé') + '\u0001' + r[5]];
    if (sb && sb.ops.length < 40) sb.ops.push([r[0], r[4] || r[2], r[7], fut]);
  }

  return {
    today: { iso: todayIso, day: day, days: dim, month: cur,
      label: MOIS_LONGS_[m - 1].charAt(0).toUpperCase() + MOIS_LONGS_[m - 1].slice(1) + ' ' + y,
      monthName: MOIS_LONGS_[m - 1] },
    solde: round2_(solde),
    soldeEstime: presumed > 0,
    proj: {
      value: projValue, futurs: round2_(futurs), futursList: futursList.slice(-10),
      salary: { expected: salaryExpected, day: salaryDay }, courantes: courantes, landing: landing,
      depEnd: depEnd, revEnd: revEnd
    },
    curve: { bal: bal, proj: pts, depCum: depCum, revCum: revCum, habit: habit },
    months: series,
    keys: allKeys,
    seriesAll: seriesAll,
    daily: daily,
    cats: cats,
    subs: subsRes,
    kpi: kpi, forecast: forecast, excOps: excOps.slice(0, 8), dups: dups, merchants: merchants,
    bilan: bilan_(yr, y),
    ops: opsAll,
    merch: merch,
    revOps: revOps,
    vac: vacances_(rows, todayIso, opts.sejours),
    rapport: rapport_(dailyBal, todayIso, seriesAll, kpi, solde, cur),
    livret: livret_(rows, todayIso, opts.livret),
    stats: {
      rows: rows.length, from: rows.length ? rows[0][0] : null,
      to: rows.length ? rows[rows.length - 1][0] : null,
      lastRealDate: lastRealDate, internal: internalCount
    }
  };
}

var VAC_C_ = [   // vacances scolaires zone C : [nom, premier jour, dernier jour] (data.education.gouv.fr, calendrier officiel)
  ['Toussaint 2019', '2019-10-19', '2019-11-03'], ['Noël 2019', '2019-12-21', '2020-01-05'], ['Hiver 2020', '2020-02-08', '2020-02-23'],
  ['Printemps 2020', '2020-04-04', '2020-04-19'], ['Été 2020', '2020-07-04', '2020-08-31'], ['Toussaint 2020', '2020-10-17', '2020-11-01'],
  ['Noël 2020', '2020-12-19', '2021-01-03'], ['Hiver 2021', '2021-02-13', '2021-02-28'], ['Printemps 2021', '2021-04-10', '2021-04-25'],
  ['Été 2021', '2021-07-06', '2021-09-01'], ['Toussaint 2021', '2021-10-23', '2021-11-07'], ['Noël 2021', '2021-12-18', '2022-01-02'],
  ['Hiver 2022', '2022-02-19', '2022-03-06'], ['Printemps 2022', '2022-04-23', '2022-05-08'], ['Été 2022', '2022-07-07', '2022-08-31'],
  ['Toussaint 2022', '2022-10-22', '2022-11-06'], ['Noël 2022', '2022-12-17', '2023-01-02'], ['Hiver 2023', '2023-02-18', '2023-03-05'],
  ['Printemps 2023', '2023-04-22', '2023-05-08'], ['Été 2023', '2023-07-08', '2023-09-03'], ['Toussaint 2023', '2023-10-21', '2023-11-05'],
  ['Noël 2023', '2023-12-23', '2024-01-07'], ['Hiver 2024', '2024-02-10', '2024-02-25'], ['Printemps 2024', '2024-04-06', '2024-04-21'],
  ['Été 2024', '2024-07-06', '2024-09-01'], ['Toussaint 2024', '2024-10-19', '2024-11-03'], ['Noël 2024', '2024-12-21', '2025-01-05'],
  ['Hiver 2025', '2025-02-15', '2025-03-02'], ['Printemps 2025', '2025-04-12', '2025-04-27'], ['Été 2025', '2025-07-05', '2025-08-31'],
  ['Toussaint 2025', '2025-10-18', '2025-11-02'], ['Noël 2025', '2025-12-20', '2026-01-04'], ['Hiver 2026', '2026-02-21', '2026-03-08'],
  ['Printemps 2026', '2026-04-18', '2026-05-03'], ['Été 2026', '2026-07-04', '2026-08-31'], ['Toussaint 2026', '2026-10-17', '2026-11-01'],
  ['Noël 2026', '2026-12-19', '2027-01-03'], ['Hiver 2027', '2027-02-06', '2027-02-21'], ['Printemps 2027', '2027-04-03', '2027-04-18'],
  ['Été 2027', '2027-07-03', '2027-09-01'], ['Toussaint 2027', '2027-10-23', '2027-11-07'], ['Noël 2027', '2027-12-18', '2028-01-02']
];

// ----------------------------------------------------------------- vacances

/** Vacances scolaires (zone C) : dépenses par période, postes et opérations. rows : lignes après règles. sejours : [{n, a, b}] forcés par le fichier de règles. */
function vacances_(rows, todayIso, sejours) {
  var BOOK = 120, per = VAC_C_.map(function (v) { return { n: v[0], a: v[1], b: v[2] }; });
  (sejours || []).forEach(function (s) {
    var p = per.filter(function (x) { return x.n === s.n; })[0];
    if (p) { p.a = s.a; p.b = s.b; } else per.push({ n: s.n, a: s.a, b: s.b });
  });
  per.sort(function (x, y) { return x.a < y.a ? -1 : 1; });
  var first = rows.length ? rows[0][0] : todayIso;
  per = per.filter(function (p) { return p.a <= todayIso && p.b >= first; });
  per.forEach(function (p) { p.postes = {}; p.items = []; });
  function cls(par, cat) {
    if (par === 'Transports et voyages') {
      if (cat === 'Hébergement' || cat === 'Agences et locations') return 'Hébergement';
      if (cat === 'Train et avion') return 'Train et avion';
      if (cat === 'Transports du quotidien') return null;
      return 'Transports sur place';
    }
    return (par === 'Alimentation' || par === 'Loisirs et sorties' || par === 'Shopping et équipement' || par === 'Divers') ? par : null;
  }
  rows.forEach(function (r) {
    var date = r[0], par = r[6] || '', cat = r[5] || '', amt = r[7];
    if (date > todayIso || INCOME_PARENTS.indexOf(par) > -1 || INTERNAL_RE.test(par) || INTERNAL_RE.test(cat)) return;
    var c = cls(par, cat); if (!c) return;
    var home = null, pre = false, i;
    for (i = 0; i < per.length; i++) if (date >= per[i].a && date <= per[i].b) { home = per[i]; break; }
    if (!home && (c === 'Hébergement' || c === 'Train et avion')) {
      for (i = 0; i < per.length; i++) if (per[i].a > date) { if (daysBetween_(date, per[i].a) <= BOOK) { home = per[i]; pre = true; } break; }
    }
    if (!home) return;
    var X = home.postes[c] || (home.postes[c] = { n: c, amt: 0, early: 0, subs: {}, ops: [] });
    X.amt -= amt; if (pre) X.early -= amt;
    X.subs[cat || c] = (X.subs[cat || c] || 0) - amt;
    X.ops.push([date, r[4] || r[2], round2_(-amt), pre ? 1 : 0]);
    home.items.push([date, -amt]);
  });
  function total(p) { return Object.keys(p.postes).reduce(function (s, k) { return s + p.postes[k].amt; }, 0); }
  function part(p, names) { return names.reduce(function (s, k) { return s + (p.postes[k] ? p.postes[k].amt : 0); }, 0); }
  var res = per.map(function (p) {
    var T = total(p), H = part(p, ['Hébergement']), Tr = part(p, ['Train et avion']), early = Object.keys(p.postes).reduce(function (s, k) { return s + p.postes[k].early; }, 0);
    var y = +p.n.slice(-4), prevN = p.n.slice(0, -4) + (y - 1), pv = per.filter(function (x) { return x.n === prevN; })[0];
    var cur = todayIso >= p.a && todayIso <= p.b, len = daysBetween_(p.a, p.b) + 1, day = cur ? daysBetween_(p.a, todayIso) + 1 : len, prevSame = null;
    if (pv) { var lim = addDays_(pv.a, day - 1); prevSame = pv.items.reduce(function (s, it) { return it[0] <= lim ? s + it[1] : s; }, 0); }
    var same = per.filter(function (x) { return x !== p && x.n.slice(0, -4) === p.n.slice(0, -4) && x.b < todayIso; }).map(total).filter(function (v) { return v > 0; });
    var postes = Object.keys(p.postes).map(function (k) { var X = p.postes[k];
      return { n: X.n, amt: round2_(X.amt), early: round2_(X.early),
        subs: Object.keys(X.subs).map(function (s) { return { n: s, amt: round2_(X.subs[s]) }; }).sort(function (a, b) { return b.amt - a.amt; }),
        ops: X.ops.sort(function (a, b) { return a[0] < b[0] ? 1 : -1; }).slice(0, 40) }; })
      .filter(function (x) { return x.amt > 0; }).sort(function (a, b) { return b.amt - a.amt; });
    return { id: p.n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ''), n: p.n, a: p.a, b: p.b, len: len, day: day, cur: cur, total: round2_(T), h: round2_(H), t: round2_(Tr), p: round2_(T - H - Tr),
      early: round2_(early), prev: pv ? round2_(total(pv)) : null, prevSame: prevSame == null ? null : round2_(prevSame),
      avg: same.length ? round2_(same.reduce(function (a, b) { return a + b; }, 0) / same.length) : null, postes: postes };
  }).filter(function (p) { return p.total > 0 || p.cur; });
  return res.reverse();
}


// ----------------------------------------------------------------- rapport d'analyse

/** Découvert année par année (solde de fin de journée reporté les jours sans opération), puis équilibre courant sur les 12 derniers mois complets. */
function rapport_(dailyBal, todayIso, seriesAll, kpi, solde, cur) {
  var days = Object.keys(dailyBal).sort(), out = { decouvert: { years: [], lastNeg: null, min: null, lastNegDays: null }, eq: null };
  if (days.length) {
    var d = days[0], bal = dailyBal[d], by = {}, last = null, mn = null, guard = 0;
    while (d <= todayIso && guard++ < 4000) {
      if (dailyBal[d] != null) bal = dailyBal[d];
      var y = d.slice(0, 4), Y = by[y] || (by[y] = { y: y, days: 0, n: 0, sum: 0, min: bal });
      Y.n++; Y.sum += bal; if (bal < Y.min) Y.min = bal; if (bal < 0) { Y.days++; last = d; }
      if (mn == null || bal < mn.v) mn = { d: d, v: bal };
      d = addDays_(d, 1);
    }
    out.decouvert.years = Object.keys(by).sort().map(function (k) { var Y = by[k]; return { y: Y.y, days: Y.days, min: round2_(Y.min), mean: round2_(Y.sum / Y.n), n: Y.n }; });
    out.decouvert.lastNeg = last; out.decouvert.min = mn ? { d: mn.d, v: round2_(mn.v) } : null;
    out.decouvert.lastNegDays = last ? daysBetween_(last, todayIso) : null;
    out.decouvert.totalDays = out.decouvert.years.reduce(function (s, Y) { return s + Y.days; }, 0);
  }
  var done = seriesAll.filter(function (x) { return x.k < cur; }).slice(-12);
  if (done.length) {
    var rec = 0, dep = 0, rexc = 0, dexc = 0, months = [], deficits = [];
    done.forEach(function (x) {
      var r = x.rev - x.revExc, dd = x.dep - x.exc, net = r - dd;
      rec += r; dep += dd; rexc += x.revExc; dexc += x.exc;
      months.push({ k: x.k, rev: round2_(r), revExc: round2_(x.revExc), dep: round2_(dd), exc: round2_(x.exc), net: round2_(net) });
      if (net < 0) deficits.push({ k: x.k, v: round2_(net) });
    });
    var n = done.length, margin = rec - dep;
    out.eq = { n: n, from: done[0].k, to: done[n - 1].k, rev: round2_(rec), dep: round2_(dep), margin: round2_(margin), taux: rec > 0 ? round2_(margin / rec * 100) : null,
      revExc: round2_(rexc), exc: round2_(dexc), net: round2_(margin + rexc - dexc), tauxNet: (rec + rexc) > 0 ? round2_((margin + rexc - dexc) / (rec + rexc) * 100) : null,
      months: months, deficits: deficits, avgRev: round2_(rec / n), avgDep: round2_(dep / n),
      treso: dep > 0 && solde > 0 ? round2_(solde / (dep / n)) : null, fixed: kpi.fixed, rest: kpi.rest, effort: kpi.effort };
  }
  return out;
}



// ----------------------------------------------------------------- Livret A déclaré

/** Livret A saisi à la main dans le fichier de règles (@livret) : solde connu à une date, plus les versements partis du compte courant depuis. */
function livret_(rows, todayIso, L) {
  if (!L || !(L.solde >= 0) || !L.date) return null;
  var sent = 0, n = 0;
  rows.forEach(function (r) {
    var par = r[6] || '', cat = r[5] || '';
    if (r[0] <= L.date || r[0] > todayIso || !(INTERNAL_RE.test(par) || INTERNAL_RE.test(cat)) || /^apport/i.test(cat)) return;
    sent -= r[7]; n++;
  });
  var est = round2_(L.solde + sent);
  return { solde: round2_(L.solde), date: L.date, plafond: L.plafond || null, taux: L.taux || null, interets: L.interets || null, brut: L.brut || null, since: round2_(sent), nSince: n, est: est,
    usage: L.plafond ? round2_(est / L.plafond * 100) : null, reste: L.plafond ? round2_(Math.max(0, L.plafond - est)) : null };
}

if (typeof module !== 'undefined') {
  module.exports = { sortBases_: sortBases_, balanceCheck_: balanceCheck_, COLS: COLS, toStorageRows: toStorageRows, mergeIncremental: mergeIncremental, mergeHistory: mergeHistory, splitAccounts_: splitAccounts_, savingsSummary_: savingsSummary_,
    aggregate: aggregate, vacances_: vacances_, addDays_: addDays_, parseNumber_: parseNumber_ };
}


// ------------------------------------------------------------ abonnements

/** Clé de regroupement d'un libellé : sans date, numéro ni mot générique (CARTE, PRLV…). */
function subKey_(label) {
  return String(label || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(CARTE|CB|PRLV|PRELEVEMENT|SEPA|VIR|VIREMENT|PAIEMENT|ACHAT|FACTURE|FACT|REF|ECH|ECHEANCE)\b/g, ' ')
    .split(/\s+/).filter(function (w) { return !/\d/.test(w); }).join(' ')   // les mots avec un chiffre (identifiants, dates) changent chaque mois : on les ignore
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
    (groups[k] = groups[k] || []).push({ d: date, a: -amt, n: r[4] || r[2], p: par || 'Non catégorisé', c: cat });
  });
  var list = [];

  // abonnement mensuel : environ un passage par mois, au plus 2 niveaux de prix
  function monthly(k, g) {
    var months = {};
    g.forEach(function (o) { months[o.d.slice(0, 7)] = 1; });
    if (g.length < 3 || Object.keys(months).length < 3) return null;
    var recent = g.slice(-8), gaps = [];
    for (var i = 1; i < recent.length; i++) gaps.push(daysBetween_(recent[i - 1].d, recent[i].d));
    var okGaps = gaps.filter(function (x) { return x >= 24 && x <= 38; }).length;
    if (median_(gaps) < 26 || median_(gaps) > 35 || okGaps / gaps.length < 0.7) return null;
    // montant stable : au plus 2 niveaux de prix (une hausse), chacun vu au moins 2 fois
    var levels = [];
    g.slice(-6).forEach(function (o) {
      var lv = levels.filter(function (l) { return Math.abs(l.a - o.a) <= l.a * 0.03; })[0];
      if (lv) lv.n++; else levels.push({ a: o.a, n: 1 });
    });
    if (levels.length > 2 || levels.some(function (l) { return l.n < 2; })) return null;
    var last = g[g.length - 1], amt = last.a, hausse = null, j;
    for (j = g.length - 1; j > 0 && Math.abs(g[j - 1].a - amt) <= amt * 0.02; j--) {}
    if (j > 0 && g[j].d >= addDays_(todayIso, -100) && Math.abs(g[j - 1].a - amt) > 0.5 && amt > g[j - 1].a) {
      hausse = { from: round2_(g[j - 1].a), to: round2_(amt), date: g[j].d };
    }
    var nm = shiftMonth_(last.d.slice(0, 7), 1);
    var next = nm + '-' + pad2_(Math.min(+last.d.slice(8, 10), daysInMonth_(+nm.slice(0, 4), +nm.slice(5, 7))));
    return {
      k: k, n: last.n, amt: round2_(amt), par: last.p, c: last.c, last: last.d, next: next, count: g.length,
      since: g[0].d, active: daysBetween_(last.d, todayIso) <= 45, hausse: hausse,
      nouveau: g[0].d >= addDays_(todayIso, -100)
    };
  }

  // abonnement annuel : au moins 3 passages du même montant, à environ un an d'écart
  function yearly(k, g) {
    if (g.length < 3) return null;   // 3 passages au moins : sinon un simple achat deux années de suite passerait pour un abonnement
    for (var i = 1; i < g.length; i++) {
      var gap = daysBetween_(g[i - 1].d, g[i].d);
      if (gap < 350 || gap > 380) return null;
    }
    var last = g[g.length - 1], ny = (+last.d.slice(0, 4) + 1) + last.d.slice(4);
    return {
      k: k, n: last.n, amt: round2_(last.a / 12), yearly: round2_(last.a), par: last.p, c: last.c, last: last.d, next: ny,
      count: g.length, since: g[0].d, active: daysBetween_(last.d, todayIso) <= 400, hausse: null,
      nouveau: g[0].d >= addDays_(todayIso, -100)
    };
  }

  // même libellé mais plusieurs abonnements en parallèle (ex. un service avec plusieurs offres) : on sépare par montant
  function byAmount(g) {
    var s = g.slice().sort(function (x, z) { return x.a - z.a; }), out = [];
    s.forEach(function (o) {
      var c = out[out.length - 1];
      if (c && o.a <= c[0].a * 1.03) c.push(o); else out.push([o]);
    });
    return out.map(function (c) { return c.sort(function (x, z) { return x.d < z.d ? -1 : x.d > z.d ? 1 : 0; }); });
  }

  Object.keys(groups).forEach(function (k) {
    var g = groups[k].sort(function (x, z) { return x.d < z.d ? -1 : x.d > z.d ? 1 : 0; });
    var e = monthly(k, g);
    if (e) { list.push(e); return; }
    byAmount(g).forEach(function (c) {
      var kk = k + ' ' + round2_(c[0].a), m = c.length >= 3 ? monthly(kk, c) : null;
      var y = m || yearly(kk, c);
      if (y) list.push(y);
    });
  });
  list.sort(function (a, b) { return b.amt - a.amt; });
  var total = 0, count = 0;
  list.forEach(function (x) { if (x.active) { total += x.amt; count++; } });
  return { list: list, total: round2_(total), count: count };
}


// ------------------------------------------------------------ plusieurs comptes (épargne)

/**
 * Un même dossier peut contenir plusieurs comptes (compte courant, Livret A…). Le compte courant
 * (celui déjà connu du Sheet, sinon celui qui a le plus d'opérations) alimente l'appli ; les autres sont rangés à part pour l'écran Épargne.
 * parsed : [{ f, rows }] (lignes de stockage, ordre chronologique). Renvoie { parsed, others }.
 */
function splitAccounts_(parsed, preferred) {
  var cnt = {};
  parsed.forEach(function (p) { p.rows.forEach(function (r) { var a = String(r[9] || ''); cnt[a] = (cnt[a] || 0) + 1; }); });
  var primary = preferred && cnt[preferred] ? preferred : (Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0] || ''), others = {}, q = 0;
  var mains = parsed.map(function (p) {
    var mine = [], seen = {};
    p.rows.forEach(function (r) {
      if (String(r[9] || '') === primary) { mine.push(r); return; }
      var sg = String(r[9]) + '|' + r[0] + '|' + r[2] + '|' + r[7], o = others[sg] || (others[sg] = []);
      seen[sg] = (seen[sg] || 0) + 1;
      if (seen[sg] > o.length) o.push({ r: r, q: q++ });   // la même opération vue dans plusieurs exports n'est gardée qu'une fois
    });
    return { f: p.f, rows: mine };
  }).filter(function (p) { return p.rows.length; });
  var flat = [];
  Object.keys(others).forEach(function (k) { others[k].forEach(function (o) { flat.push(o); }); });
  flat.sort(function (a, b) { return a.r[0] < b.r[0] ? -1 : a.r[0] > b.r[0] ? 1 : a.q - b.q; });
  return { parsed: mains, others: flat.map(function (o) { return o.r; }), primary: primary };
}

/** Synthèse des comptes d'épargne : solde, versements, intérêts, série mensuelle, dernières opérations. */
function savingsSummary_(rows, todayIso) {
  var by = {}, cur = todayIso.slice(0, 7), keys = [], i;
  for (i = 23; i >= 0; i--) keys.push(shiftMonth_(cur, -i));
  rows.forEach(function (r) { var a = String(r[9] || ''); (by[a] = by[a] || []).push(r); });
  var accounts = Object.keys(by).map(function (a) {
    var g = by[a], last = g[g.length - 1], ser = {}, since12 = addDays_(todayIso, -365), y = todayIso.slice(0, 4);
    var apports = 0, interets = 0, retraits = 0, ytd = 0;
    keys.forEach(function (k) { ser[k] = { dep: 0, int: 0, ret: 0 }; });
    g.forEach(function (r) {
      var mk = r[0].slice(0, 7), amt = r[7], isInt = amt > 0 && /INT[EÉ]R[EÊ]TS?/i.test(String(r[2]) + ' ' + String(r[4])), s = ser[mk];
      if (s) { if (isInt) s.int += amt; else if (amt > 0) s.dep += amt; else s.ret += -amt; }
      if (r[0] > since12) { if (isInt) interets += amt; else if (amt > 0) apports += amt; else retraits += -amt; }
      if (isInt && r[0].slice(0, 4) === y) ytd += amt;
    });
    return {
      num: a, n: String(last[10] || 'Compte épargne'), solde: round2_(last[11]), from: g[0][0], to: last[0], count: g.length,
      apports12: round2_(apports), interets12: round2_(interets), interetsYtd: round2_(ytd), retraits12: round2_(retraits),
      series: keys.map(function (k) { return { k: k, dep: round2_(ser[k].dep), int: round2_(ser[k].int), ret: round2_(ser[k].ret) }; }),
      ops: g.slice(-40).reverse().map(function (r) { return [r[0], r[4] || r[2], r[7]]; })
    };
  });
  return { accounts: accounts, total: round2_(accounts.reduce(function (s, x) { return s + x.solde; }, 0)) };
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
