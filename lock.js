/**
 * lock.js — verrouillage de l'écran par empreinte (ou code du téléphone) via WebAuthn.
 * C'est un verrou d'affichage local : rien n'est envoyé nulle part.
 */
(function () {
  'use strict';
  var KEY = 'banque-lock';
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); var b = atob(s + '==='.slice((s.length + 3) % 4)); var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function rnd(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  window.Lock = {
    enabled: function () { return !!get(); },
    supported: function () {
      if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
      return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
    },
    enable: function () {
      return navigator.credentials.create({ publicKey: {
        challenge: rnd(32), rp: { name: 'Banque', id: location.hostname },
        user: { id: rnd(16), name: 'banque', displayName: 'Banque' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000 } }).then(function (c) { try { localStorage.setItem(KEY, b64(c.rawId)); } catch (e) {} });
    },
    unlock: function () {
      var id = get(); if (!id) return Promise.resolve();
      return navigator.credentials.get({ publicKey: { challenge: rnd(32), rpId: location.hostname, timeout: 60000,
        allowCredentials: [{ type: 'public-key', id: unb64(id) }], userVerification: 'required' } }).then(function () {});
    },
    disable: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
