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
        if (++n > 100) return rej(new Error('Le service de connexion Google n\'a pas pu être chargé.'));
        setTimeout(wait, 100);
      })();
    });
  }

  /** interactive=true : à appeler depuis un appui sur un bouton. false : tentative silencieuse. */
  function signIn(interactive) {
    if (token && Date.now() < expires - 60000) return Promise.resolve(token);
    if (!CFG.CLIENT_ID) return Promise.reject(new Error('Identifiant Google manquant : renseignez CLIENT_ID dans config.js.'));
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
    ['banque-signed', 'banque-sheet', 'banque-sig', 'banque-base', 'banque-cache'].forEach(function (k) { store(k, null); });
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

  function readConfig(id) {
    return readRange(id, 'Config!A2:B100').then(function (v) {
      var m = {}; v.forEach(function (r) { if (r[0]) m[String(r[0])] = String(r[1] == null ? '' : r[1]); });
      return m;
    });
  }
  function readBudgets(id) {
    return readRange(id, 'Budgets!A2:B500').then(function (v) {
      var m = {}; v.forEach(function (r) { var n = Number(r[1]); if (r[0] && n > 0) m[String(r[0])] = n; });
      return m;
    });
  }
  function readRules(id) {
    return readRange(id, 'Regles!A2:D500').then(function (v) {
      return v.filter(function (r) { return r[0] && r[1]; }).map(function (r) { return { motif: String(r[0]), poste: String(r[1]), sous: String(r[2] || ''), montant: r[3] === '' || r[3] == null ? '' : Number(r[3]) || '' }; });
    });
  }
  /** Règles écrites dans le fichier « Banque-regles.txt » du Drive (une par ligne : texte ; poste ; sous-poste ; montant). */
  function readRulesFile() {
    return driveList("name='Banque-regles.txt' and trashed=false").then(function (f) {
      if (!f.length) return { rules: [], fixes: [], sejours: [], info: 'absent' };
      return call(DRIVE + '/files/' + f[0].id + '?alt=media').then(function (r) { return r.text(); }).then(function (txt) {
        var out = [], fixes = [], sejours = [];
        txt.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function (line) {
          line = line.trim(); if (!line || line[0] === '#') return;
          var p = line.split(/\s*[;|\t]\s*/);
          if (p.length < 2 || !p[0] || !p[1]) return;
          if (p[0].toLowerCase() === '@fixe') {   // montant fixe attendu pour un poste ou un sous-poste
            var fm = Number(String(p[3] || '').replace(',', '.').replace(/[^0-9.]/g, ''));
            if (fm > 0) fixes.push({ poste: p[1], sous: p[2] || '', montant: fm });
            return;
          }
          if (p[0].toLowerCase() === '@sejour') {   // dates forcées d'une période de vacances : @sejour ; Été 2026 ; 2026-07-04 ; 2026-09-01 (dernier jour inclus)
            if (/^\d{4}-\d{2}-\d{2}$/.test(p[2] || '') && /^\d{4}-\d{2}-\d{2}$/.test(p[3] || '') && p[2] <= p[3]) sejours.push({ n: p[1], a: p[2], b: p[3] });
            return;
          }
          out.push({ motif: p[0], poste: p[1], sous: p[2] || '', montant: p[3] ? Number(String(p[3]).replace(',', '.').replace(/[^0-9.]/g, '')) || '' : '', fichier: true });
        });
        return { rules: out, fixes: fixes, sejours: sejours, info: 'ok' };
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
  function syncIfNewFile(id, cfg, force) {
    return driveList("mimeType='application/vnd.google-apps.folder' and name='" + esc(cfg.FOLDER_NAME || CFG.FOLDER_NAME) + "' and trashed=false").then(function (fo) {
      if (!fo.length) throw new Error('Dossier « ' + (cfg.FOLDER_NAME || CFG.FOLDER_NAME) + ' » introuvable dans votre Drive.');
      return driveList("'" + fo[0].id + "' in parents and trashed=false and name contains '.csv'");
    }).then(function (files) {
      if (!files.length) throw new Error('Aucun fichier .csv dans le dossier d\'export.');
      // tous les CSV du dossier comptent : l'export le plus récent (par dernière date) sert de base,
      // les autres n'apportent que de l'historique plus ancien
      var sig = files.map(function (x) { return x.id + '|' + x.modifiedTime; }).sort().join(',');
      return readOps(id).then(function (existing) {
        var f0 = files[0], info = { fileName: f0.name, fileDate: f0.modifiedTime.slice(0, 10) };
        if (!force && load('banque-sig') === sig && existing.length) {
          // le fichier de base (le plus récent par ses dates) n'est pas forcément le dernier modifié
          try { var b0 = JSON.parse(load('banque-base') || 'null'); if (b0 && b0.n) { info.fileName = b0.n; info.fileDate = b0.d; } } catch (e) {}
          info.skipped = true; info.lastSync = load('banque-last'); return { info: info, rows: existing }; }
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
          parsed.sort(function (a, b) {
            var da = a.rows[a.rows.length - 1][0], db = b.rows[b.rows.length - 1][0];
            return da === db ? b.rows.length - a.rows.length : (da < db ? 1 : -1);
          });
          var base = parsed[0];
          info.fileName = base.f.name; info.fileDate = base.f.modifiedTime.slice(0, 10);
          var res = mergeIncremental(existing, base.rows, today(), parseInt(cfg.OVERLAP_DAYS, 10) || 45), rows = res.rows, history = 0;
          parsed.slice(1).forEach(function (p) { var h = mergeHistory(rows, p.rows); rows = h.rows; history += h.added; });
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

  function compute(force) {
    var id, cfg, sync;
    return findSheet().then(function (sid) { id = sid; return ensureSheet(id, 'Config', ['cle', 'valeur']).then(function () { return readConfig(id); }); })
      .then(function (c) { cfg = c; return syncIfNewFile(id, cfg, force).catch(function (e) { if (e.status === 401) throw e; sync = { error: e.message }; return null; }); })
      .then(function (r) { return r ? (sync = r.info, r.rows) : readOps(id); })
      .then(function (rows) {
        if (!rows.length) throw new Error(sync && sync.error ? sync.error : 'Aucune opération pour le moment. Déposez un export CSV dans le dossier d\'export.');
        return Promise.all([readRules(id), readRulesFile(), readEpargne(id)]).then(function (rr) {
          var rules = rr[0], fileRules = rr[1].rules, epRows = rr[2];
          var data = aggregate(rows, today(), { salaryPattern: cfg.SALARY_PATTERN, rules: rules.concat(fileRules), exportDate: sync && sync.fileDate, sejours: rr[1].sejours || [] });
          data.sync = sync; data.rules = rules; data.fileRules = fileRules; data.fileRulesInfo = rr[1].info; data.fixes = rr[1].fixes || []; data.epargne = savingsSummary_(epRows, today());
          return readBudgets(id).then(function (b) { data.budgets = b; return data; });
        });
      });
  }

  function cacheData(d) { try { store('banque-cache', JSON.stringify(d)); } catch (e) {} }

  window.API = {
    signIn: signIn, signOut: signOut,
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
