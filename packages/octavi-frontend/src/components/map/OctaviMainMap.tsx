import React, { PropsWithChildren } from 'react';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import OctaviMap from 'octavi-legacy/lib/components/map/OctaviMap';

export interface MainMapProps extends PropsWithChildren {
    center?: [number, number] | null;
    zoom?: number | null;
    activeSection?: string;
    heatmap?: {
        property: string;
        propertyPath?: string[];
        title?: string;
        stops: Array<{ value: number; color: string; label?: string }>;
    };
    zoneColor?: string;
}

const OctaviMainMap = ({ center, zoom, children }: MainMapProps) => {
    const mapCenter = center || Preferences.get('map.center');
    const mapZoom = zoom || Preferences.get('map.zoom');

    const handleMapLoad = () => {
        serviceLocator.eventManager.emit('map.loaded');
    };

    return (
        <section id="tr__main-map">
            <div id="tr__main-map-context-menu" className="tr__main-map-context-menu"></div>
            <div style={{ position: 'absolute', inset: 0 }}>
                <OctaviMap center={mapCenter} zoom={mapZoom} onLoad={handleMapLoad}>
                    {children}
                </OctaviMap>
            </div>
        </section>
    );
};

export default OctaviMainMap;
