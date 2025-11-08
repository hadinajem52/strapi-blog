export default {
  controllers: {
    blog: require('./controllers/blog').default,
  },
  services: {
    blog: require('./services/blog').default,
  },
  routes: require('./routes').default,
  contentTypes: require('./content-types').default,
};