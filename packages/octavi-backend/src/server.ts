/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { join } from 'path';
import { createServer as httpCreateServer } from 'http';
import { createServer as httpsCreateServer } from 'https';
import { setupServer } from './serverApp';
import setupSocketServerApp from './socketServerApp';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import express from 'express';
import { registerTranslationDir, addTranslationNamespace } from 'chaire-lib-backend/lib/config/i18next';
import config from 'chaire-lib-backend/lib/config/server.config';

/* Create the http server. Optionally handle SSL configuration */
const createHttpServer = function (port: number, useSSL: boolean) {
    const app = express();

    const { session } = setupServer(app);

    if (!useSSL) {
        // Create http server
        try {
            const server = httpCreateServer(app);
            server.listen(port);
            setupSocketServerApp(server, session);
        } catch (err) {
            console.error('Error starting the http server: ', err);
            throw err;
        }
    } else {
        // Create the https server
        const pk = process.env.SSL_PRIVATE_KEY;
        const crt = process.env.SSL_CERT;
        if (!pk || !crt) {
            console.error(
                'Configuration error: you need to specify the SSL_PRIVATE_KEY and SSL_CERT keys in the .env file'
            );
            throw 'Configuration error: you need to specify the SSL_PRIVATE_KEY and SSL_CERT keys in the .env file';
        }
        try {
            const privateKey = fs.readFileSync(pk, 'utf8');
            const certificate = fs.readFileSync(crt, 'utf8');
            const credentials = { key: privateKey, cert: certificate };
            const httpsServer = httpsCreateServer(credentials, app);
            httpsServer.listen(port);
            setupSocketServerApp(httpsServer, session);
        } catch (err) {
            console.error('Error starting the https server: ', err);
            throw err;
        }
    }
};

/* Main setup function for the server. Will init all parts as necessary */
const setupAll = async function () {
    const argv = yargs(hideBin(process.argv)).parseSync();

    const useSSL = typeof argv.ssl === 'boolean' ? argv.ssl : false;
    const port = argv.port ? parseInt(argv.port as string) : useSSL ? 8443 : 8080;
    console.log(`starting server for project ${config.projectShortname} with port ${port}`);

    process.on('uncaughtException', (err) => {
        // handle the error safely
        console.error('Just caught an uncaught exception!', err);
    });

    createHttpServer(port, useSSL);

    // Register server translations, first Octavi's, then transition's
    registerTranslationDir(join(__dirname, '../../../locales/'));
    registerTranslationDir(join(__dirname, '../../../transition/locales/'));
    addTranslationNamespace('octavi');

    console.log('Server ready...');
};
// Register shutdown handlers
process.on('SIGINT', () => {
    console.log('Received SIGINT. Performing cleanup...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Performing cleanup...');
    process.exit(0);
});
setupAll();
