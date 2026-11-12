import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { hexToRgbArray } from 'chaire-lib-common/lib/utils/ColorUtils';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import OctaviMap from '../../map/OctaviMap';
import ZoneMapSource from '../../map/ZoneMapSource';
import { ZoneFillLayer, ZoneOutlineLayer, ZoneSelectionLayer } from '../../map/ZoneLayers';

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

// Get a contrasting color from the background color
// FIXME should this be moved somewhere else for others to use?
const getContrastingTextColor = (backgroundColor) => {
    const rgb = hexToRgbArray(backgroundColor);
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
    const viewStateRef = useRef({
        longitude: Preferences.get('map.center')[0],
        latitude: Preferences.get('map.center')[1],
        zoom: Preferences.get('map.zoom')
    });

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

            <OctaviMap
                initialViewState={viewStateRef.current}
                style={{ width: '100%', height: '100%' }}
                interactiveLayerIds={['zones-fill']}
                onClick={onMapClick}
                onMove={(event) => {
                    viewStateRef.current = event.viewState;
                }}
                dragRotate={false}
            >
                <ZoneMapSource id="zones" data={zoneDataSource}>
                    <ZoneFillLayer id="zones-fill" sourceId="zones" fillOpacity={0.2} />
                    <ZoneSelectionLayer
                        id="origin-selection"
                        sourceId="zones"
                        selectedIds={selection.origin}
                        fillColor={getZoneColor('origin')}
                    />
                    <ZoneSelectionLayer
                        id="destination-selection"
                        sourceId="zones"
                        selectedIds={selection.destination}
                        fillColor={getZoneColor('destination')}
                    />
                    <ZoneOutlineLayer id="zones-outline" sourceId="zones" lineColor="#000000" lineOpacity={0.75} />
                </ZoneMapSource>
            </OctaviMap>
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
