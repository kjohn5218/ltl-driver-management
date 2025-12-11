# Security Implementation Guide

This document provides guidance on the security features implemented in the LTL Driver Management application.

## Security Features Overview

### 1. Authentication & Authorization
- **JWT-based authentication** with 15-minute access tokens
- **Resource-level authorization** to prevent IDOR attacks
- **Role-based access control** (ADMIN, DISPATCHER, CARRIER, USER)
- **Enhanced password policy** (12+ characters, NIST compliant)

### 2. Rate Limiting
Different rate limits for different endpoint types:
- Authentication endpoints: 5 requests/minute
- Password reset: 3 requests/minute
- Authenticated API: 100 requests/minute
- Public API: 20 requests/minute
- File uploads: 10 uploads/5 minutes

### 3. Security Headers
- **HSTS** (Strict-Transport-Security) in production
- **CSP** (Content-Security-Policy) to prevent XSS
- **X-Frame-Options** to prevent clickjacking
- **COOP/COEP** for cross-origin isolation
- Additional hardening headers via Helmet.js

### 4. Malicious Request Detection
- Pattern-based detection for common attacks
- Strike-based blocking system:
  - 1 strike: Warning
  - 3 strikes: 1-hour block
  - 10 strikes: 30-day ban
- Database persistence for blocks

### 5. CSRF Protection
- Token-based CSRF protection for state-changing operations
- Double-submit cookie pattern
- Automatic token generation and validation

### 6. Logging & Monitoring
- Security event logging (auth failures, attacks, etc.)
- Request ID tracking for correlation
- Sensitive data redaction in logs
- Structured JSON logging

## Implementation Guide

### Setting Up Security

1. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env and set a secure JWT_SECRET (minimum 32 characters)
   # Generate with: openssl rand -base64 32
   ```

2. **Initialize Database Tables**
   The security tables will be automatically created on first run.

3. **Apply Authorization Middleware**
   For any endpoint that accesses user resources:
   ```typescript
   import { checkResourceOwnership } from '../middleware/authorization.middleware';
   
   router.get('/:id', 
     authenticate, 
     checkResourceOwnership('booking'), 
     getBookingById
   );
   ```

### Using Security Features

#### Rate Limiting
Rate limits are automatically applied. To add custom limits:
```typescript
import { createPersistentLimiter } from '../middleware/rateLimiter.middleware';

const customLimiter = createPersistentLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10 // 10 requests per window
});

router.use('/api/custom', customLimiter);
```

#### Logging Security Events
```typescript
import { logSecurityEvent, SecurityEventType } from '../middleware/logging.middleware';

// Log a security event
logSecurityEvent(
  SecurityEventType.SENSITIVE_DATA_ACCESS,
  req,
  'User accessed financial records',
  { recordId: 123 }
);
```

#### CSRF Protection
CSRF tokens are automatically generated. In your frontend:
```javascript
// Get CSRF token from response header
const csrfToken = response.headers['x-csrf-token'];

// Include in subsequent requests
fetch('/api/data', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken
  }
});
```

## Security Best Practices

### 1. Never Trust User Input
- Always validate and sanitize input
- Use parameterized queries (Prisma handles this)
- Implement strict input schemas

### 2. Principle of Least Privilege
- Users should only access their own data
- Admin privileges should be limited
- Use role-based access control

### 3. Defense in Depth
- Multiple layers of security
- Don't rely on a single security control
- Assume breaches will happen

### 4. Secure by Default
- Deny access unless explicitly allowed
- Use secure defaults for all configurations
- Fail securely (closed)

### 5. Regular Updates
- Keep dependencies updated
- Run `npm audit` regularly
- Monitor security advisories

## Troubleshooting

### Common Issues

1. **"JWT_SECRET not configured" error**
   - Ensure JWT_SECRET is set in .env
   - Must be at least 32 characters long

2. **Rate limit errors**
   - Check if you're hitting rate limits
   - Consider increasing limits for authenticated users

3. **CSRF token errors**
   - Ensure CSRF token is included in requests
   - Check token hasn't expired (1 hour lifetime)

4. **Authorization failures**
   - Verify user has access to the resource
   - Check role-based permissions

### Security Logs

Security logs are stored in the `./logs` directory:
- `security-YYYY-MM-DD.log` - Security events
- Check logs for attack patterns and unauthorized access attempts

## Security Checklist for Developers

Before deploying new features:
- [ ] All endpoints have authentication (unless explicitly public)
- [ ] Resource access checks ownership
- [ ] Input is validated and sanitized
- [ ] Sensitive operations are logged
- [ ] No hardcoded secrets or credentials
- [ ] Error messages don't leak sensitive information
- [ ] File uploads are restricted and validated
- [ ] Dependencies are up to date

## Reporting Security Issues

If you discover a security vulnerability:
1. Do NOT create a public issue
2. Email security concerns to the development team
3. Include steps to reproduce
4. Allow time for a fix before disclosure

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [Security Headers](https://securityheaders.com/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)