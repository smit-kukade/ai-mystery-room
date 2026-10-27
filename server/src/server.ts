import 'dotenv/config';
import mongoose from 'mongoose';
import { validateRuntimeConfig } from './config/validate.js';
import type { RuntimeConfig } from './config/validate.js';

let env: RuntimeConfig;
try {
  env = validateRuntimeConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid server configuration.');
  process.exit(1);
}

const { app } = await import('./app.js');
if (env.mongoUri) {
  mongoose.connect(env.mongoUri)
    .then(() => app.listen(env.port, () => console.log(`API listening on ${env.port}`)))
    .catch(() => {
      console.error('MongoDB connection failed; API was not started.');
      process.exit(1);
    });
}
