/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeatureCollection, Geometry } from 'geojson';
import type { MapLayerMouseEvent } from 'maplibre-gl';

import MapLegend from 'octavi-legacy/lib/components/map/MapLegend';
import OctaviMap, { Popup } from 'octavi-legacy/lib/components/map/OctaviMap';
import ZoneMapSource from 'octavi-legacy/lib/components/map/ZoneMapSource';
import { ZoneFillLayer, ZoneHeatmapLayer, ZoneOutlineLayer } from 'octavi-legacy/lib/components/map/ZoneLayers';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

export type HeatmapStop = {
    value: number;
    color: string;
    label: string;
};

export type HeatmapFeatureProperties = {
    [key: string]: unknown;
    id?: string | number;
    shortname?: string;
    name?: string;
    data?: Record<string, unknown>;
};

export type HeatmapFeature = GeoJSON.Feature<Geometry, HeatmapFeatureProperties>;
export type HeatmapFeatureCollection = FeatureCollection<Geometry, HeatmapFeatureProperties>;

export type GeospatialHeatmapProps = {
    data?: HeatmapFeatureCollection;
    property?: string;
    propertyPath?: string[];
    stops?: HeatmapStop[];
    legendTitle?: string;
    baseColor?: string;
};

type MapViewState = {
    longitude: number;
    latitude: number;
    zoom: number;
};

type SelectedZone = {
    id: string | number | undefined;
    properties: HeatmapFeatureProperties;
    longitude: number;
    latitude: number;
};

const EMPTY_FEATURE_COLLECTION: HeatmapFeatureCollection = { type: 'FeatureCollection', features: [] };
const HEATMAP_LAYER_ID = 'origin-destination-heatmap';
const BASE_LAYER_ID = 'origin-destination-base';

/**
 * Component which displays a map with
 */
const GeospatialHeatmap: React.FunctionComponent<GeospatialHeatmapProps> = ({
    data = EMPTY_FEATURE_COLLECTION,
    property = 'value',
    propertyPath = [],
    stops = [],
    legendTitle,
    baseColor = '#d9d9d9'
}: GeospatialHeatmapProps) => {
    const { t } = useTranslation('octavi');
    const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);
    const hasHeatmap = stops.length >= 2;
    const center = Preferences.get('map.center') as [number, number];
    const viewStateRef = useRef<MapViewState>({
        longitude: center[0],
        latitude: center[1],
        zoom: Preferences.get('map.zoom') as number
    });

    const handleMapClick = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature) {
            setSelectedZone(null);
            return;
        }

        const properties = (feature.properties || {}) as HeatmapFeatureProperties;
        const id =
            properties.id ??
            (typeof feature.id === 'string' || typeof feature.id === 'number' ? feature.id : undefined);
        setSelectedZone((current) =>
            id !== undefined && String(id) === String(current?.id)
                ? null
                : {
                    id,
                    properties,
                    longitude: event.lngLat.lng,
                    latitude: event.lngLat.lat
                }
        );
    };

    React.useEffect(() => {
        if (!selectedZone || selectedZone.id === undefined) {
            return;
        }

        const updatedProperties = data.features.find((feature) => {
            const featureId = feature.properties?.id ?? feature.id;
            return featureId !== undefined && String(featureId) === String(selectedZone.id);
        })?.properties;

        if (updatedProperties) {
            setSelectedZone((current) => {
                if (
                    !current ||
                    String(current.id) !== String(selectedZone.id) ||
                    current.properties === updatedProperties
                ) {
                    return current;
                }
                return { ...current, properties: updatedProperties };
            });
        }
    }, [data]);

    const handleMouseMove = (event: MapLayerMouseEvent) => {
        event.target.getCanvas().style.cursor = event.features?.length ? 'pointer' : '';
    };

    const popupProperties = Object.entries(selectedZone?.properties || {}).filter(
        ([key, value]) => ['name', 'shortname', 'value'].includes(key) && value !== undefined && value !== null
    );

    return (
        <OctaviMap
            initialViewState={viewStateRef.current}
            style={{ width: '100%', height: '100%' }}
            interactiveLayerIds={hasHeatmap ? [HEATMAP_LAYER_ID, BASE_LAYER_ID] : [BASE_LAYER_ID]}
            onClick={handleMapClick}
            onMouseMove={handleMouseMove}
            onMove={(event: { viewState: MapViewState }) => {
                viewStateRef.current = event.viewState;
            }}
            dragRotate={false}
        >
            <ZoneMapSource id="origin-destination-zones" data={data}>
                <ZoneFillLayer
                    id={BASE_LAYER_ID}
                    sourceId="origin-destination-zones"
                    fillColor={baseColor}
                    fillOpacity={hasHeatmap ? 0.15 : 0.35}
                />
                {hasHeatmap && (
                    <ZoneHeatmapLayer
                        id={HEATMAP_LAYER_ID}
                        sourceId="origin-destination-zones"
                        property={property}
                        propertyPath={propertyPath}
                        stops={stops}
                        fillOpacity={0.75}
                    />
                )}
                <ZoneOutlineLayer id="origin-destination-outline" sourceId="origin-destination-zones" />
            </ZoneMapSource>
            {hasHeatmap && <MapLegend title={legendTitle} items={stops} />}
            {selectedZone && (
                <Popup
                    longitude={selectedZone.longitude}
                    latitude={selectedZone.latitude}
                    closeButton={true}
                    closeOnClick={false}
                    onClose={() => setSelectedZone(null)}
                    anchor="bottom"
                >
                    <div className="octavi-map-popup">
                        <strong>
                            {selectedZone.properties.name ||
                                selectedZone.properties.shortname ||
                                String(selectedZone.id)}
                        </strong>
                        {popupProperties.map(([key, value]) => (
                            <div key={key}>
                                <strong>{t(`octavi:maps:popup:${key}`)}: </strong>
                                {typeof value === 'string' || typeof value === 'number'
                                    ? String(value)
                                    : JSON.stringify(value)}
                            </div>
                        ))}
                    </div>
                </Popup>
            )}
        </OctaviMap>
    );
};

export default GeospatialHeatmap;
