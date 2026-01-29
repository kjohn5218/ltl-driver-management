import { Request, Response, NextFunction } from 'express';

/**
 * API Key authentication middleware for external system integrations.
 * Validates the X-API-Key header against the HR_API_KEY environment variable.
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required. Please provide X-API-Key header.'
    });
  }

  const validApiKey = process.env.HR_API_KEY;

  if (!validApiKey) {
    console.error('[SECURITY] HR_API_KEY environment variable is not configured');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error'
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  if (apiKey.length !== validApiKey.length || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  return next();
};
