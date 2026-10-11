const { withAndroidManifest } = require('expo/config-plugins');
module.exports = config => withAndroidManifest(config, result => {
  const manifest = result.modResults.manifest;
  const permissions = [
    { name: 'android.permission.BLUETOOTH', max: '30' },
    { name: 'android.permission.BLUETOOTH_ADMIN', max: '30' },
    { name: 'android.permission.ACCESS_FINE_LOCATION', max: '30' },
    { name: 'android.permission.BLUETOOTH_SCAN', flags: 'neverForLocation' },
    { name: 'android.permission.BLUETOOTH_CONNECT' },
    { name: 'android.permission.INTERNET' },
    { name: 'android.permission.ACCESS_NETWORK_STATE' },
    { name: 'android.permission.ACCESS_WIFI_STATE' },
    { name: 'android.permission.CHANGE_NETWORK_STATE' },
  ];
  const names = new Set(permissions.map(permission => permission.name));
  manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(permission => !names.has(permission.$['android:name']));
  for (const permission of permissions) manifest['uses-permission'].push({ $: { 'android:name': permission.name, ...(permission.max ? { 'android:maxSdkVersion': permission.max } : {}), ...(permission.flags ? { 'android:usesPermissionFlags': permission.flags } : {}) } });
  return result;
});
