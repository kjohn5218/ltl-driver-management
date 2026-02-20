import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionID?: string;
      rateLimit?: {
        resetTime?: Date;
      };
    }
  }
}

// Required for module augmentation to work
export {};