import TrError from 'chaire-lib-common/lib/utils/TrError';
import { EventEmitter } from 'events';

import zonesDbQueries from 'chaire-lib-backend/lib/models/db/zones.db.queries';
import * as Status from 'chaire-lib-common/lib/utils/Status';

/**
 * Add routes specific to the transit objects
 *
 * @export
 * @param {EventEmitter} socket The socket to register the routes to
 */
export default function (socket) {
    socket.on('zones.geojsonCollection', async (dataSourceIds, callback) => {
        try {
            const collection = await zonesDbQueries.collection({ dataSourceId: dataSourceIds.length > 0 ? dataSourceIds[0] : undefined });
            const features = collection.filter(({ geography, ...properties }) => geography !== null).map(({ geography, id, ...properties }) => ({
                type: 'Feature',
                geometry: geography,
                id,
                properties
            }));
            callback(Status.createOk({ geojson: { type: 'FeatureCollection', features } }));
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.export() : { error: 'Error retrieving data sources' }));
        }
    });
}
