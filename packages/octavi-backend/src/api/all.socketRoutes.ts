/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import taxiSocketRoutes from './taxis.socketRoutes';

export default function (socket: EventEmitter, _userId?: number) {
    taxiSocketRoutes(socket);
}
