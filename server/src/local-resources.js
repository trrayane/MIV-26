import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const SUBFOLDER_LABEL = {
  cour: 'Cours',
  td: 'TD',
  tp: 'TP',
  exams: 'Examens',
};

const ARCHIVE_EXT = new Set(['.zip', '.rar', '.7z']);

function cleanTitle(filename) {
  return path.basename(filename, path.extname(filename)).replace(/[_-]+/g, ' ').trim();
}

/** Scans server/public/s<N>/<CODE>/<cour|td|tp|exams>/* and turns every file into a resource. */
function scanLocalFiles() {
  const byCourse = {};
  if (!fs.existsSync(PUBLIC_DIR)) return byCourse;

  for (const semDir of fs.readdirSync(PUBLIC_DIR)) {
    if (!/^s\d+$/.test(semDir)) continue;
    const semPath = path.join(PUBLIC_DIR, semDir);
    if (!fs.statSync(semPath).isDirectory()) continue;

    for (const code of fs.readdirSync(semPath)) {
      const courseDir = path.join(semPath, code);
      if (!fs.statSync(courseDir).isDirectory()) continue;
      const resources = [];

      for (const sub of fs.readdirSync(courseDir)) {
        const subDir = path.join(courseDir, sub);
        if (!fs.statSync(subDir).isDirectory()) continue;
        const label = SUBFOLDER_LABEL[sub] ?? sub;

        for (const file of fs.readdirSync(subDir)) {
          const ext = path.extname(file).toLowerCase();
          const url = `/files/${semDir}/${code}/${sub}/${encodeURIComponent(file)}`;
          const kind = ARCHIVE_EXT.has(ext) ? 'tool' : 'pdf';
          resources.push([`${label} — ${cleanTitle(file)}`, url, kind]);
        }
      }
      byCourse[code] = resources;
    }
  }
  return byCourse;
}

/** Extra Drive links pulled from the "lien-*.txt" notes found alongside the local files. */
const DRIVE_LINKS = {
  ABD: [['TP — TP1 et TP2 (dossier Drive)', 'https://drive.google.com/drive/folders/1Odorvw2DJdZDrGh_MqYrFbZGQUMhsYJn', 'drive']],
  CM: [
    ['Cours — Enregistrement Multimedia', 'https://drive.google.com/file/d/1P8xN3VGSmcPQxbBN12cwnKK3FKTLM9PB/view?usp=sharing', 'video'],
    ['TP — TP3 (dossier Drive)', 'https://drive.google.com/drive/folders/1nurwlRYLGgkr9c-Mg6Hcds2pCmInAZjc?usp=sharing', 'drive'],
    ['TP — TP1 Multi (dossier Drive)', 'https://drive.google.com/drive/folders/1JLY8B9JCGD7XOYefSoeiVpd-km6fZ1JK', 'drive'],
  ],
  RP: [['Cours — Chapitre 4 (dossier Drive)', 'https://drive.google.com/drive/folders/11dqhhQCK74BJPFwl4qGYE9oeKVp6C3_v?usp=sharing', 'drive']],
  SE: [
    ['Cours — Enregistrement fin chap.2 (événement, barbier) + TD (exo 4,5,6)', 'https://drive.google.com/file/d/1xCh2Wo2EsU2RuQWsLjC3QD9BUV9D_5zS/view?usp=sharing', 'video'],
    ['Cours — Enregistrement du 10/11/2024 (cours + TD)', 'https://drive.google.com/file/d/1hFtTcUA_RNh38QuM8iyyUYyUeMAC_OJp/view?usp=sharing', 'video'],
  ],
  TAI: [
    ['Cours — Enregistrement cours TAI', 'https://drive.google.com/file/d/1vwTt0MWZ5AfCQmJBJPJRjUKJvS8SnWrg/view?usp=sharing', 'video'],
    ['TD — Enregistrement TD TAI', 'https://drive.google.com/file/d/1MlqkXw9Njx536jglYdiCfWyW98YDzsbA/view?usp=sharing', 'video'],
    ['Cours — Enregistrement cours TAI (reprise)', 'https://drive.google.com/file/d/1iZHjBoQSWRUrsARH5ULB2Zuys6UfXVGQ/view', 'video'],
    ['TD — Enregistrement TD TAI (reprise)', 'https://drive.google.com/file/d/1UrOVHgUDrEQDmrALCY7Fg9nY8Q7U9Ypt/view?usp=sharing', 'video'],
    ['TP — TP5 (dossier Drive)', 'https://drive.google.com/drive/folders/1mjAGuWBDXICywr8V6A7cMyEw4W4Rb39-?usp=sharing', 'drive'],
  ],
  AA: [
    ['Cours — Enregistrement Chapitre 10', 'https://drive.google.com/file/d/1ETOdsaWAzoQ5DM4cE9etImoaFxiA3rhy/view?usp=drivesdk', 'video'],
    ['Cours — Enregistrement Chapitre 9', 'https://drive.google.com/file/d/1R5-ZCOBVyC63cAaityKYuSDaPEAdtaCi/view?usp=sharing', 'video'],
    ['Cours — Enregistrement suite chap.3 + chap.4', 'https://drive.google.com/file/d/1WNZt6mMzrThlmZZUcBJxUSDTJ16DkKyA/view?usp=sharing', 'video'],
    ['Cours — Enregistrement RN', 'https://drive.google.com/file/d/1khqazVnL5uIHUUqQafBaWspLn_4wimEL/view?usp=sharing', 'video'],
    ['Cours — Enregistrement RN (suite)', 'https://drive.google.com/file/d/1aFn0NPFqqy-StIGs9eUdUPiniUx3lMeW/view?usp=sharing', 'video'],
  ],
};

export function getLocalResources(code) {
  const files = scanLocalFiles()[code] ?? [];
  const drive = DRIVE_LINKS[code] ?? [];
  return [...files, ...drive];
}
