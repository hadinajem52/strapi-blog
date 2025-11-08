import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::blog.blog', ({ strapi }) => ({
  async find(ctx) {
    const { data, meta } = await super.find(ctx);
    console.log('Find blogs result:', data.length, 'posts');
    return { data, meta };
  },

  async findOne(ctx) {
    const { data, meta } = await super.findOne(ctx);
    return { data, meta };
  },

  async create(ctx) {
    // Remove author from request body if present (not allowed in body)
    const { author, ...restData } = ctx.request.body.data;
    
    // Create the post data with publishedAt and author relation
    const postData = {
      ...restData,
      publishedAt: new Date().toISOString(),
      author: ctx.state.user?.id
    };
    
    console.log('Creating post with data:', postData);
    
    // Use the service to create with proper relation handling
    const entity = await strapi.entityService.create('api::blog.blog', {
      data: postData,
      populate: ['author']
    });
    
    console.log('Created entity:', entity);
    
    // Transform the entity to match REST API format
    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    
    console.log('Sanitized entity:', sanitizedEntity);
    
    return this.transformResponse(sanitizedEntity);
  },

  async update(ctx) {
    const { data, meta } = await super.update(ctx);
    return { data, meta };
  },

  async delete(ctx) {
    const { data, meta } = await super.delete(ctx);
    return { data, meta };
  },
}));