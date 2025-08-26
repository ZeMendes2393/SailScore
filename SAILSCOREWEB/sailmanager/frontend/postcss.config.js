/** @type {import('postcss-load-config').Config} */
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},   // 👈 v4 usa ESTE plugin
    autoprefixer: {},
  },
};
