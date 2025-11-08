export default {
  routes: [
    {
      method: 'GET',
      path: '/blogs',
      handler: 'blog.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/blogs/:id',
      handler: 'blog.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/blogs',
      handler: 'blog.create',
      config: {
        policies: ['global::is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/blogs/:id',
      handler: 'blog.update',
      config: {
        policies: ['global::is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/blogs/:id',
      handler: 'blog.delete',
      config: {
        policies: ['global::is-authenticated'],
        middlewares: [],
      },
    },
  ],
};