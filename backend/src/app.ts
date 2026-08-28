import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import eventRouter from './routes/event.router';
import queryRouter from './routes/query.router';
import systemRouter from './routes/system.router';
import { EventRepository } from './repositories/event.repository';

const app = express();

app.use(cors());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// JSON Body Parser with Custom SyntaxError Handling (Fixes Critical Issue 2)
app.use(express.json({ limit: '2mb' }));

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    console.warn('⚠️ Malformed JSON syntax received from client');
    
    // Asynchronously preserve raw unparseable string input in raw_events for auditability
    EventRepository.createRawEvent(
      { raw_text: (err as any).body || 'Malformed JSON string' },
      'REJECTED'
    ).then(rawId => {
      EventRepository.updateRawEvent(rawId, 'REJECTED', 'Malformed JSON syntax in request body');
    }).catch(() => {});

    return res.status(400).json({
      success: false,
      status: 'REJECTED',
      error: 'Malformed JSON syntax in request body'
    });
  }
  next(err);
});

// Primary Routes
app.use('/api', eventRouter);
app.use('/api', queryRouter);
app.use('/api/system', systemRouter);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Fault-Tolerant Data Processing Backend',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('💥 Global Uncaught Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

export default app;
