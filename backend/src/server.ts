import app from './app';
import { initDatabase } from './config/database';

const PORT = process.env.PORT || 4000;

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Fault-Tolerant Data Processing Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
