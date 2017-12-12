import chokidar from 'chokidar';
import { resolve as pathResolve } from 'path';
import appRootDir from 'app-root-dir';
import getPorts from 'get-ports';
import { log } from '../utils';
import config, { setConfig } from '../../config';

const preferredPort = config('port');
const preferredDevPort = config('clientDevServerPort');

getPorts([preferredPort, preferredDevPort], (err, [port, clientDevServerPort]) => {
  if (err) {
    log({
      title: 'dev',
      level: 'error',
      message: 'failed to find ports',
    });
    return;
  }
  // has to be set before spawning the `hotNodeServer`
  process.env.PORT = port;
  process.env.CLIENT_DEV_PORT = clientDevServerPort;

  setConfig('port', port);
  setConfig('clientDevServerPort', clientDevServerPort);

  let HotDevelopment = require('./hotDevelopment').default;
  let devServer = new HotDevelopment();

  // Any changes to our webpack bundleConfigs should restart the development devServer.
  const watcher = chokidar.watch([
    pathResolve(appRootDir.get(), 'internal'),
    pathResolve(appRootDir.get(), 'config'),
  ]);

  watcher.on('ready', () => {
    watcher.on('change', () => {
      log({
        title: 'webpack',
        level: 'warn',
        message: 'Project build configuration has changed. Restarting the development devServer...',
      });
      devServer.dispose().then(() => {
        // Make sure our new webpack bundleConfigs aren't in the module cache.
        Object.keys(require.cache).forEach((modulePath) => {
          if (modulePath.indexOf('config') !== -1) {
            delete require.cache[modulePath];
          } else if (modulePath.indexOf('internal') !== -1) {
            delete require.cache[modulePath];
          }
        });

        // Re-require the development devServer so that all new configs are used.
        HotDevelopment = require('./hotDevelopment').default;

        // Create a new development devServer.
        devServer = new HotDevelopment();
      });
    });
  });

  // If we receive a kill cmd then we will first try to dispose our listeners.
  process.on('SIGTERM', () => devServer && devServer.dispose().then(() => process.exit(0)));
});
