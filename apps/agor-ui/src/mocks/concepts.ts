// src/mocks/concepts.ts
import type { Concept } from '../types';

export const mockConceptAuth: Concept = {
  path: 'auth.md',
  name: 'auth',
  type: 'core',
  created_at: '2025-10-01T09:00:00Z',
  last_updated: '2025-10-01T10:00:00Z',
  content: `# Authentication

Related: [[security]], [[api-design]], [[database]]

## Overview
Authentication is the process of verifying user identity.

## Common Patterns

### JWT Tokens
See [[api-design]] for token handling in REST APIs.
See [[security]] for token expiration and refresh strategies.

### OAuth 2.0
See [[security]] for OAuth security considerations.

### Database Considerations
See [[database]] for secure password storage patterns.

## Best Practices
1. Always use HTTPS (see [[security]])
2. Implement rate limiting (see [[api-design]])
3. Use prepared statements (see [[database]])`,
  related: ['security.md', 'api-design.md', 'database.md'],
};

export const mockConceptSecurity: Concept = {
  path: 'security.md',
  name: 'security',
  type: 'core',
  created_at: '2025-10-01T09:00:00Z',
  last_updated: '2025-10-01T10:00:00Z',
  content: `# Security

Related: [[auth]], [[api-design]], [[database]]

## Threat Models
- OWASP Top 10
- Authentication bypass
- SQL injection (see [[database]])
- XSS attacks

## Best Practices
1. Principle of least privilege
2. Defense in depth
3. Security by default`,
  related: ['auth.md', 'api-design.md', 'database.md'],
};

export const mockConceptDatabase: Concept = {
  path: 'database.md',
  name: 'database',
  type: 'core',
  created_at: '2025-10-01T09:00:00Z',
  last_updated: '2025-10-01T10:00:00Z',
  content: `# Database

Related: [[auth]], [[security]], [[api-design]]

## Schema Design
- Normalization strategies
- Index optimization
- Migration patterns

## Security
- Prepared statements
- Secure password storage (bcrypt, argon2)
- Row-level security`,
  related: ['auth.md', 'security.md', 'api-design.md'],
};

export const mockConcepts: Concept[] = [mockConceptAuth, mockConceptSecurity, mockConceptDatabase];
