import type { User } from '../db/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
