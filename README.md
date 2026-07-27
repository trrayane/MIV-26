<div align="center">
  <img src="client/public/favicon.svg" alt="MIV Hub logo" width="80" />

  <h1>MIV Hub</h1>

  <h3>Hub de ressources pour le Master Informatique Visuelle — USTHB</h3>

  <p>
    <img alt="React" src="https://img.shields.io/badge/frontend-React%2018%20%2B%20Vite-61DAFB?logo=react&logoColor=white">
    <img alt="Express" src="https://img.shields.io/badge/backend-Express%20(Node)-000000?logo=express&logoColor=white">
    <img alt="Postgres" src="https://img.shields.io/badge/database-Neon%20PostgreSQL-336791?logo=postgresql&logoColor=white">
    <img alt="Gemini" src="https://img.shields.io/badge/AI-Gemini%20Flash-4285F4?logo=googlegemini&logoColor=white">
    <img alt="Tailwind" src="https://img.shields.io/badge/styling-Tailwind%20CSS%203-06B6D4?logo=tailwindcss&logoColor=white">
    <img alt="Vercel" src="https://img.shields.io/badge/deploy-Vercel-000000?logo=vercel&logoColor=white">
  </p>

  <p>
    <strong>24 modules · 13 unités · 112 chapitres · 120 crédits · 1428 heures</strong>
  </p>
</div>

---

## Qu'est-ce que MIV Hub ?

MIV Hub est un hub de ressources **bilingue (FR/EN)** pour le **Master Informatique Visuelle (IV)** de l'**USTHB**, Faculté d'Électronique et d'Informatique. Il regroupe l'intégralité des 24 modules répartis sur 4 semestres, avec leurs chapitres, liens de référence, fichiers PDF, dossiers Drive, et un assistant IA — le tout dans une interface moderne, sombre, et réactive.

