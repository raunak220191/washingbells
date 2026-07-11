// Dynamic Expo config — extends app.json (upgrade_last TASK 3.1).
//
// react-native-maps needs a Google Maps ANDROID key in the manifest. The key
// is injected from the environment at build time so it never lives in git:
//   local dev builds:  export GOOGLE_MAPS_ANDROID_API_KEY=... before expo run
//   EAS builds:        eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY ...
// Without the key the app still builds; the map renders blank on Android
// (Maps SDK for Android must also be enabled on the key in Google Cloud).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android?.config || {}),
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || "",
      },
    },
  },
});
