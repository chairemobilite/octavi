import React from 'react';
import { Layer } from 'react-map-gl/maplibre';

export const ZoneFillLayer = ({
    id,
    sourceId,
    fillColor = 'rgba(255,255,255,0.2)',
    fillOpacity = 0.35,
    beforeId
}) => (
    <Layer
        id={id}
        source={sourceId}
        beforeId={beforeId}
        type="fill"
        paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }}
    />
);

export const ZoneOutlineLayer = ({
    id,
    sourceId,
    lineColor = '#333333',
    lineOpacity = 0.8,
    lineWidth = 1,
    beforeId
}) => (
    <Layer
        id={id}
        source={sourceId}
        beforeId={beforeId}
        type="line"
        paint={{
            'line-color': lineColor,
            'line-opacity': lineOpacity,
            'line-width': lineWidth
        }}
    />
);

export const ZoneSelectionLayer = ({
    id,
    sourceId,
    selectedIds = [],
    fillColor = '#468024',
    fillOpacity = 0.7,
    beforeId
}) => (
    <Layer
        id={id}
        source={sourceId}
        beforeId={beforeId}
        type="fill"
        filter={['in', ['to-string', ['get', 'id']], ['literal', selectedIds.map(String)]]}
        paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }}
    />
);

const getMapPropertyExpression = (property, propertyPath = []) => {
    const path = [...propertyPath, property];
    return path.slice(1).reduce((objectExpression, key) => ['get', key, objectExpression], ['get', path[0]]);
};

export const ZoneHeatmapLayer = ({
    id,
    sourceId,
    property,
    propertyPath,
    stops,
    fillOpacity = 0.7,
    beforeId
}) => {
    const orderedStops = [...stops].sort((a, b) => a.value - b.value);

    return (
        <Layer
            id={id}
            source={sourceId}
            beforeId={beforeId}
            type="fill"
            paint={{
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['to-number', getMapPropertyExpression(property, propertyPath), 0],
                    ...orderedStops.flatMap((stop) => [stop.value, stop.color])
                ],
                'fill-opacity': fillOpacity
            }}
        />
    );
};
