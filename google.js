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
    ['banque-signed', 'banque-sheet', 'banque-sig', 'banque-cache'].forEach(function (k) { store(k, null); });
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
      var f = files[0], sig = f.id + '|' + f.modifiedTime, info = { fileName: f.name, fileDate: f.modifiedTime.slice(0, 10) };
      return readOps(id).then(function (existing) {
        if (!force && load('banque-sig') === sig && existing.length) { info.skipped = true; info.lastSync = load('banque-last'); return { info: info, rows: existing }; }
        return call(DRIVE + '/files/' + f.id + '?alt=media').then(function (r) { return r.text(); }).then(function (txt) {
          var incoming = toStorageRows(parseCsv(txt.replace(/^﻿/, ''), ';'));
          var res = mergeIncremental(existing, incoming, today(), parseInt(cfg.OVERLAP_DAYS, 10) || 45);
          return writeRange(id, 'Operations', 14, res.rows).then(function () {
            store('banque-sig', sig);
            info.skipped = false; info.added = res.added; info.replaced = res.replaced; info.kept = res.kept;
            info.lastSync = new Date().toISOString().slice(0, 16); store('banque-last', info.lastSync);
            return { info: info, rows: res.rows };
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
        var data = aggregate(rows, today(), { salaryPattern: cfg.SALARY_PATTERN });
        data.sync = sync; return readBudgets(id).then(function (b) { data.budgets = b; return data; });
      });
  }

  function cacheData(d) { try { store('banque-cache', JSON.stringify(d)); } catch (e) {} }

  window.API = {
    signIn: signIn, signOut: signOut,
    wasSigned: function () { return load('banque-signed') === '1'; },
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
