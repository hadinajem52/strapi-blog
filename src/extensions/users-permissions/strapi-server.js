module.exports = (plugin) => {
  // Override the register controller
  plugin.controllers.auth.register = async (ctx) => {
    const { password } = ctx.request.body;
    
    // Password validation
    if (!password || password.length < 8) {
      return ctx.badRequest('Password must be at least 8 characters long');
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return ctx.badRequest('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }
    
    // Call the default register controller
    const { user } = await strapi.plugin('users-permissions').service('user').add(ctx.request.body);
    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
    
    ctx.send({
      jwt,
      user,
    });
  };
  
  return plugin;
};
