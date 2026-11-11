import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import MapLibreMap, { Layer, Source } from 'react-map-gl/maplibre';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';

const EMPTY_FEATURE_COLLECTION = {
    type: 'FeatureCollection',
    features: []
};

// FIXME Allow to override these colors in the preferences and put them somewhere else
const DEFAULT_COLORS = {
    origin: {
        main: '#468024'
    },
    destination: {
        main: '#D4230E'
    }
};

const parseRgbColor = (color) => {
    if (typeof color !== 'string') {
        return null;
    }

    const hexMatch = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (hexMatch) {
        const hex = hexMatch[1].length === 3
            ? hexMatch[1].split('').map((value) => value + value).join('')
            : hexMatch[1];
        return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
    }

    const rgbMatch = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    return rgbMatch ? rgbMatch.slice(1, 4).map(Number) : null;
};

// Get a contrasting color from the background color
// FIXME should this be moved somewhere else for others to use?
const getContrastingTextColor = (backgroundColor) => {
    const rgb = parseRgbColor(backgroundColor);
    if (!rgb) {
        return '#000000';
    }

    const luminance = rgb
        .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        })
        .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);

    return luminance > 0.179 ? '#000000' : '#ffffff';
};

/**
 * Generate map style with tile sources
 * FIXME Adapted from Transition MainMap, without the aerial options. We should use similar functionalities as in Transition to avoid duplicating this part and allow all the richness of the interaction from there.
 */
const getMapStyle = () => {
    const sources = {
        osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
        }
    };

    const layers = [];
    layers.push({
        id: 'osm',
        type: 'raster',
        source: 'osm'
    });

    return {
        version: 8, // must be 8, see https://maplibre.org/maplibre-style-spec/root/#version
        sources,
        layers
    };
};

