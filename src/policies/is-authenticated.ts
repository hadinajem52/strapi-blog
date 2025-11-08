export default (policyContext, config, { strapi }) => {
  const { request } = policyContext;
  
  // Check if user is authenticated
  if (policyContext.state.user) {
    // User is authenticated, allow access
    return true;
  }

  // User is not authenticated
  return false;
};
