// This runs in Node.js. Don't use client-side code here (browser APIs, JSX...).

const {themes: prismThemes} = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'API Kit',
  tagline: 'Token lifecycle, safe refresh and storage adapters for API clients',

  url: 'https://88khp.github.io',
  baseUrl: '/api-kit/',

  organizationName: '88khp',
  projectName: 'api-kit',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/88khp/api-kit/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'API Kit',
      items: [
        {type: 'docSidebar', sidebarId: 'docsSidebar', position: 'left', label: 'Docs'},
        {href: 'https://github.com/88khp/api-kit', label: 'GitHub', position: 'right'},
        {href: 'https://www.npmjs.com/package/@88khp/api-kit', label: 'npm', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} 88khp. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'tsx'],
    },
  },
};

module.exports = config;
