import { initializeDatabase } from '../src/config/database.js';

async function main() {
  await initializeDatabase();
  console.log('Database initialized successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
