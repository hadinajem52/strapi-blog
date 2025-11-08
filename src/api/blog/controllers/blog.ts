import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::blog.blog', ({ strapi }) => ({
  async find(ctx) {
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  async findOne(ctx) {
    const { data, meta } = await super.findOne(ctx);
    return { data, meta };
  },

  async create(ctx) {
    const { data, meta } = await super.create(ctx);
    return { data, meta };
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