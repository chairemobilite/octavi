/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import sharedSession from 'express-socket.io-session';
import { Server as SocketIOServer, Socket, ExtendedError } from 'socket.io';
import events from 'events';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import preferencesSocketRoutes from 'chaire-lib-backend/lib/api/preferences.socketRoutes';
import allSocketRoutes from './api/all.socketRoutes';

/**
 * The express-socket.io-session package adds the `session` property to the
 * handshake at runtime, but it is not available in the types, so we add it
 * here. See https://github.com/oskosk/express-socket.io-session#usage
 */
type SocketHandshakeWithSession = Socket['handshake'] & {
    session?: {
        passport?: {
            user?: number;
        };
    };
};

const setupSocketServerApp = async function (server, sessionMiddleware) {
    // Add socket routes to an event emitter for the server process to use
    serviceLocator.addService('socketEventManager', new events.EventEmitter());
    allSocketRoutes(serviceLocator.socketEventManager);

    const io = new SocketIOServer(server, {
        pingTimeout: 60000,
        transports: ['websocket'],
        maxHttpBufferSize: 1e8 // 100MB
    });

    io.use(
        sharedSession(sessionMiddleware, {
            autoSave: true
        })
    );

    io.use((socket: Socket, next: (error?: ExtendedError) => void) => {
        const handshake = socket.handshake as SocketHandshakeWithSession;
        if (handshake.session?.passport?.user && handshake.session.passport.user > 0) {
            return next();
        }
        socket.disconnect(true);
    });

    io.on('error', (error: unknown) => {
        console.log('error!', error);
    });

    io.on('connection', (socket: Socket) => {
        socket.on('disconnect', () => {
            io.emit('user disconnected');
        });

        if (
            process.env.NODE_ENV === 'development' ||
            process.env.NODE_ENV === 'dev' ||
            process.env.NODE_ENV === 'test'
        ) {
            socket.onAny((event) => {
                console.log('socket received event', event);
            });
        }

        const userId = (socket.handshake as SocketHandshakeWithSession).session?.passport?.user;
        if (userId === undefined) {
            console.error('there was a connection, but no user ID');
            return;
        }

        // FIXME In Transition, here we register the socket with the user for
        // notifications to survive a page reload. Do we need this in Octavi? If
        // so, the `ClientEventManager` object should maybe go in chaire-lib to
        // avoir a dependency to the whole transition-backend, or else we just
        // copy that file and adapt to Octavi's needs.
        preferencesSocketRoutes(socket, userId);
        allSocketRoutes(socket, userId);
    });

    return io;
};

export default setupSocketServerApp;
