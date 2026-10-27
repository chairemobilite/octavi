module.exports = {
    projectShortname: 'demo_octavi',
    projectDirectory: `${__dirname}/runtime`,
    auth: {
        localLogin: {
            // Whether users can create an account. If false, the register page will not be available. Defaults to true
            allowRegistration: true,
            // This will send an email to confirm the user's email address. Email send needs to be configured. By default, users can register and directly login.
            // confirmEmail: true,
            // Whether to allow users to reset their password. If false, the forgot password page will not be available. By default the page is not present
            // forgotPasswordPage: false,
            // Whether to allow users to login with a username. If false, the username field will not be displayed on the login page. Defaults to true
            // registerWithEmailOnly?: boolean;
            // What type of confirmation is required for the email. Can be 'confirmByAdmin' | 'confirmByUser'. Defaults to 'confirmByUser'
            // confirmEmailStrategy: 'confirmByUser';
        }
        // Octavi does not support any other login method than localLogin
    },

    mapDefaultCenter: {
        lat: 45.503205,
        lon: -73.569417
    },
    languages: ['fr', 'en'],

    locales: {
      fr: 'fr-CA',
      en: 'en-CA'
    },

    languageNames: {
      fr: "Français",
      en: "English"
    },

    defaultLocale: "fr",
  btm: {
    host: "https://taximtl.ville.montreal.qc.ca",
  },

  defaultPreferences: {
    defaultTaxiDataSourceShortname: "btm_api",
    defaultZoneDataSourceShortname: "btm_zone",
    spatialAggregations: [
      {
        level: 1,
        aggregator: "SM",
        props: [
          {
            name: "SM_name",
            parseToInt: false,
            type: "value",
          },
          {
            name: "SM",
            parseToInt: true,
            type: "value",
          },
          {
            name: "id",
            parseToInt: false,
            type: "list",
          },
        ],
      },
    ],
  },
};
