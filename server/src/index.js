import 'dotenv/config';
import { app } from './app.js';
import { initSchema } from './db.js';

const PORT = process.env.PORT || 4000;

await initSchema();
app.listen(PORT, () => console.log(`MIV Hub API listening on http://localhost:${PORT}`));
