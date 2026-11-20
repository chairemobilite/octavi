import React, { useMemo } from 'react';
import { Source } from 'react-map-gl/maplibre';

const ZoneMapSource = ({ id, data, children }) => {
    const dataWithPromotedIds = useMemo(
        () => ({
            ...data,
            features: data.features.map((feature) => {
                const featureId = feature.properties?.id ?? feature.id;
                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        ...(featureId !== undefined && featureId !== null ? { id: featureId } : {})
                    }
                };
            })
        }),
        [data]
    );

    return (
        <Source id={id} type="geojson" data={dataWithPromotedIds} promoteId="id">
            {children}
        </Source>
    );
};

export default ZoneMapSource;
