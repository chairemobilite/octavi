import React from 'react';
import MapLibreMap from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import Preferences from 'chaire-lib-common/lib/config/Preferences';

/**
 * Generate map style with tile sources
 * FIXME Adapted from Transition MainMap, without the aerial options. We should use similar functionalities as in Transition to avoid duplicating this part and allow all the richness of the interaction from there.
 */
const DEFAULT_MAP_STYLE = {
    version: 8,
    sources: {
        osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
        }
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};

const OctaviMap = ({
    center = Preferences.get('map.center'),
    zoom = Preferences.get('map.zoom'),
    mapStyle = DEFAULT_MAP_STYLE,
    style,
    children,
    ...mapProps
}) => (
    <MapLibreMap
        initialViewState={{
            longitude: center[0],
            latitude: center[1],
            zoom
        }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%', ...style }}
        // Keep OSM and MapLibre credits expanded so map screenshots include them.
        attributionControl={{ compact: false }}
        dragRotate={false}
        {...mapProps}
    >
        {children}
    </MapLibreMap>
);

export { DEFAULT_MAP_STYLE, MapLibreMap as OctaviMapLibre, OctaviMap };
export { Popup } from 'react-map-gl/maplibre';
export default OctaviMap;
