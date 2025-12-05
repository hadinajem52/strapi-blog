// Rate limiting middleware to prevent brute force attacks
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export default (config, { strapi }) => {
  const windowMs = config.windowMs || 15 * 60 * 1000; // 15 minutes default
  const max = config.max || 8; // 8 requests per window default
  const paths = config.paths || ['/api/auth/local']; // Paths to rate limit

  return async (ctx, next) => {
    const ip = ctx.ip;
    const url = ctx.url;

    // Only rate limit specific paths
    const shouldLimit = paths.some(path => url.includes(path));
    
    if (!shouldLimit) {
      return next();
    }

    const now = Date.now();
    const key = `${ip}:${url}`;
    const record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      // New window
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      // Rate limit exceeded
      ctx.status = 429;
      ctx.body = {
        data: null,
        error: {
          status: 429,
          name: 'TooManyRequestsError',
          message: 'Too many requests, please try again later.'
        }
      };
      strapi.log.warn(`Security: Rate limit exceeded - ${ctx.method} ${ctx.url} - IP: ${ip} - Attempts: ${record.count}`);
      return;
    }

    // Increment count
    record.count++;
    rateLimitMap.set(key, record);
    
    return next();
  };
};
