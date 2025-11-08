export default ({ env }) => ({
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        sizeLimit: 1000000, // 1MB
      },
      allowedTypes: ['images'],
      allowedExtensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
      // For malware scanning, would need additional plugin
    },
  },
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '7d', // session timeout
      },
      jwtSecret: env('JWT_SECRET', 'default-secret-change-in-production'),
    },
  },
});