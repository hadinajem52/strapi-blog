import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::blog.blog', ({ strapi }) => ({
  async find(ctx) {
    // Use entityService to ensure proper population
    const entities = await strapi.entityService.findMany('api::blog.blog', {
      ...ctx.query,
      populate: ['author']
    });
    
    console.log('Find blogs result:', entities.length, 'posts');
    
    // Manually format the response to include author data
    const formattedData = entities.map((entity: any) => ({
      id: entity.id,
      documentId: entity.documentId,
      title: entity.title,
      content: entity.content,
      publishedAt: entity.publishedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      author: entity.author ? {
        id: entity.author.id,
        username: entity.author.username,
        email: entity.author.email
      } : null
    }));
    
    return { data: formattedData };
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