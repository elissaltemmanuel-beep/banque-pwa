/**
 * google.js — connexion Google (jeton gardé en mémoire seulement) et accès Drive / Sheets.
 * Rien ne part ailleurs que vers googleapis.com. Remplace le côté « Code.gs » d'Apps Script.
 */
(function () {
  'use strict';
  var CFG = window.BANQUE_CONFIG;
  var SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets';
  var DRIVE = 'https://www.googleapis.com/drive/v3', SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  var token = null, expires = 0, client = null, sheetId = null;

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // ------------------------------------------------------------- connexion
  function gis() {
    return new Promise(function (res, rej) {
      var n = 0;
      (function wait() {
        if (window.google && google.accounts && google.accounts.oauth2) return res();
        if (++n > 400) return rej(new Error('Le service de connexion Google n\'a pas pu être chargé.'));
        setTimeout(wait, 25);
      })();
    });
  }

  /** interactive=true : à appeler depuis un appui sur un bouton. false : tentative silencieuse. */
  var pending = null;   // demande de jeton en cours : les appels simultanés (préchauffage + actualisation) la partagent
  function signIn(interactive) {
    if (token && Date.now() < expires - 60000) return Promise.resolve(token);
    if (!CFG.CLIENT_ID) return Promise.reject(new Error('Identifiant Google manquant : renseignez CLIENT_ID dans config.js.'));
    if (pending && !interactive) return pending;
    var p = signIn_(interactive);
    pending = p; var done = function () { if (pending === p) pending = null; };
    p.then(done, done);
    return p;
  }
  function signIn_(interactive) {
    return gis().then(function () {
      return new Promise(function (res, rej) {
        if (!client) {
          client = google.accounts.oauth2.initTokenClient({ client_id: CFG.CLIENT_ID, scope: SCOPES, callback: function () {} });
        }
        client.callback = function (r) {
          if (r.error) return rej(new Error(r.error_description || r.error));
          token = r.access_token; expires = Date.now() + (+r.expires_in || 3600) * 1000;
          store('banque-signed', '1'); res(token);
        };
        client.error_callback = function (e) { rej(new Error((e && e.type) || 'connexion refusée')); };
        client.requestAccessToken({ prompt: interactive ? '' : 'none' });
      });
    });
  }

  function signOut() {
    var t = token; token = null; expires = 0; sheetId = null;
    ['banque-signed', 'banque-sheet', 'banque-sig', 'banque-base', 'banque-cache', 'banque-folder', 'banque-rf'].forEach(function (k) { store(k, null); });
    try { if (t && window.google && google.accounts) google.accounts.oauth2.revoke(t, function () {}); } catch (e) {}
  }

  // ------------------------------------------------------------- appels API
  function call(url, opts) {
    return signIn(false).then(function (t) {
      opts = opts || {};
      opts.headers = Object.assign({ Authorization: 'Bearer ' + t }, opts.headers || {});
      return fetch(url, opts);
    }).then(function (r) {
      if (r.ok) return r;
      return r.text().then(function (txt) {
        var m = ''; try { m = JSON.parse(txt).error.message; } catch (e) { m = txt.slice(0, 200); }
        var err = new Error(m || ('Erreur ' + r.status)); err.status = r.status; throw err;
      });
    });
  }
  function json(url, opts) { return call(url, opts).then(function (r) { return r.json(); }); }
  function q(s) { return encodeURIComponent(s); }
  function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

  function driveList(query, order) {
    return json(DRIVE + '/files?q=' + q(query) + '&orderBy=' + q(order || 'modifiedTime desc') +
      '&pageSize=20&fields=' + q('files(id,name,modifiedTime)')).then(function (d) { return d.files || []; });
  }

  function findSheet() {
    if (sheetId) return Promise.resolve(sheetId);
    var cached = load('banque-sheet');
    if (cached) { sheetId = cached; return Promise.resolve(sheetId); }
    return driveList("mimeType='application/vnd.google-apps.spreadsheet' and name='" + esc(CFG.SHEET_NAME) + "' and trashed=false").then(function (f) {
      if (!f.length) throw new Error('Google Sheet « ' + CFG.SHEET_NAME + ' » introuvable dans votre Drive.');
      sheetId = f[0].id; store('banque-sheet', sheetId); return sheetId;
    });
  }

  // ------------------------------------------------------------- feuilles
  function ensureSheet(id, title, headers) {
    return json(SHEETS + '/' + id + '?fields=sheets.properties.title').then(function (d) {
      var has = (d.sheets || []).some(function (s) { return s.properties.title === title; });
      if (has) return;
      return json(SHEETS + '/' + id + ':batchUpdate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: title } } }] }) }).then(function () {
        return json(SHEETS + '/' + id + '/values/' + q(title + '!A1') + '?valueInputOption=RAW', { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [headers] }) });
      });
    });
  }
  function readRange(id, range) {
    return json(SHEETS + '/' + id + '/values/' + q(range) + '?valueRenderOption=UNFORMATTED_VALUE').then(function (d) { return d.values || []; },
      function (e) { if (e.status === 400) return []; throw e; });
  }
  function writeRange(id, sheet, cols, rows) {
    var last = String.fromCharCode(64 + cols);
    return json(SHEETS + '/' + id + '/values/' + q(sheet + '!A2:' + last) + ':clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function () {
      if (!rows.length) return;
      return json(SHEETS + '/' + id + '/values/' + q(sheet + '!A2:' + last + (rows.length + 1)) + '?valueInputOption=RAW', { method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: rows }) });
    });
  }

  function cfgOf(v) { var m = {}; v.forEach(function (r) { if (r[0]) m[String(r[0])] = String(r[1] == null ? '' : r[1]); }); return m; }
  function budgetsOf(v) { var m = {}; v.forEach(function (r) { var n = Number(r[1]); if (r[0] && n > 0) m[String(r[0])] = n; }); return m; }
  function rulesOf(v) {
    return v.filter(function (r) { return r[0] && r[1]; }).map(function (r) { return { motif: String(r[0]), poste: String(r[1]), sous: String(r[2] || ''), montant: r[3] === '' || r[3] == null ? '' : Number(r[3]) || '' }; });
  }
  function readConfig(id) { return readRange(id, 'Config!A2:B100').then(cfgOf); }
  function readBudgets(id) { return readRange(id, 'Budgets!A2:B500').then(budgetsOf); }
  function readRules(id) { return readRange(id, 'Regles!A2:D500').then(rulesOf); }
  /** Règles écrites dans le fichier « Banque-regles.txt » du Drive (une par ligne : texte ; poste ; sous-poste ; montant). */
  function readRulesFile() {
    return driveList("name='Banque-regles.txt' and trashed=false").then(function (f) {
      if (!f.length) return { rules: [], fixes: [], sejours: [], info: 'absent' };
      try { var m = JSON.parse(load('banque-rf') || 'null'); if (m && m.id === f[0].id && m.mt === f[0].modifiedTime && m.v) return m.v; } catch (e) {}   // fichier inchangé : pas de nouvelle lecture
      return call(DRIVE + '/files/' + f[0].id + '?alt=media').then(function (r) { return r.text(); }).then(function (txt) {
        var out = [], fixes = [], sejours = [], livret = null, lep = null;
        txt.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function (line) {
          line = line.trim(); if (!line || line[0] === '#') return;
          var p = line.split(/\s*[;|\t]\s*/);
          if (p.length < 2 || !p[0] || !p[1]) return;
          if (p[0].toLowerCase() === '@fixe') {   // montant fixe attendu pour un poste ou un sous-poste
            var fm = Number(String(p[3] || '').replace(',', '.').replace(/[^0-9.]/g, ''));
            if (fm > 0) fixes.push({ poste: p[1], sous: p[2] || '', montant: fm });
            return;
          }
          if (p[0].toLowerCase() === '@livret') {   // Livret A déclaré : @livret ; solde ; date ; plafond ; taux en % ; intérêts en cours ; intérêts bruts crédités (les 4 derniers facultatifs)
            var num = function (v) { var x = Number(String(v || '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isFinite(x) && String(v || '').trim() !== '' ? x : null; };
            if (num(p[1]) != null && /^\d{4}-\d{2}-\d{2}$/.test(p[2] || '')) livret = { solde: num(p[1]), date: p[2], plafond: num(p[3]), taux: num(p[4]), interets: num(p[5]), brut: num(p[6]) };
            return;
          }
          if (p[0].toLowerCase() === '@lep') {   // LEP déclaré : @lep ; solde ; date ; taux en % (le taux est facultatif)
            var ln = function (v) { var x = Number(String(v || '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isFinite(x) && String(v || '').trim() !== '' ? x : null; };
            if (ln(p[1]) != null && /^\d{4}-\d{2}-\d{2}$/.test(p[2] || '')) lep = { solde: ln(p[1]), date: p[2], taux: ln(p[3]) };
            return;
          }
          if (p[0].toLowerCase() === '@sejour') {   // dates forcées d'une période de vacances : @sejour ; Été 2026 ; 2026-07-04 ; 2026-09-01 (dernier jour inclus)
            if (/^\d{4}-\d{2}-\d{2}$/.test(p[2] || '') && /^\d{4}-\d{2}-\d{2}$/.test(p[3] || '') && p[2] <= p[3]) sejours.push({ n: p[1], a: p[2], b: p[3] });
            return;
          }
          out.push({ motif: p[0], poste: p[1], sous: p[2] || '', montant: p[3] ? Number(String(p[3]).replace(',', '.').replace(/[^0-9.]/g, '')) || '' : '', fichier: true });
        });
        var v = { rules: out, fixes: fixes, sejours: sejours, livret: livret, lep: lep, info: 'ok' };
        store('banque-rf', JSON.stringify({ id: f[0].id, mt: f[0].modifiedTime, v: v }));
        return v;
      });
    }).catch(function (e) { if (e.status === 401) throw e; return { rules: [], fixes: [], sejours: [], info: 'erreur : ' + (e.message || e) }; });
  }
  function readEpargne(id) {
    return readRange(id, 'Epargne!A2:N').then(function (v) {
      return v.map(function (r) {
        while (r.length < 14) r.push('');
        r[0] = String(r[0]); r[1] = String(r[1]); r[7] = Number(r[7]); r[11] = Number(r[11]); r[9] = String(r[9]);
        return r;
      });
    }, function () { return []; });
  }
  function readOps(id) {
    return readRange(id, 'Operations!A2:N').then(function (v) {
      return v.map(function (r) {
        while (r.length < 14) r.push('');
        r[0] = String(r[0]); r[1] = String(r[1]); r[7] = Number(r[7]); r[11] = Number(r[11]);
        return r;
      });
    });
  }

  // ------------------------------------------------------------- CSV
  function parseCsv(text, sep) {
    var rows = [], row = [], f = '', i = 0, inq = false, c;
    while (i < text.length) {
      c = text[i];
      if (inq) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += c;
      } else if (c === '"') inq = true;
      else if (c === sep) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
      i++;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  function today() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: CFG.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  // ------------------------------------------------------------- import
  var SYNC_V = 'v3';
  function sigOf(files) { return SYNC_V + '#' + files.map(function (x) { return x.id + '|' + x.modifiedTime; }).sort().join(','); }
  function syncIfNewFile(id, cfg, force) {
    return driveList("mimeType='application/vnd.google-apps.folder' and name='" + esc(cfg.FOLDER_NAME || CFG.FOLDER_NAME) + "' and trashed=false").then(function (fo) {
      if (!fo.length) throw new Error('Dossier « ' + (cfg.FOLDER_NAME || CFG.FOLDER_NAME) + ' » introuvable dans votre Drive.');
      store('banque-folder', JSON.stringify({ name: cfg.FOLDER_NAME || CFG.FOLDER_NAME, id: fo[0].id }));   // mémo : l'actualisation saute la recherche du dossier
      return driveList("'" + fo[0].id + "' in parents and trashed=false and name contains '.csv'");
    }).then(function (files) {
      if (!files.length) throw new Error('Aucun fichier .csv dans le dossier d\'export.');
      // tous les CSV du dossier comptent : l'export le plus récent (par dernière date) sert de base,
      // les autres n'apportent que de l'historique plus ancien
      var sig = sigOf(files);   // SYNC_V : à incrémenter quand la logique de fusion change, pour forcer une relecture complète au prochain passage
      return readOps(id).then(function (existing) {
        var f0 = files[0], info = { fileName: f0.name, fileDate: f0.modifiedTime.slice(0, 10), newest: { name: f0.name, modified: f0.modifiedTime }, checkedAt: new Date().toISOString() };
        store('banque-checked', info.checkedAt);
        if (!force && load('banque-sig') === sig && load('banque-check') && existing.length) {
          // le fichier de base (le plus récent par ses dates) n'est pas forcément le dernier modifié
          try { var b0 = JSON.parse(load('banque-base') || 'null'); if (b0 && b0.n) { info.fileName = b0.n; info.fileDate = b0.d; } } catch (e) {}
          info.skipped = true; info.lastSync = load('banque-last'); try { info.check = JSON.parse(load('banque-check') || 'null'); } catch (e) {} return { info: info, rows: existing }; }
        var parsed = [], lastErr = null;
        return files.reduce(function (p, f) {
          return p.then(function () {
            return call(DRIVE + '/files/' + f.id + '?alt=media').then(function (r) { return r.text(); }).then(function (txt) {
              try { parsed.push({ f: f, rows: toStorageRows(parseCsv(txt.replace(/^﻿/, ''), ';')) }); } catch (e) { lastErr = e; }
            });
          });
        }, Promise.resolve()).then(function () {
          if (!parsed.length) throw lastErr || new Error('Aucun export lisible dans le dossier.');
          var sp = splitAccounts_(parsed, existing.length ? String(existing[0][9] || '') : ''), otherRows = sp.others;
          parsed = sp.parsed;
          if (!parsed.length) {   // le dossier ne contient que d'autres comptes (ex. un export du Livret A seul) : on les range, le compte courant reste tel quel
            if (!existing.length) throw new Error('Aucune opération du compte courant dans le dossier.');
            return (otherRows.length ? ensureSheet(id, 'Epargne', COLS).then(function () { return writeRange(id, 'Epargne', 14, otherRows); }) : Promise.resolve()).then(function () {
              store('banque-sig', sig);
              info.skipped = false; info.lastSync = new Date().toISOString().slice(0, 16); store('banque-last', info.lastSync);
              return { info: info, rows: existing };
            });
          }
          parsed = sortBases_(parsed);
          var base = parsed[0];
          info.fileName = base.f.name; info.fileDate = base.f.modifiedTime.slice(0, 10);
          var res = mergeIncremental(existing, base.rows, today(), parseInt(cfg.OVERLAP_DAYS, 10) || 45), rows = res.rows, history = 0;
          parsed.slice(1).forEach(function (p) { var h = mergeHistory(rows, p.rows); rows = h.rows; history += h.added; });
          info.check = balanceCheck_(rows, parsed); store('banque-check', JSON.stringify(info.check));
          return writeRange(id, 'Operations', 14, rows).then(function () {
            return otherRows.length ? ensureSheet(id, 'Epargne', COLS).then(function () { return writeRange(id, 'Epargne', 14, otherRows); }) : null;
          }).then(function () {
            store('banque-sig', sig); store('banque-base', JSON.stringify({ n: info.fileName, d: info.fileDate }));
            info.skipped = false; info.added = res.added; info.replaced = res.replaced; info.kept = res.kept; info.history = history;
            info.lastSync = new Date().toISOString().slice(0, 16); store('banque-last', info.lastSync);
            return { info: info, rows: rows };
          });
        });
      });
    });
  }

  function build(cfg, sync, rows, rules, rf, epRows, budgets) {
    var data = aggregate(rows, today(), { salaryPattern: cfg.SALARY_PATTERN, rules: rules.concat(rf.rules), exportDate: sync && sync.fileDate, sejours: rf.sejours || [], livret: rf.livret, lep: rf.lep });
    data.sync = sync; data.rules = rules; data.fileRules = rf.rules; data.fileRulesInfo = rf.info; data.fixes = rf.fixes || []; data.epargne = savingsSummary_(epRows, today()); data.budgets = budgets;
    return data;
  }

  /** Actualisation sans rien de nouveau dans le dossier : toutes les lectures partent en même temps (une seule attente réseau),
   *  au lieu d'une quinzaine d'appels enchaînés. Renvoie null si un import est nécessaire : le chemin complet prend alors le relais. */
  function fastCompute() {
    var hint = null; try { hint = JSON.parse(load('banque-folder') || 'null'); } catch (e) {}
    if (!hint || !hint.id || !load('banque-sig') || !load('banque-check')) return Promise.resolve(null);
    return findSheet().then(function (id) {
      return Promise.all([
        readRange(id, 'Config!A2:B100'), readOps(id), readRange(id, 'Regles!A2:D500'), readRulesFile(), readEpargne(id), readRange(id, 'Budgets!A2:B500'),
        driveList("'" + hint.id + "' in parents and trashed=false and name contains '.csv'").catch(function (e) { if (e.status === 401) throw e; return null; })
      ]);
    }).then(function (r) {
      var cfg = cfgOf(r[0]), rows = r[1], files = r[6];
      if (!rows.length || !files || !files.length || (cfg.FOLDER_NAME || CFG.FOLDER_NAME) !== hint.name || sigOf(files) !== load('banque-sig')) return null;
      var f0 = files[0], info = { fileName: f0.name, fileDate: f0.modifiedTime.slice(0, 10), newest: { name: f0.name, modified: f0.modifiedTime }, checkedAt: new Date().toISOString(), skipped: true };
      store('banque-checked', info.checkedAt);
      try { var b0 = JSON.parse(load('banque-base') || 'null'); if (b0 && b0.n) { info.fileName = b0.n; info.fileDate = b0.d; } } catch (e) {}
      info.lastSync = load('banque-last'); try { info.check = JSON.parse(load('banque-check') || 'null'); } catch (e) {}
      return build(cfg, info, rows, rulesOf(r[2]), r[3], r[4], budgetsOf(r[5]));
    });
  }

  function compute(force) {
    return (force ? Promise.resolve(null) : fastCompute()).then(function (d) { return d || slowCompute(force); });
  }

  function slowCompute(force) {
    var id, cfg, sync;
    return findSheet().then(function (sid) { id = sid; return ensureSheet(id, 'Config', ['cle', 'valeur']).then(function () { return readConfig(id); }); })
      .then(function (c) { cfg = c; return syncIfNewFile(id, cfg, force).catch(function (e) { if (e.status === 401) throw e; sync = { error: e.message }; return null; }); })
      .then(function (r) { return r ? (sync = r.info, r.rows) : readOps(id); })
      .then(function (rows) {
        if (!rows.length) throw new Error(sync && sync.error ? sync.error : 'Aucune opération pour le moment. Déposez un export CSV dans le dossier d\'export.');
        return Promise.all([readRules(id), readRulesFile(), readEpargne(id), readBudgets(id)]).then(function (rr) {
          return build(cfg, sync, rows, rr[0], rr[1], rr[2], rr[3]);
        });
      });
  }

  function cacheData(d) { try { store('banque-cache', JSON.stringify(d)); } catch (e) {} }

  window.API = {
    signIn: signIn, signOut: signOut,
    prewarm: function () { if (load('banque-signed') === '1') signIn(false).catch(function () {}); },
    wasSigned: function () { return load('banque-signed') === '1'; },
    cached: function () { try { var c = load('banque-cache'); return c ? JSON.parse(c) : null; } catch (e) { return null; } },
    getDashboard: function () {
      return compute(false).then(function (d) { cacheData(d); return d; }).catch(function (e) {
        var c = load('banque-cache');
        if (c && (!navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(e.message))) {
          var d = JSON.parse(c); d.sync = Object.assign({}, d.sync, { error: 'Hors ligne : chiffres de la dernière ouverture.' }); return d;
        }
        throw e;
      });
    },
    forceSync: function () { return compute(true).then(function (d) { cacheData(d); return d; }); },
    saveRules: function (list) {
      var id, clean = (list || []).filter(function (r) { return r && r.motif && r.poste; }).slice(0, 300).map(function (r) {
        return { motif: String(r.motif).slice(0, 120), poste: String(r.poste).slice(0, 120), sous: String(r.sous || '').slice(0, 120), montant: r.montant === '' || r.montant == null ? '' : Math.abs(Number(r.montant)) || '' };
      });
      return findSheet().then(function (sid) { id = sid; return ensureSheet(id, 'Regles', ['motif', 'poste', 'sous_poste', 'montant']); })
        .then(function () { return writeRange(id, 'Regles', 4, clean.map(function (r) { return [r.motif, r.poste, r.sous, r.montant]; })); })
        .then(function () { return clean; });
    },
    saveBudget: function (poste, montant) {
      montant = Number(montant);
      if (!poste || !isFinite(montant)) return Promise.reject(new Error('Plafond invalide.'));
      var id;
      return findSheet().then(function (sid) { id = sid; return ensureSheet(id, 'Budgets', ['poste', 'plafond']); })
        .then(function () { return readBudgets(id); }).then(function (b) {
          if (montant > 0) b[String(poste).slice(0, 120)] = Math.round(montant * 100) / 100; else delete b[poste];
          var rows = Object.keys(b).map(function (k) { return [k, b[k]]; });
          return writeRange(id, 'Budgets', 2, rows).then(function () { return b; });
        });
    }
  };
})();
