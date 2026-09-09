/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import taxiSocketRoutes from 'octavi-legacy/lib/api/taxis.socketRoutes';
import zonesSocketRoutes from 'octavi-legacy/lib/api/zones.socketRoutes';
import dataSourcesSocketRoutes from 'chaire-lib-backend/lib/api/dataSources.socketRoutes';

export default function (socket: EventEmitter, _userId?: number) {
    taxiSocketRoutes(socket);
    dataSourcesSocketRoutes(socket);
    zonesSocketRoutes(socket);

    // TODO Migrate each route from legacy as necessary
}