Les données proviennent des documents officiels du programme :
[fiche technique](https://finfo.usthb.dz/storage/disk/FichTechniqueMIV2021-1.pdf) et
[cahier des charges](https://finfo.usthb.dz/storage/disk/Master-academique-MIV-2020FINAL_num.pdf).

## Fonctionnement

```
Curriculum officiel  →  Base de données (Neon Postgres)  →  API REST (Express)
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
  Frontend React         Admin Panel             Assistant IA
  (navigation,          (CRUD ressources,        (Gemini Flash
   progression,          upload fichiers,          + contexte PDF
   signets, notes)       gestion chapitres)        par module)
```

1. **Curriculum** — les 4 semestres, unités d'enseignement et modules sont définis dans `server/src/curriculum.js` et seedés en base.
2. **Exploration** — parcourez les modules par semestre, filtrez par mot-clé, consultez les chapitres et leurs ressources.
3. **Ressources** — chaque chapitre peut contenir des liens (Cours, TD, TP, Examens, Enregistrements, Drive) et des fichiers uploadés (PDF, Office, ZIP) hébergés sur Vercel Blob.
4. **Progression** — cochez les chapitres terminés, suivez votre avancement par module et par semestre, synchronisé sur votre compte.
5. **Assistant IA** — posez des questions sur un module, l'IA répond en s'appuyant sur les PDFs du module et le contexte du curriculum.

## Fonctionnalités

- 🌳 **Arbre curriculum complet** — 4 semestres, 13 unités, 24 modules, 112 chapitres.
- 🔍 **Recherche en direct** — filtre modules par code, titre (FR/EN), résumé, enseignant ou nom de chapitre.
- 📁 **Ressources organisées** — Cours, TD, TP, Examens, Enregistrements, Drive, Autre — liens et fichiers uploadés.
- 📄 **Prévisualisation PDF** — consultable directement dans l'interface.
- 📦 **Téléchargement ZIP** — tous les fichiers d'un module en un clic.
- 🤖 **Assistant IA par module** — propulsé par Google Gemini Flash, avec contexte des PDFs du module.
- 👤 **Comptes étudiants** — inscription, connexion, synchronisation multi-appareils de la progression, des signets, des notes et des échéances.
- 📅 **Examens & échéances** — dates officielles + échéances personnelles, fusionnées et triées.
- 🎨 **Thème sombre/clair** — avec palette de couleurs personnalisable (azur, aqua, iris).
- 🌐 **Bilingue FR/EN** — interface intégralement traduite.
- 🔧 **Panneau d'administration** — `/admin` : CRUD complet des ressources, chapitres, upload fichiers, visibility des semestres, gestion de l'IA.

## Stack technique

| Couche        | Technologie |
|---------------|-------------|
| **Frontend**  | React 18, Vite 5, Tailwind CSS 3, Framer Motion 11, lucide-react, React Router 6 |
| **Backend**   | Node.js 18+, Express 4 (ES modules), JWT (jsonwebtoken), bcryptjs |
| **Base de données** | Neon Postgres (serverless) via `@neondatabase/serverless` |
| **Stockage fichiers** | Vercel Blob CDN |
| **IA**        | Google Gemini Flash (`gemini-2.0-flash-latest`) avec rotation de clés API |
| **Déploiement** | Vercel (serverless) ou Node standalone (Railway / Render / VPS) |

## Structure du projet

```
miv-hub/
├── api/
│   └── index.js              # Point d'entrée serverless Vercel
├── server/
│   ├── src/
│   │   ├── index.js          # Serveur Express
│   │   ├── app.js            # Routes, middleware, authentification
│   │   ├── db.js             # Schéma Postgres + helpers
│   │   ├── curriculum.js     # Programme officiel (données)
│   │   ├── seed.js           # Peuplement de la base
│   │   ├── assistant.js      # Assistant IA Gemini
│   │   └── local-resources.js# Ressources locales
│   ├── public/
│   │   ├── s1/               # Fichiers Semestre 1
│   │   └── s2/               # Fichiers Semestre 2
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── main.jsx          # Point d'entrée React
│   │   ├── App.jsx           # Routes (/, /admin, *)
│   │   ├── lib/              # API, i18n (FR/EN), progression, signets, notes
│   │   ├── components/       # Header, CourseCard, CourseDetail, Dashboard, etc.
│   │   └── pages/            # Hub.jsx, Admin.jsx, NotFound.jsx
│   ├── public/favicon.svg
│   └── .env.example
├── vercel.json
└── package.json
```

## Démarrage rapide

### Prérequis

- Node.js 18+
- Une base Neon Postgres (ou toute instance Postgres)
- Un token Vercel Blob (pour l'upload de fichiers)
- (Optionnel) Une ou plusieurs clés API Google Gemini

### Installation

```bash
# 1. Cloner le projet
git clone <url> && cd miv-hub

# 2. Configurer les variables d'environnement
cp server/.env.example server/.env
# Éditer server/.env : DATABASE_URL, BLOB_READ_WRITE_TOKEN, JWT_SECRET, ADMIN_PASSWORD

# 3. Installer les dépendances et seed la base
npm run setup

# 4. Lancer l'API (port 4000)
npm run dev:api

# 5. Lancer le frontend (port 5173)
npm run dev:web
```

Ouvrir [http://localhost:5173](http://localhost:5173) — Vite proxyfie `/api` vers le port 4000.

### Mode production (serveur unique)

```bash
npm run build     # build le frontend dans client/dist
npm start         # sert l'API + le frontend buildé sur le port 4000
```

## Variables d'environnement

| Variable | Requise | Rôle |
|---|---|---|
| `DATABASE_URL` | Oui | Chaîne de connexion Neon Postgres |
| `BLOB_READ_WRITE_TOKEN` | Oui | Token Vercel Blob |
| `JWT_SECRET` | Oui | Secret pour les tokens JWT |
| `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH` | Oui | Mot de passe du panneau admin |
| `GEMINI_API_KEYS` | Non | Clés API Google Gemini (séparées par des virgules) |
| `CORS_ORIGIN` | Non | Origine CORS autorisée (défaut `*`) |
| `PORT` | Non | Port du serveur (défaut `4000`) |

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run setup` | Installation complète + seed |
| `npm run dev:api` | API en mode développement |
| `npm run dev:web` | Frontend en mode développement |
| `npm run build` | Build du frontend |
| `npm run start` | Production (API + frontend) |
| `npm run seed` | Peuplement de la base |
| `npm run reset` | Réinitialisation complète (seed --force) |

## License

Projet étudiant non officiel. Les descriptions de cours, horaires, coefficients et crédits sont transcrits depuis les documents officiels du programme MIV de l'USTHB. Vérifiez la page officielle pour la version actuelle.

---

<div align="center">
  <p>Fait avec ❤️ par et pour les étudiants du Master Informatique Visuelle — USTHB</p>
</div>
