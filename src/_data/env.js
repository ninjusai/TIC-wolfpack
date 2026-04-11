module.exports = function() {
  return {
    environment: process.env.ELEVENTY_ENV || 'development',
    isProduction: process.env.ELEVENTY_ENV === 'production',
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
    url: process.env.ELEVENTY_ENV === 'production'
      ? 'https://ticgroup.com.au'
      : 'http://localhost:8080'
  };
};
