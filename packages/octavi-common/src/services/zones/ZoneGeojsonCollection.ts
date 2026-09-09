/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Zone, ZoneAttributes } from 'chaire-lib-common/lib/services/zones/Zone';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericMapObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericMapObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

/**
 * A collection of zones as geojson.
 *
 * TODO Consider moving to chaire-lib
 */
export class ZoneGeojsonCollection
    extends GenericMapObjectCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, ZoneAttributes, Zone>
    implements Progressable {
    protected static displayName = 'ZoneGeojsonCollection';
    protected static socketPrefix = 'zones';
    protected static instanceClass = Zone;

    private _eventManager: EventManager | undefined;

    constructor(
        features: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, ZoneAttributes>[],
        attributes: { [key: string]: unknown },
        eventManager?: EventManager
    ) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${ZoneGeojsonCollection.displayName}${progressEventName}`, completeRatio);
    }

    newObject(feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, ZoneAttributes>, isNew = false): Zone {
        return new Zone(Object.assign({}, feature.properties, { geography: feature.geometry }), isNew);
    }

    saveCache(socket) {
        return CollectionCacheable.saveCache(this, socket);
    }

    loadCache(socket) {
        return CollectionCacheable.loadCache(this, socket);
    }

    loadFromServer(socket, dataSourceId: string) {
        return CollectionLoadable.loadGeojsonFromServer(
            this,
            socket,
            // FIXME Fix the `as never[]` type whent he loadGeojsonFromServer function is properly typed.
            dataSourceId !== undefined ? ([dataSourceId] as never[]) : []
        );
    }

    loadFromCollection(collection) {
        return CollectionLoadable.loadGeojsonFromCollection(this, collection);
    }

    // TODO: Consider always having the simplified version of the path in the collection and load the full path only when necessary. There may be side-effects to doing this and there may be additional properties required in the main collection. Needs some thought.
    toGeojsonSimplified(): GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
        const features = this.features.map(({ id, geometry, properties, type }) => ({
            type,
            id,
            geometry,
            properties: {
                shortname: properties.shortname,
                id: properties.id,
                data: properties.data
            }
        }));
        return {
            type: 'FeatureCollection',
            features
        };
    }
}

export default ZoneGeojsonCollection;
