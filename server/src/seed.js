import 'dotenv/config';
import { db, getMeta, setMeta } from './db.js';
import { SEMESTERS, PROGRAM } from './curriculum.js';
import { getLocalResources } from './local-resources.js';

const force = process.argv.includes('--force');

if (getMeta('seeded') === '1' && !force) {
  console.log('Database already seeded. Run "npm run reset" to rebuild from the official curriculum.');
  process.exit(0);
}

const insertSemester = db.prepare(`
  INSERT INTO semesters (number, label_fr, label_en, credits, coef, vhs, weekly_c, weekly_td, weekly_tp)
  VALUES (@number, @label_fr, @label_en, @credits, @coef, @vhs, @weekly_c, @weekly_td, @weekly_tp)
`);
const insertUnit = db.prepare(`
  INSERT INTO units (semester_id, code, type, label_fr, label_en, credits, coef, vhs, position)
  VALUES (@semester_id, @code, @type, @label_fr, @label_en, @credits, @coef, @vhs, @position)
`);
const insertCourse = db.prepare(`
  INSERT INTO courses (unit_id, code, title_fr, title_en, summary_fr, summary_en, prereq_fr, prereq_en,
                       teachers, credits, coef, vhs, h_c, h_td, h_tp, continu, examen, position)
  VALUES (@unit_id, @code, @title_fr, @title_en, @summary_fr, @summary_en, @prereq_fr, @prereq_en,
          @teachers, @credits, @coef, @vhs, @h_c, @h_td, @h_tp, @continu, @examen, @position)
`);
const insertChapter = db.prepare(`
  INSERT INTO chapters (course_id, position, title_fr, title_en) VALUES (?, ?, ?, ?)
`);
const insertResource = db.prepare(`
  INSERT INTO resources (course_id, chapter_id, label, url, kind, origin, position)
  VALUES (?, NULL, ?, ?, ?, 'seeded', ?)
`);

const run = db.transaction(() => {
  if (force) {
    db.exec('DELETE FROM resources; DELETE FROM chapters; DELETE FROM courses; DELETE FROM units; DELETE FROM semesters;');
  }

  for (const sem of SEMESTERS) {
    const { lastInsertRowid: semesterId } = insertSemester.run({
      number: sem.number,
      label_fr: sem.label_fr,
      label_en: sem.label_en,
      credits: sem.credits,
      coef: sem.coef,
      vhs: sem.vhs,
      weekly_c: sem.weekly?.c ?? null,
      weekly_td: sem.weekly?.td ?? null,
      weekly_tp: sem.weekly?.tp ?? null,
    });

    sem.units.forEach((unit, uIdx) => {
      const { lastInsertRowid: unitId } = insertUnit.run({
        semester_id: semesterId,
        code: unit.code,
        type: unit.type,
        label_fr: unit.label_fr,
        label_en: unit.label_en,
        credits: unit.credits,
        coef: unit.coef,
        vhs: unit.vhs,
        position: uIdx,
      });

      unit.courses.forEach((course, cIdx) => {
        const { lastInsertRowid: courseId } = insertCourse.run({
          unit_id: unitId,
          code: course.code,
          title_fr: course.title_fr,
          title_en: course.title_en,
          summary_fr: course.summary_fr ?? null,
          summary_en: course.summary_en ?? null,
          prereq_fr: course.prereq_fr ?? null,
          prereq_en: course.prereq_en ?? null,
          teachers: course.teachers ?? null,
          credits: course.credits,
          coef: course.coef,
          vhs: course.vhs,
          h_c: course.c ?? 0,
          h_td: course.td ?? 0,
          h_tp: course.tp ?? 0,
          continu: course.continu ?? 0,
          examen: course.examen ?? 0,
          position: cIdx,
        });

        (course.chapters ?? []).forEach(([fr, en], i) => insertChapter.run(courseId, i + 1, fr, en));
        const links = [...(course.links ?? []), ...getLocalResources(course.code)];
        links.forEach(([label, url, kind], i) => insertResource.run(courseId, label, url, kind, i));
      });
    });
  }

  setMeta('seeded', '1');
  setMeta('program', JSON.stringify(PROGRAM));
});

run();

const counts = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM semesters) s, (SELECT COUNT(*) FROM units) u,
            (SELECT COUNT(*) FROM courses) c, (SELECT COUNT(*) FROM chapters) ch,
            (SELECT COUNT(*) FROM resources) r`
  )
  .get();

console.log(
  `Seeded ${counts.s} semesters, ${counts.u} teaching units, ${counts.c} modules, ${counts.ch} chapters, ${counts.r} reference links.`
);
