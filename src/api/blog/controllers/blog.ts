import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::blog.blog', ({ strapi }) => ({
  async find(ctx) {
    // Use entityService to ensure proper population
    const entities = await strapi.entityService.findMany('api::blog.blog', {
      ...ctx.query,
      populate: ['author', 'image']
    });
    
    console.log('Find blogs result:', entities.length, 'posts');
    
    // Manually format the response to include author data
    const formattedData = entities.map((entity: any) => {
      console.log('Entity image:', entity.image);
      return {
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
        } : null,
        image: entity.image ? {
          id: entity.image.id,
          url: entity.image.url,
          name: entity.image.name,
          alternativeText: entity.image.alternativeText
        } : null
      };
    });
    
    return { data: formattedData };
  },

  async findOne(ctx) {
    const { data, meta } = await super.findOne(ctx);
    return { data, meta };
  },

  async create(ctx) {
    try {
      // Parse the data field from FormData
      let data;
      try {
        data = JSON.parse(ctx.request.body.data);
      } catch (error) {
        return ctx.badRequest('Invalid data format');
      }
      
      console.log('Request files:', ctx.request.files);
      console.log('Request body:', ctx.request.body);
      
      // Handle file upload if present
      let uploadedImage = null;
      if (ctx.request.files && ctx.request.files['files.image']) {
        const file = Array.isArray(ctx.request.files['files.image']) ? ctx.request.files['files.image'][0] : ctx.request.files['files.image'];
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
          return ctx.badRequest('Invalid file type. Only images are allowed.');
        }

        // Validate file size (1MB max)
        const maxSize = 1 * 1024 * 1024; // 1MB
        if (file.size > maxSize) {
          return ctx.badRequest('File too large. Maximum size is 1MB.');
        }

        // Upload the file
        const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
          data: {},
          files: [file],
        });
        
        console.log('Upload result:', uploadedFiles);
        if (uploadedFiles && uploadedFiles.length > 0) {
          uploadedImage = uploadedFiles[0].id;
          console.log('Uploaded image ID:', uploadedImage);
        }
      }

      // Remove author from request body if present (not allowed in body)
      const { author, ...restData } = data;
      
      // Create the post data with publishedAt, author relation, and image
      const postData = {
        ...restData,
        publishedAt: new Date().toISOString(),
        author: ctx.state.user?.id,
        ...(uploadedImage && { image: { id: uploadedImage } })
      };
      
      console.log('Creating post with data:', postData);
      
      // Use the service to create with proper relation handling
      const entity = await strapi.entityService.create('api::blog.blog', {
        data: postData,
        populate: ['author', 'image']
      });
      
      console.log('Created entity:', entity);
      
      // Transform the entity to match REST API format
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      
      console.log('Sanitized entity:', sanitizedEntity);
      
      return this.transformResponse(sanitizedEntity);
    } catch (error: any) {
      console.error('Create error details:', error);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      if (error.errors) {
        console.error('Validation errors:', error.errors);
      }
      return ctx.badRequest('Failed to create post: ' + error.message);
    }
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