const ZonesInteractiveMap = ({
    zoneDataSource = EMPTY_FEATURE_COLLECTION,
    style = {},
    selected = {},
    colors = DEFAULT_COLORS,
    zoneType: initialZoneType = 'origin',
    ableUniqueSelector = false
}) => {
    const { t } = useTranslation();
    const [selection, setSelection] = useState({
        origin: [...(selected.origin || [])],
        destination: [...(selected.destination || [])]
    });
    const [zoneType, setZoneType] = useState(initialZoneType || 'origin');
    const [clearConfirmationIsOpen, setClearConfirmationIsOpen] = useState(false);
    const zoneDataSourceWithPropertyIds = useMemo(
        () => ({
            ...zoneDataSource,
            features: zoneDataSource.features.map((feature) => {
                const id = feature.properties?.id ?? feature.id;
                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        ...(id !== undefined && id !== null ? { id } : {})
                    }
                };
            })
        }),
        [zoneDataSource]
    );
    const viewStateRef = useRef({
        longitude: Preferences.get('map.center')[0],
        latitude: Preferences.get('map.center')[1],
        zoom: Preferences.get('map.zoom')
    });

    const mapStyle = useMemo(getMapStyle, []);

    useEffect(() => {
        setSelection({
            origin: [...(selected.origin || [])],
            destination: [...(selected.destination || [])]
        });
    }, [selected.origin, selected.destination]);

    useEffect(() => {
        if (initialZoneType) {
            setZoneType(initialZoneType);
        }
    }, [initialZoneType]);

    useEffect(() => {
        serviceLocator.eventManager.emit(`octaviZones.selection`, selection);
    }, []);

    useEffect(
        () => () => {
            Preferences.update(serviceLocator.socketEventManager, serviceLocator.eventManager, {
                'map.center': [viewStateRef.current.longitude, viewStateRef.current.latitude],
                'map.zoom': viewStateRef.current.zoom
            });
        },
        []
    );

    const updateSelection = (newSelection) => {
        setSelection(newSelection);
        serviceLocator.eventManager.emit(`octaviZones.selection`, newSelection);
    };

    const onMapClick = (event) => {
        const feature = event.features && event.features[0];
        const featureId = feature && (feature.properties?.id ?? feature.id);
        if (featureId === undefined || featureId === null) {
            return;
        }

        const selectedIds = selection[zoneType] || [];
        const nextSelectedIds = selectedIds.includes(featureId)
            ? selectedIds.filter((id) => id !== featureId)
            : [...selectedIds, featureId];
        updateSelection({
            ...selection,
            [zoneType]: nextSelectedIds
        });
    };

    const openClearConfirmation = (event) => {
        event.preventDefault();
        setClearConfirmationIsOpen(true);
    };

    const closeClearConfirmation = () => {
        setClearConfirmationIsOpen(false);
    };

    const confirmClearSelection = () => {
        updateSelection({
            ...selection,
            [zoneType]: []
        });
    };

    const selectZoneType = (event, type) => {
        event.preventDefault();
        const nextSelection = { ...selection };
        if (ableUniqueSelector) {
            const otherType = type === 'origin' ? 'destination' : 'origin';
            nextSelection[otherType] = [];
            updateSelection(nextSelection);
        }
        setZoneType(type);
    };

    const getZoneColor = (type) => colors[type]?.main || DEFAULT_COLORS[type].main;
    const getZoneButtonStyle = (type) => {
        const isActive = zoneType === type;
        const backgroundColor = isActive ? getZoneColor(type) : '#ffffff';
        const textColor = isActive ? getContrastingTextColor(backgroundColor) : '#000000';

        return {
            backgroundColor,
            color: textColor,
            border: `2px solid ${isActive ? textColor : '#666666'}`
        };
    };

    const selectedFilter = (ids) => ['in', ['get', 'id'], ['literal', ids]];
    const mapContainerStyle = {
        ...style,
        width: '100%',
        height: '100%',
        position: style.position || 'relative',
        ...(style.position === 'absolute' ? { top: 0, left: 0 } : {})
    };

    return (
        <div style={mapContainerStyle}>
            <div
                className="mapButton_container"
                style={{ position: 'absolute', top: 8, left: 8, zIndex: (style.zIndex || 0) + 1 }}
            >
                <div className="buttonZonesSelection_container" style={{ display: 'flex', gap: 4 }}>
                    <button className="_input" type="button" onClick={openClearConfirmation}>
                        {t('octavi:filters:spatial:initializeSelection')}
                    </button>
                </div>
                <div className="buttonOriginDestination_container" style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button
                        id="origin"
                        className="buttonOriginDestination zone-selection-button"
                        style={getZoneButtonStyle('origin')}
                        onClick={(event) => selectZoneType(event, 'origin')}
                        disabled={zoneType === 'origin'}
                    >
                        {t('octavi:filters:spatial:origin')}
                    </button>
                    <button
                        id="destination"
                        className="buttonOriginDestination zone-selection-button"
                        style={getZoneButtonStyle('destination')}
                        onClick={(event) => selectZoneType(event, 'destination')}
                        disabled={zoneType === 'destination'}
                    >
                        {t('octavi:filters:spatial:destination')}
                    </button>
                </div>
            </div>

            <MapLibreMap
                initialViewState={viewStateRef.current}
                style={{ width: '100%', height: '100%' }}
                mapStyle={mapStyle}
                interactiveLayerIds={['zones-fill']}
                onClick={onMapClick}
                onMove={(event) => {
                    viewStateRef.current = event.viewState;
                }}
                dragRotate={false}
            >
                <Source id="zones" type="geojson" data={zoneDataSourceWithPropertyIds} promoteId="id">
                    <Layer
                        id="zones-fill"
                        type="fill"
                        paint={{ 'fill-color': 'rgba(255,255,255,0.2)' }}
                    />
                    <Layer
                        id="origin-selection"
                        type="fill"
                        filter={selectedFilter(selection.origin)}
                        paint={{ 'fill-color': getZoneColor('origin'), 'fill-opacity': 0.7 }}
                    />
                    <Layer
                        id="destination-selection"
                        type="fill"
                        filter={selectedFilter(selection.destination)}
                        paint={{ 'fill-color': getZoneColor('destination'), 'fill-opacity': 0.7 }}
                    />
                    <Layer
                        id="zones-outline"
                        type="line"
                        paint={{ 'line-color': '#000000', 'line-opacity': 0.75 }}
                    />
                </Source>
            </MapLibreMap>
            <ConfirmModal
                isOpen={clearConfirmationIsOpen}
                title={t('octavi:filters:spatial:initializeSelection')}
                text={t('octavi:filters:spatial:initializeSelectionConfirmation', {
                    zoneType: t(`octavi:filters:spatial:${zoneType}SelectionType`)
                })}
                closeModal={closeClearConfirmation}
                confirmAction={confirmClearSelection}
                confirmButtonLabel={t('octavi:filters:spatial:initializeSelection')}
            />
        </div>
    );
};

ZonesInteractiveMap.propTypes = {
    zoneDataSource: PropTypes.shape({
        type: PropTypes.oneOf(['FeatureCollection']).isRequired,
        features: PropTypes.array.isRequired
    }),
    style: PropTypes.object,
    colors: PropTypes.shape({
        origin: PropTypes.shape({ main: PropTypes.string }),
        destination: PropTypes.shape({ main: PropTypes.string })
    }),
    selected: PropTypes.shape({
        origin: PropTypes.array,
        destination: PropTypes.array
    }),
    zoneType: PropTypes.oneOf(['origin', 'destination']),
    ableUniqueSelector: PropTypes.bool
};

export default ZonesInteractiveMap;
