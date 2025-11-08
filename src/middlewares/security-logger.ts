export default (config, { strapi }) => {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    // Log access to sensitive areas
    if (ctx.url.includes('/admin') || ctx.url.includes('/api/users')) {
      strapi.log.info(`Security: ${ctx.method} ${ctx.url} - ${ctx.status} - ${duration}ms - IP: ${ctx.ip}`);
    }

    // Log failed authentications
    if (ctx.status === 401 || ctx.status === 403) {
      strapi.log.warn(`Security: Unauthorized access attempt - ${ctx.method} ${ctx.url} - IP: ${ctx.ip}`);
    }
  };
};