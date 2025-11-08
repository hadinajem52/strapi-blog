export default (config, { strapi }) => {
  const requests = new Map();
  
  return async (ctx, next) => {
    // Skip rate limiting for admin panel
    if (ctx.request.url.startsWith('/admin')) {
      return await next();
    }
    
    const ip = ctx.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100; // max requests per window
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const userRequests = requests.get(ip);
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < windowMs);
    requests.set(ip, validRequests);
    
    if (validRequests.length >= maxRequests) {
      ctx.status = 429;
      ctx.body = 'Too many requests';
      return;
    }
    
    validRequests.push(now);
    await next();
  };
};