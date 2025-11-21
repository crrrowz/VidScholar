// wxt.config.ts
import { defineConfig } from 'wxt';
import pkg from './package.json';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],

  // نجعل public مصدرًا مباشرًا للملفات
  assets: {
    include: ["public/icon.png", "public/icon-48.png", "public/icon-128.png"],
  },

  manifest: {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,

    // تحديد المسار الصحيح للصور من مجلد public فقط
    icons: {
      16: "icon.png",
      48: "icon-48.png",
      128: "icon-128.png"
    },

    default_locale: 'en',
    permissions: ['storage'],

    host_permissions: [
      'https://www.youtube.com/*',
      'https://*.googlevideo.com/*'
    ],

    web_accessible_resources: [
      {
        resources: [
          'jszip.min.js',
          'icon.png',
          'icon-48.png',
          'icon-128.png',
          '_locales/**/*'
        ],
        matches: ['https://www.youtube.com/*']
      }
    ]
  }
});
