import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '@vercel/blob';
import { sql, initSchema, getMeta, setMeta } from './db.js';
import { SEMESTERS, PROGRAM } from './curriculum.js';
import { getLocalResources } from './local-resources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const force = process.argv.includes('--force');

const CONTENT_TYPE = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.ipynb': 'application/json',
};

const blobCache = new Map(); // relative path -> blob url

/** Local `/files/…` resources are uploaded to Vercel Blob; everything else (Drive links) stays as-is. */
async function resolveUrl(url) {
  if (!url.startsWith('/files/')) return url;
  const rel = url.replace(/^\/files\//, '');
  if (blobCache.has(rel)) return blobCache.get(rel);
  const segments = rel.split('/').map(decodeURIComponent);
  const abs = path.join(PUBLIC_DIR, ...segments);
  if (!fs.existsSync(abs)) {
    console.warn('  ! missing file, keeping placeholder:', rel);
    return url;
  }
  const ext = path.extname(abs).toLowerCase();
  const buffer = fs.readFileSync(abs);
  const blob = await put(segments.join('/'), buffer, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: CONTENT_TYPE[ext],
  });
  blobCache.set(rel, blob.url);
  return blob.url;
}

async function seed() {
  await initSchema();

  if ((await getMeta('seeded')) === '1' && !force) {
    console.log('Database already seeded. Run "npm run reset" to rebuild from the official curriculum.');
    return;
  }

  if (force) {
    await sql`TRUNCATE resources, chapters, courses, units, semesters RESTART IDENTITY CASCADE`;
  }

  let fileCount = 0;
  for (const sem of SEMESTERS) {
    const [semRow] = await sql`
      INSERT INTO semesters (number, label_fr, label_en, credits, coef, vhs, weekly_c, weekly_td, weekly_tp)
      VALUES (${sem.number}, ${sem.label_fr}, ${sem.label_en}, ${sem.credits}, ${sem.coef}, ${sem.vhs},
              ${sem.weekly?.c ?? null}, ${sem.weekly?.td ?? null}, ${sem.weekly?.tp ?? null})
      RETURNING id`;
    const semesterId = semRow.id;

    for (let uIdx = 0; uIdx < sem.units.length; uIdx++) {
      const unit = sem.units[uIdx];
      const [unitRow] = await sql`
        INSERT INTO units (semester_id, code, type, label_fr, label_en, credits, coef, vhs, position)
        VALUES (${semesterId}, ${unit.code}, ${unit.type}, ${unit.label_fr}, ${unit.label_en},
                ${unit.credits}, ${unit.coef}, ${unit.vhs}, ${uIdx})
        RETURNING id`;
      const unitId = unitRow.id;

      for (let cIdx = 0; cIdx < unit.courses.length; cIdx++) {
        const course = unit.courses[cIdx];
        const [courseRow] = await sql`
          INSERT INTO courses (unit_id, code, title_fr, title_en, summary_fr, summary_en, prereq_fr, prereq_en,
                               teachers, credits, coef, vhs, h_c, h_td, h_tp, continu, examen, position)
          VALUES (${unitId}, ${course.code}, ${course.title_fr}, ${course.title_en},
                  ${course.summary_fr ?? null}, ${course.summary_en ?? null}, ${course.prereq_fr ?? null},
                  ${course.prereq_en ?? null}, ${course.teachers ?? null}, ${course.credits}, ${course.coef},
                  ${course.vhs}, ${course.c ?? 0}, ${course.td ?? 0}, ${course.tp ?? 0},
                  ${course.continu ?? 0}, ${course.examen ?? 0}, ${cIdx})
          RETURNING id`;
        const courseId = courseRow.id;

        const chapters = course.chapters ?? [];
        for (let i = 0; i < chapters.length; i++) {
          const [fr, en] = chapters[i];
          await sql`INSERT INTO chapters (course_id, position, title_fr, title_en) VALUES (${courseId}, ${i + 1}, ${fr}, ${en})`;
        }

        const links = [...(course.links ?? []), ...getLocalResources(course.code)];
        for (let i = 0; i < links.length; i++) {
          const [label, rawUrl, kind] = links[i];
          const url = await resolveUrl(rawUrl);
          if (rawUrl.startsWith('/files/')) fileCount++;
          await sql`
            INSERT INTO resources (course_id, chapter_id, label, url, kind, origin, position)
            VALUES (${courseId}, NULL, ${label}, ${url}, ${kind}, 'seeded', ${i})`;
        }
        process.stdout.write(`  seeded ${course.code} (${links.length} links)\n`);
      }
    }
  }

  await setMeta('seeded', '1');
  await setMeta('program', JSON.stringify(PROGRAM));

  const [counts] = await sql`
    SELECT (SELECT COUNT(*) FROM semesters)::int s, (SELECT COUNT(*) FROM units)::int u,
           (SELECT COUNT(*) FROM courses)::int c, (SELECT COUNT(*) FROM chapters)::int ch,
           (SELECT COUNT(*) FROM resources)::int r`;
  console.log(
    `\nSeeded ${counts.s} semesters, ${counts.u} units, ${counts.c} modules, ${counts.ch} chapters, ${counts.r} resources (${fileCount} files uploaded to Blob).`
  );
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
