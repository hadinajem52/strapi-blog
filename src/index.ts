import type { Core } from '@strapi/strapi';

// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const pluginStore = strapi.store({
      environment: strapi.config.environment,
      type: 'plugin',
      name: 'users-permissions',
    });

    await pluginStore.set({
      key: 'advanced',
      value: {
        unique_email: true,
        allow_register: true,
        email_confirmation: false,
        email_reset_password: null,
        email_confirmation_redirection: null,
        default_role: 1,
      },
    });

    // Set permissions for authenticated users
    const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    if (authenticatedRole) {
      // Permissions for blog content type
      const permissionActions = [
        'api::blog.blog.find',
        'api::blog.blog.findOne',
        'api::blog.blog.create',
        'api::blog.blog.update',
        'api::blog.blog.delete',
        // Upload permissions - all actions needed for file upload
        'plugin::upload.upload',
        'plugin::upload.actionUpload',
        'plugin::upload.find',
        'plugin::upload.findOne',
        'plugin::upload.destroy',
      ];

      for (const action of permissionActions) {
        const existing = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            action: action,
            role: authenticatedRole.id,
          },
        });
        if (!existing) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: action,
              role: authenticatedRole.id,
            },
          });
          console.log(`Created permission: ${action}`);
        } else {
          console.log(`Permission already exists: ${action}`);
        }
      }
    }
  },
};
