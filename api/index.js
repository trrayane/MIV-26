// Vercel serverless entry — wraps the Express app and ensures the schema exists.
import { app } from '../server/src/app.js';
import { ensureSchema } from '../server/src/db.js';

let ready;
export default async function handler(req, res) {
  ready ??= ensureSchema().catch((err) => {
    ready = undefined; // let the next request retry if init failed
    throw err;
  });
  await ready;
  return app(req, res);
}
