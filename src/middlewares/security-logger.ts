export default (config, { strapi }) => {
  return async (ctx, next) => {
    const start = Date.now();
    
    // Capture request details before processing
    const requestInfo = {
      method: ctx.method,
      url: ctx.url,
      ip: ctx.ip,
      userAgent: ctx.get('user-agent'),
      timestamp: new Date().toISOString(),
    };

    await next();
    
    const duration = Date.now() - start;

    // Log access to sensitive areas
    if (ctx.url.includes('/admin') || ctx.url.includes('/api/users')) {
      strapi.log.info(`Security: ${ctx.method} ${ctx.url} - ${ctx.status} - ${duration}ms - IP: ${ctx.ip}`);
    }

    // Log failed authentications
    if (ctx.status === 401 || ctx.status === 403) {
      strapi.log.warn(`Security: Unauthorized access attempt - ${ctx.method} ${ctx.url} - IP: ${ctx.ip} - User-Agent: ${ctx.get('user-agent')}`);
    }

    // Log authentication attempts
    if (ctx.url.includes('/api/auth/local')) {
      const outcome = ctx.status === 200 ? 'SUCCESS' : 'FAILED';
      strapi.log.info(`Security: Authentication ${outcome} - IP: ${ctx.ip} - Duration: ${duration}ms`);
    }

    // Log file uploads
    if (ctx.url.includes('/api/upload') && ctx.method === 'POST') {
      strapi.log.info(`Security: File upload attempt - Status: ${ctx.status} - IP: ${ctx.ip}`);
    }

    // Log rate limiting events
    if (ctx.status === 429) {
      strapi.log.warn(`Security: Rate limit exceeded - ${ctx.method} ${ctx.url} - IP: ${ctx.ip}`);
    }

    // Log server errors for security review
    if (ctx.status >= 500) {
      strapi.log.error(`Security: Server error - ${ctx.method} ${ctx.url} - Status: ${ctx.status} - IP: ${ctx.ip}`);
    }
  };
};