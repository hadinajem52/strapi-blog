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
  },
};
