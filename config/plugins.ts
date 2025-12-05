export default ({ env }) => ({
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        sizeLimit: 1000000, // 1MB - Security: Limit file size
      },
    },
  },
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '30m', // Security: Reduced from 7d to 30 minutes to limit token theft window
      },
      jwtSecret: env('JWT_SECRET', 'default-secret-change-in-production'),
    },
  },
});