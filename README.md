# MIV Hub — Master Informatique Visuelle, USTHB

Resource hub for the **Master Informatique Visuelle (IV)** at USTHB, Faculté d'Électronique et
d'Informatique. Every module of the four semesters, its chapters, and the links you attach to
them — in French and English.

Data comes from the official programme documents:
[fiche technique](https://finfo.usthb.dz/storage/disk/FichTechniqueMIV2021-1.pdf) and
[cahier des charges](https://finfo.usthb.dz/storage/disk/Master-academique-MIV-2020FINAL_num.pdf)
(2021-2022 accreditation).

**24 modules · 13 teaching units · 112 chapters · 120 credits · 1428 hours**

---

## Stack

| Layer    | Choice                                                                 |
| -------- | ---------------------------------------------------------------------- |
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, lucide-react, React Router |
| Backend  | Node + Express (ES modules), JWT auth, bcrypt                          |
| Database | SQLite via better-sqlite3 (single file, zero setup)                    |

---

## Run it locally

Two terminals, from the project root.

```bash
# 1. API — http://localhost:4000
cd server
cp .env.example .env          # then edit JWT_SECRET and ADMIN_PASSWORD
npm install
npm run seed                  # loads the official curriculum into data/miv.db
npm run dev

# 2. Frontend — http://localhost:5173
cd client
npm install
npm run dev
```

Vite proxies `/api` to port 4000, so no CORS setup is needed in development.

The admin page lives at `/admin`. The default password is `miv-admin` — change it in `server/.env`
before putting this online.

### Single-server production mode

```bash
cd client && npm run build     # outputs client/dist
cd ../server && npm start      # serves the API *and* the built frontend on :4000
```

The Express app serves `client/dist` when it exists, with an SPA fallback so `/admin` works on a
hard refresh.

---

## Structure

```
miv-hub/
├── server/
│   ├── src/
│   │   ├── curriculum.js   # the official programme: semesters → units → modules → chapters
│   │   ├── db.js           # SQLite schema + connection
│   │   ├── seed.js         # loads curriculum.js into the database
│   │   └── index.js        # Express API
│   └── data/miv.db         # created by the seed
└── client/
    ├── src/
    │   ├── lib/i18n.jsx    # FR/EN dictionary + language context
    │   ├── lib/api.js      # fetch wrapper with token handling
    │   ├── components/     # ui atoms, header, stat bar, course card, detail panel, footer
    │   └── pages/          # Hub.jsx, Admin.jsx
    └── tailwind.config.js  # blue palette + type scale
```

---

## Data model

```
semesters ──< units ──< courses ──< chapters
                          └──────< resources (chapter_id nullable)
```

`resources.origin` distinguishes seeded reference links (curated open courseware, documentation)
from `custom` links you add yourself. `courses.drive_url` holds the main Drive folder shown on the
card button.

---

## API

Public:

| Method | Route                  | Purpose                                        |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/api/program`         | University, degree, official document links    |
| GET    | `/api/curriculum`      | Full tree; `?semester=1` narrows it            |
| GET    | `/api/stats`           | Totals plus per-semester breakdown             |
| GET    | `/api/courses/:code`   | One module with chapters and resources         |
| GET    | `/api/health`          | Uptime probe                                   |

Requires `Authorization: Bearer <token>`:

| Method | Route                        | Purpose                             |
| ------ | ---------------------------- | ----------------------------------- |
| POST   | `/api/auth/login`            | Exchange the password for a token   |
| GET    | `/api/admin/courses`         | Flat module list with link counts   |
| POST   | `/api/resources`             | Add a link (module or chapter)      |
| PUT    | `/api/resources/:id`         | Edit a link                         |
| DELETE | `/api/resources/:id`         | Remove a link                       |
| PUT    | `/api/courses/:id/drive`     | Set the module's Drive folder       |

---

## Adding your Drive links

1. Open `/admin` and sign in.
2. Pick a module in the left column.
3. **Module Drive folder** — the shared folder for the whole module. It becomes the destination of
   the card's main button.
4. **Add a link** — name, URL, type, and optionally a chapter. Links attached to a chapter appear
   under that chapter in the module panel; links with no chapter appear in the module's Resources
   section.

## Editing the curriculum

`server/src/curriculum.js` is the single source of truth for programme content. Edit it, then:

```bash
cd server && npm run reset    # rebuilds every table from the file — custom links are erased
```

To keep your own links, add chapters or modules through a small migration instead of `reset`.

---

## Deploying

**One service (simplest).** Build the client, deploy the `server` folder on Railway, Render, or a
VPS, and point the start command at `npm start`. Mount a persistent volume and set `DATA_DIR` to it
so `miv.db` survives restarts.

**Two services.** Deploy `client/dist` to Vercel or Netlify with `VITE_API_URL` set to the API
origin, and the API anywhere Node runs. Set `CORS_ORIGIN` to the frontend URL.

Before going live:

- set a long random `JWT_SECRET`
- set `ADMIN_PASSWORD_HASH` instead of the plain password:
  `node -e "console.log(require('bcryptjs').hashSync('your-password',10))"`
- set `CORS_ORIGIN` to your frontend origin

---

## Notes

Unofficial student resource. Course descriptions, hours, coefficients and credits are transcribed
from the USTHB programme documents; check the official page for the current version.
