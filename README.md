# Banque — appli web installable (PWA)

Suivi de budget personnel. Ce dépôt ne contient **que le code** : aucune donnée bancaire, aucun
identifiant personnel. Les chiffres viennent de votre propre Google Drive (exports CSV BoursoBank
déposés dans un dossier, opérations stockées dans un Google Sheet) et sont lus directement par
le téléphone.

- Connexion Google (jeton gardé en mémoire uniquement, jamais envoyé ailleurs que `googleapis.com`).
- Droits demandés : lecture du Drive (pour trouver et lire le CSV) et lecture/écriture des Google Sheets.
- Verrouillage de l'écran par empreinte (WebAuthn), reverrouillage après 60 s en arrière-plan.
- Hors ligne : les chiffres de la dernière ouverture restent affichés (stockés sur l'appareil).
- « Se déconnecter » efface tout ce qui est stocké sur l'appareil.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css`, `app.js` | L'écran |
| `lib.js` | Calculs (lecture du CSV, import incrémental, postes, projection, abonnements, bilan) |
| `google.js` | Connexion Google, Drive, Sheets |
| `lock.js` | Verrouillage par empreinte |
| `config.js` | Identifiant OAuth et noms (feuille, dossier) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Installation et mode hors ligne |
| `fonts/sora-latin.woff2` | Police Sora embarquée (autorisée par la CSP de `index.html`, mise en cache hors ligne) |

## Mise en route (une seule fois)

1. **Google Cloud** (console.cloud.google.com, avec le compte qui possède le dossier d'export) :
   - Créer un projet (« Banque »).
   - APIs et services → Bibliothèque : activer **Google Drive API** et **Google Sheets API**.
   - Écran de consentement OAuth : type « Externe », nom « Banque », votre e-mail ; ajouter votre
     compte comme utilisateur test, puis passer l'application « en production » (sinon l'autorisation
     expire au bout de 7 jours). Google affichera « application non validée » : c'est normal.
   - Identifiants → Créer des identifiants → ID client OAuth → **Application Web**.
     Origine JavaScript autorisée : `https://<votre-compte>.github.io` (sans chemin, sans `/` final).
   - Copier l'ID client dans `config.js` (`CLIENT_ID`). Il n'est pas secret.
2. **GitHub Pages** : Settings → Pages → Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Ouvrir `https://<votre-compte>.github.io/banque-pwa/` sur le téléphone, se connecter, puis menu
   Chrome → « Installer l'application ».
4. Plus → activer « Verrouiller avec l'empreinte ».

## Données

Feuille Google « Banque » (à créer une fois si elle n'existe pas) avec les onglets `Operations`,
`Config`, `Budgets` (créés au besoin). Réglages de la feuille `Config` : `SALARY_PATTERN` (texte qui
repère votre salaire dans les libellés), `FOLDER_NAME`, `OVERLAP_DAYS` (45 par défaut).

## Sécurité

Activez les clés d'accès (empreinte) ou la double authentification sur le compte GitHub qui héberge
ce code : quiconque pourrait le modifier pourrait changer ce que l'appli fait avec votre jeton.
L'application n'inclut aucun script externe hormis `accounts.google.com/gsi/client`, et sa politique
de sécurité (CSP, dans `index.html`) bloque les envois vers d'autres adresses.
