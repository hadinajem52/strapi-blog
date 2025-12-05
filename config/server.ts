export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // Security: Enable rate limiting to prevent brute force attacks
  security: {
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 3, // limit each IP to 3 requests per windowMs
    },
  },
  // Security: Restrict CORS to specific origins instead of wildcard
  cors: {
    origin: env.array('CORS_ORIGIN', ['http://localhost:3000', 'http://localhost:1337']),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
    credentials: true, // Security: Allow credentials for httpOnly cookies
    keepHeaderOnError: true,
  },
  // Security: Configure secure cookie settings for JWT token storage
  cookie: {
    httpOnly: true, // Prevents JavaScript access to cookies (XSS protection)
    secure: env.bool('NODE_ENV', false) === 'production', // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    maxAge: 30 * 60 * 1000, // 30 minutes to match JWT expiration
  },
});
