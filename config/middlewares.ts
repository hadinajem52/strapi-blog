export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  {
    name: 'global::rate-limiter',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 8, // limit each IP to 8 requests per windowMs
      paths: ['/api/auth/local'], // Only rate limit auth endpoints
    },
  },
  'global::security-logger',
];
