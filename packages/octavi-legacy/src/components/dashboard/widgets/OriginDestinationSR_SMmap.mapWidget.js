import React          from 'react';
import moment         from 'moment-timezone';
import { centroid }       from '@turf/turf';
import { camelCase, min, max, ceil } from "lodash";

//import InteractiveMap, { Source, Layer, Popup } from "react-map-gl/maplibre";

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { _isBlank }     from 'chaire-lib-common/lib/utils/LodashExtensions';
import Preferences      from 'chaire-lib-common/lib/config/Preferences';
import { LoadingPage } from "chaire-lib-frontend/lib/components/pages";
import serviceLocator   from 'chaire-lib-common/lib/utils/ServiceLocator';
import octaviParameters from '../../../services/ui/OctaviParameters';
import { getFilterIdx, buildWidgetFilter, getDatesForPeriodAggregation, exportTocsv }    from '../../../services/ui/utils'


import { loadLocalStorageFromFilter, saveLocalStorageDataFromFilter, getLocalStorageKey} from '../../../services/ui/localStorageManager'

// Converts seconds to minutes
// TODO Allow to change that divider and update unit string (#2079). There's one also in OctaviWidgetManagerSelector
const defaultDurationDivider = 60

export default class OriginDestinationSRSMMapWidget extends React.Component {

    constructor(props) {

        super(props);

        this.mapRef = React.createRef()

        this.state = {
            viewport: {
                longitude: Preferences.get('map.center')[0],
                latitude : Preferences.get('map.center')[1],
                zoom     : Preferences.get('map.zoom'),
            },
            filters: octaviParameters.filters,
            hoverId: "",
            showPopup: true,
            eventFeatures: {},
            values: {},
            mapDataHasLoaded: false,
            mapMaxValue: null,
            mapMinValue: null,
            scale:[],
            mapOptions: octaviParameters.mapOptions,
            // New scale can be easely made with https://colorbrewer2.org/
            colorMap: [
                '#edf8fb',
                '#b2e2e2',
                '#66c2a4',
                '#2ca25f',
                '#006d2c'
            ]
        };

        this.mapStyleToGeographicalOption = {
            "SRMap": "bySR",
            "SMMap": "bySM"
        }

        this.mapStyleToZoneData= {
            "SRMap": "SR",
            "SMMap": "SM"
        }

        this.mapStyleToLocationOption= {
            "originMap": "origin",
            "destinationMap": "destination"
        }

        const aggregations =  serviceLocator.collectionManager.get('aggregatedZones')

        this.state = {
            ...this.state,
            aggregations
        }

        this.updateMapOptions         = this.updateMapOptions.bind(this);
        this.updateFilter             = this.updateFilter.bind(this);
        this.getWidgetOptions         = this.getWidgetOptions.bind(this);
        this.reloadAggregation        = this.reloadAggregation.bind(this);
        this.setScale                 = this.setScale.bind(this);
        this.setIntervalScale         = this.setIntervalScale.bind(this);
        this.setDistributionScale     = this.setDistributionScale.bind(this);
        this.setCustomScale           = this.setCustomScale.bind(this);
        this.updateValueFilter        = this.updateValueFilter.bind(this);
        this.updateTimeRange          = this.updateTimeRange.bind(this);
        this.onViewportChange         = this.onViewportChange.bind(this);
        this.addValueProp             = this.addValueProp.bind(this);
        this.onClick                  = this.onClick.bind(this);
        this.onHover                  = this.onHover.bind(this);
        this.getValueName             = this.getValueName.bind(this);
        this.getFileName              = this.getFileName.bind(this);
        this.addOptionsTitle          = this.addOptionsTitle.bind(this);
        this.addOptionFileName        = this.addOptionFileName.bind(this);
        this.onDownloadClick          = this.onDownloadClick.bind(this);
        this.renderLayers             = this.renderLayers.bind(this);
        this.renderPopUp              = this.renderPopUp.bind(this);
    }

    componentDidMount() {
        //connect to filter modification
        serviceLocator.eventManager.on('taxi.filter.init', this.updateFilter);
        serviceLocator.eventManager.on('taxi.filter.data.update', this.updateFilter);
        serviceLocator.eventManager.on('taxi.filter.submit', this.updateTimeRange);
        serviceLocator.eventManager.on('taxi.filter.selectedMapOptions.update', this.updateMapOptions);
        serviceLocator.eventManager.on('taxi.filter.selectedScale.update', this.setScale);
        serviceLocator.eventManager.on("taxi.filter.spatial.enable", this.reloadAggregation);
        this.updateTimeRange();
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('taxi.filter.init', this.updateFilter);
        serviceLocator.eventManager.off('taxi.filter.data.update', this.updateFilter);
        serviceLocator.eventManager.off('taxi.filter.submit', this.updateTimeRange);
        serviceLocator.eventManager.off('taxi.filter.selectedMapOptions.update', this.updateMapOptions);
        serviceLocator.eventManager.off('taxi.filter.selectedScale.update', this.setScale);
        serviceLocator.eventManager.off("taxi.filter.spatial.enable", this.reloadAggregation);
    }

    onViewportChange(viewport) {
        this.setState({ viewport })
    }

    updateMapOptions(updatedOptions) {
        const newOptions = updatedOptions ? updatedOptions : octaviParameters.mapOptions;
        this.setState({
            mapOptions: newOptions
        }, function() {this.updateTimeRange()}.bind(this));
    }

    updateFilter () {
        this.setState({
            filters: octaviParameters.filters
          });
      }

    getWidgetOptions() {
        return {
            geographicalOption: this.mapStyleToGeographicalOption[this.state.mapOptions.selectedMapStyle],
            onLocationOption: this.mapStyleToLocationOption[this.state.mapOptions.selectedMapWidget],
            object: this.state.mapOptions.selectedMapObject,
            temporalOption: this.state.mapOptions.temporalOption,
            objectOption: this.state.mapOptions.objectOption
        }
    }

    reloadAggregation() {
        const aggregations =  serviceLocator.collectionManager.get('aggregatedZones')
        this.setState({
            aggregations
        }, function() {this.updateTimeRange()}.bind(this));
    }

    setScale(updatedScale) {
        const defaultScale = "intervalBased"
        const selectedScale = updatedScale && updatedScale.type ? updatedScale.type : octaviParameters.get('selectedScale', defaultScale)
        if (selectedScale === "intervalBased") {
            this.setIntervalScale()
        } else if (selectedScale === "distributionBased") {
            this.setDistributionScale()
        } else if (selectedScale === "custom") {
            const splits = updatedScale && updatedScale.splits ? updatedScale.splits : Preferences.get('octavi.scaleSplits', [this.state.mapMinValue, this.state.mapMinValue, this.state.mapMinValue, this.state.mapMinValue, this.state.mapMinValue, this.state.mapMaxValue])
            this.setCustomScale(splits)
        } else {
            console.error(`Unsuported scale type ${selectedScale}`)
        }
    }

    setIntervalScale() {
        const intervalScale = this.state.colorMap.map(function(color, idx) {
            return (this.state.mapMinValue + (this.state.mapMaxValue - this.state.mapMinValue) * idx / this.state.colorMap.length)
        }.bind(this))
        intervalScale.push(this.state.mapMaxValue)
        this.setState({
            scale: intervalScale
        })
        octaviParameters['mapScale'] = intervalScale
    }

    setDistributionScale() {
        const values = this.state.zone_data.features ? this.state.zone_data.features.map(feature => feature.properties.value): [];
        values.sort((a, b) => a - b);
        const distributionScale = this.state.colorMap.map(function(color, idx) {
            return (values[ceil(values.length * idx / this.state.colorMap.length)])
        }.bind(this))
        distributionScale.push(this.state.mapMaxValue)
        this.setState({
            scale: distributionScale
        });
        octaviParameters['mapScale'] = distributionScale;
    }

    setCustomScale(splits) {
        //we assum that the provided scale is valide
        this.setState({
            scale: [min([splits[0], this.state.mapMinValue]), splits[1], splits[2], splits[3], splits[4], max([splits[5], this.state.mapMaxValue])]
        })
        octaviParameters['mapScale'] = splits;
    }

    updateValueFilter() {
        const filterIdx = getFilterIdx(this.state.filters, 'FilterOne') //since we do not support comarison in maps active filter is always filter one
        const widgetOptions = this.getWidgetOptions();
        const filterKey     = getLocalStorageKey(this.state.filters, 'FilterOne', widgetOptions)

        const dataType              = "totalCountGraph"
        const Action                = widgetOptions.object && !_isBlank(widgetOptions.object) ? widgetOptions.object.charAt(0).toUpperCase() + widgetOptions.object.slice(1) + dataType.charAt(0).toUpperCase() + dataType.slice(1) : "";
        //if map options are not set
        if (_isBlank(widgetOptions.object)) {
            // error status
            this.addValueProp(null);
            return;
        }

        // Load data from locale storage
        serviceLocator.eventManager.emit('progress', {name:`OctaviLoading${Action}`, progress: 0})
        const result   = loadLocalStorageFromFilter(filterKey, widgetOptions.object, dataType)

        if (result) { // data already existing in locale storage
            serviceLocator.eventManager.emit('progress', {name:`OctaviLoading${Action}`, progress: 1})
            this.addValueProp(result)
        }
        else { // data doesn't exist in locale storage, need to import and compute data
            // if temporal option is selected, we modify start date for the begining / end of the period
            const dates = getDatesForPeriodAggregation(
                this.state.filters[filterIdx]['calendarStartAt'],
                this.state.filters[filterIdx]['calendarEndAt'],
                widgetOptions.temporalOption
              )

            const startAt = dates['periodStart'].tz('utc').unix();
            const endAt = dates['periodEnd'].tz('utc').unix();

            serviceLocator.socketEventManager.emit(`taxi.totalCount.byZone.timeRange`, {
                object             : widgetOptions.object,
                customFilterString : widgetOptions.object === "activities" || widgetOptions.object === 'distance' || widgetOptions.object === 'duration' ? " AND status = 'occupied' ": null,
                dataSourceIds      : octaviParameters.dataSourceIds,
                startAt            : startAt,
                endAt              : endAt,
                filters            : buildWidgetFilter(this.state.filters, 'FilterOne', widgetOptions.object, this.getWidgetOptions()),
                type               : widgetOptions.object === "distance" || widgetOptions.object === "duration" ? "continuous": "discrete",
                widgetSpecs: {
                    object              : widgetOptions.object,
                    type                : widgetOptions.object === "distance" || widgetOptions.object === "duration" ? "continuous": "discrete",
                    divider             : widgetOptions.object === "distance" || widgetOptions.object === "duration" ? widgetOptions.object === "distance" ? 1000 : defaultDurationDivider :null //divider is here to pass from meter to km and from second to minutes
                  }
            }, (responseStatus) => {
                if (Status.isStatusOk(responseStatus)) {
                    const response = Status.unwrap(responseStatus);
                    const result = response.counts;
                    saveLocalStorageDataFromFilter(filterKey, widgetOptions.object, result, dataType)
                    this.addValueProp(result);
                } else {
                    // error status
                    this.addValueProp(null);
                }
                serviceLocator.eventManager.emit('progress', {name:`OctaviLoading${Action}`, progress: 1})
            })
        }

    }

    updateTimeRange() {
        const newFilters = octaviParameters.filters;

        const idxFilterOne = getFilterIdx(newFilters, 'FilterOne')

        //we only updqte filters if dates are not null
        if (newFilters[idxFilterOne]['calendarStartAt'] && newFilters[idxFilterOne]['calendarEndAt']) {
            this.setState({
                mapMinValue     : null,
                mapMaxValue     : null,
                mapDataHasLoaded: false,
                zone_data       : {},
                filters         : newFilters
            }, function() {this.updateValueFilter()}.bind(this));
        }
    }

    addValueProp (result) {
        if (result) {
            const values = Object.keys(result).map((key) => result[key])
            const minValue = min(values)
            const maxValue = max(values)

            const featuresWithValue = this.props.zone_data.features.map(function(item){
                const newProps = {...item.properties}
                newProps.value = result[item.properties[this.mapStyleToZoneData[this.state.mapOptions.selectedMapStyle]]] ? result[item.properties[this.mapStyleToZoneData[this.state.mapOptions.selectedMapStyle]]] : 0

                return {
                    ...item,
                    properties : newProps
                }
            }.bind(this));
            let zone_export;
            if (this.state.mapOptions.selectedMapStyle === "SRMap") {
                zone_export = [[this.props.t('octavi:maps:popup:SMName'), this.props.t('octavi:maps:popup:SRName'), this.props.t('octavi:Value')]]
                zone_export = zone_export.concat(featuresWithValue.map(feature => [
                    feature.properties.SM_name ? feature.properties.SM_name: "",
                    feature.properties.SM_name ? feature.properties.SR: "",
                    feature.properties.SM_name ? feature.properties.value: "",
                ]))
            } else if (this.state.mapOptions.selectedMapStyle === "SMMap") {
                zone_export = [[this.props.t('octavi:maps:popup:SMName'), this.props.t('octavi:Value')]]
                //since data is a lowest level for the map, we need to avoid duplicates
                const importedSM = []
                for (let feature of featuresWithValue) {
                    if (!importedSM.includes(feature.properties.SM_name)) {
                        importedSM.push(feature.properties.SM_name)
                        zone_export.push([
                            feature.properties.SM_name ? feature.properties.SM_name: "",
                            feature.properties.SM_name ? feature.properties.value: "",
                        ])
                    }
                }
            }


            this.setState({
                mapMinValue     : minValue,
                mapMaxValue     : maxValue,
                mapDataHasLoaded: true,
                zone_data       : {features: featuresWithValue, type: 'FeatureCollection'},
                zone_export     : zone_export
            }, function() {this.setScale()}.bind(this))
        } else {
            this.setState({
                mapMinValue     : 0,
                mapMaxValue     : 0,
                mapDataHasLoaded: true,
                zone_data       : {features: this.props.zone_data.features, type: 'FeatureCollection'},
                zone_export     : undefined
            }, function() {this.setScale()}.bind(this))
        }
    }

    onClick(event) {
        if (!this.state.showPopup) {
            if (event.features[0]) {
                this.setState({
                    showPopup:!this.state.showPopup,
                    eventFeatures: event.features[0]
                })
            }
        } else {
            this.setState({
                showPopup:false,
                eventFeatures: null
            })
        }
	}


    onHover(event) {
        if (event.features && event.features[0] && event.features[0].properties.data && event.features[0].properties.id != this.state.hoverId) {
            const hoverId = event.features[0].properties[this.mapStyleToZoneData[this.state.mapOptions.selectedMapStyle]]
            this.setState({ hoverId })
        }
	}

    getValueName() {
        const widgetOptions = this.getWidgetOptions();

        //geting first part of the title
        const isObjectOptionNotNull       = !_isBlank(widgetOptions.objectOption) && widgetOptions.objectOption !== "none"
        const isTemporalOptionNotNull     = !_isBlank(widgetOptions.temporalOption) && widgetOptions.temporalOption !== "none"
        const isGeographicalOptionNotNull = !_isBlank(widgetOptions.geographicalOption) && widgetOptions.geographicalOption !== "none"
        const isStatusOptionNull          = !_isBlank(widgetOptions.statusOption) && widgetOptions.statusOption !== "none"
        let title

        title  = this.props.t(`octavi:widgets.${widgetOptions.object}.count`)

        // options part
        title = this.addOptionsTitle(title, isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull, isStatusOptionNull)

        return title
    }

    getFileName() {
        const widgetOptions = this.getWidgetOptions();

        const isObjectOptionNotNull       = !_isBlank(widgetOptions.objectOption) && widgetOptions.objectOption !== "none"
        const isTemporalOptionNotNull     = !_isBlank(widgetOptions.temporalOption) && widgetOptions.temporalOption !== "none"
        const isGeographicalOptionNotNull = !_isBlank(widgetOptions.geographicalOption) && widgetOptions.geographicalOption !== "none"
        const isStatusOptionNull          = !_isBlank(widgetOptions.statusOption) && widgetOptions.statusOption !== "none"

        let fileName = this.props.t(`octavi:widgets.${widgetOptions.object}.fileCount`)
        fileName = this.addOptionFileName(fileName, isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull, isStatusOptionNull)

        fileName = camelCase(fileName)

        //add dates info to file names
        const idxFilterOne = getFilterIdx(this.state.filters, 'FilterOne')

        if (this.state.filters[idxFilterOne]['calendarStartAt'] && this.state.filters[idxFilterOne]['calendarEndAt']) {
            const dates = getDatesForPeriodAggregation(
                this.state.filters[idxFilterOne]['calendarStartAt'],
                this.state.filters[idxFilterOne]['calendarEndAt'],
                widgetOptions.temporalOption
              )
            const startString = moment(dates['periodStart']).format("YYYYMMDD");
            const endString = moment(dates['periodEnd']).format("YYYYMMDD");
            fileName += startString + "_" + endString
        }

        return fileName
    }


    addOptionsTitle(title, isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull, isStatusOptionNull) {
        const widgetOptions = this.getWidgetOptions();
        if ( isObjectOptionNotNull ) {
            title += " " + this.props.t(`octavi:widgetOptions:objectOption:${widgetOptions.objectOption}`).toLowerCase()
        }
        if ( isGeographicalOptionNotNull ) {
            title += " " + this.props.t(`octavi:widgetOptions:geographicalOption:${widgetOptions.geographicalOption}`).toLowerCase()
            title += " (" + this.props.t(`octavi:widgetOptions:onLocationOption:${widgetOptions.onLocationOption ? widgetOptions.onLocationOption: 'origin'}`).toLowerCase() + ")"
        }
        if ( isStatusOptionNull ) {
            title += " " +  this.props.t(`octavi:widgetOptions:statusOption:titleFirstPart`) + " " + this.props.t(`octavi:widgetOptions:statusOption:${widgetOptions.statusOption}`).toLowerCase();
        }
        if ( isTemporalOptionNotNull ) {
            title += " " + this.props.t(`octavi:widgetOptions:temporalOption:${widgetOptions.temporalOption}`).toLowerCase();
        }
        return title
    }

    addOptionFileName(fileName, isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull, isStatusOptionNull) {
        const widgetOptions = this.getWidgetOptions();
        if ( isObjectOptionNotNull ) {
            fileName += " " + this.props.t(`octavi:widgetOptions:objectOption:${widgetOptions.objectOption}`)
        }
        if ( isGeographicalOptionNotNull ) {
            fileName += " " + this.props.t(`octavi:widgetOptions:geographicalOption:file:${widgetOptions.geographicalOption}`)
            fileName += " " + this.props.t(`octavi:widgetOptions:onLocationOption:file:${widgetOptions.onLocationOption ? widgetOptions.onLocationOption: 'origin'}`)
        }
        if ( isStatusOptionNull ) {
            fileName += " " + this.props.t(`octavi:widgetOptions:statusOption:${widgetOptions.statusOption}`);
        }
        if ( isTemporalOptionNotNull ) {
            fileName += " " + this.props.t(`octavi:widgetOptions:temporalOption:${widgetOptions.temporalOption}`).toLowerCase();
        }
        return fileName
      }

    onDownloadClick() {
        const fileName = this.getFileName()
        exportTocsv(`${fileName}.csv`, this.state.zone_export)

    }

    renderLayers() {

        const layers = [
            <Source id="zones_SM" key="zones_SM" type="geojson" data={this.state.aggregations.data_lvl1}>
                <Layer
                    id       = "borders_SM"
                    type     = "line"
                    paint    = {{
                        'line-color': `rgb(30,30,30)`,
                    }}
                />
            </Source>
        ]

        layers.push(
            <Source id="zones_SR" key="zones_SR" type="geojson" data={this.state.zone_data}>
                <Layer
                    beforeId = "borders_SM"
                    id       = "borders_SR"
                    type     = "line"
                    paint    = {{
                        'line-color': `rgb(30,30,30)`,
                        'line-opacity': 0.75,
                        'line-width': 0.5
                    }}
                />

                <Layer
                    id       = "hovered_zone"
                    beforeId = "borders_SR"
                    type     = "fill"
                    filter   = {['in', this.mapStyleToZoneData[this.state.mapOptions.selectedMapStyle], this.state.hoverId]}
                    paint = {{
                        'fill-color': '#193d85',
                        'fill-opacity': 0.5
                    }}
                />


                <Layer
                    id       = "zones_value"
                    beforeId = "hovered_zone"
                    type     = "fill"
                    paint    = {{
                        'fill-color': {
                            property: 'value',
                            stops: this.state.colorMap.map(function(color, idx) {
                                    return ([this.state.scale[idx], color])
                                }.bind(this))
                            },
                        'fill-opacity' : 0.4
                    }}
                />
            </Source>
        )
        return layers
    }

    renderPopUp() {
        let selectedGeom;
        let selectedProp;
        if (this.state.mapOptions.selectedMapStyle === "SRMap") {
            selectedGeom = this.state.zone_data.features.filter((feature) => feature.properties[this.mapStyleToZoneData[this.state.mapOptions.selectedMapStyle]] === this.state.hoverId)[0];
            if (selectedGeom) {
                selectedProp = selectedGeom.properties;
            } else {
                return
            }
        } else if (this.state.mapOptions.selectedMapStyle === "SMMap") {
            selectedGeom = this.state.aggregations.data_lvl1.features.filter((feature) => feature.properties[this.mapStyleToZoneData[this.state.mapOptions.selectedMapStyle]] === this.state.hoverId)[0];
            // we must do this bc value is only in zone_data  layer
            selectedProp = this.state.zone_data.features.filter((feature) => feature.properties[this.mapStyleToZoneData[this.state.mapOptions.selectedMapStyle]] === this.state.hoverId)[0];
            if (selectedProp) {
                selectedProp = selectedProp.properties;
            } else {
                return

            }
        }
        if (!_isBlank(selectedGeom)) {
            const popupPosition = this.state.showPopup ? centroid(selectedGeom.geometry) : ""
            return (
                <Popup
                    longitude            = {popupPosition.geometry.coordinates[0]}
                    latitude             = {popupPosition.geometry.coordinates[1]}
                    anchor               = "left"
                >
                    <div>
                        <div>{`${this.getValueName()}`}</div>
                        <div style={{textAlign:"left"}}>
                            <ul style={{paddingLeft:0, listStylePosition:"inside"}}>
                                {this.state.mapOptions.selectedMapStyle === "SRMap" && <li>{`${this.props.t('octavi:maps:popup:SMName')} : ${selectedProp.SR}`}</li>}
                                <li>{`${this.props.t('octavi:maps:popup:SRName')} : ${selectedProp.SM_name}`}</li>
                                <li>{`${this.props.t('octavi:Value')} : ${selectedProp.value}`}</li>
                            </ul>
                        </div>
                    </div>
                </Popup>
            )
        }
    }

    renderLegend () {
        const legendLines = this.state.colorMap.map(function(color, idx) {
            return (
                <div key={`legend_${idx}`}>
                    <span className='legend-key' style={{backgroundColor: color}}/>
                    <span>{!_isBlank(this.state.scale[idx]) && !_isBlank(this.state.scale[idx + 1]) ? `${this.state.scale[idx].toFixed(1)} - ${this.state.scale[idx + 1].toFixed(1)}`: '-'}</span>
                </div>
            )
        }.bind(this))
        return (
            <div className='map-overlay' id='legend'>
                <div className='_center' style={{marginBottom:"0.5em"}}>{this.getValueName()}</div>
                <div>{legendLines}</div>
            </div>
        )
    }



    render () {
        if (!this.state.mapDataHasLoaded==true || _isBlank(this.state.aggregations)){
            return (
                <LoadingPage />
            );
        }
        return null; /* (
            <InteractiveMap
                initialViewState = {this.state.viewport}
                ref                  = {this.mapRef}
                width                = "100%"
                height               = "100%"
                onMove               = {(event) => this.onViewportChange(event.viewState)}
                dragRotate           = {false}
                onHover              = {this.onHover}
                mapStyle             = "https://demotiles.maplibre.org/style.json"
            >

                {this.renderLegend()}
                {this.renderLayers()}
                {this.state.showPopup && this.state.hoverId !== "" && this.renderPopUp()}
                <div className='map-overlay-download' id='download'>
                    <button
                        className = {"button grey"}
                        type      = "button"
                        onClick   = {() => this.onDownloadClick()}
                    >
                        <img
                            className = {`_icon chart_line_white`}
                            src       = "/dist/images/icons/octavi/export_to_file_white.svg"
                            alt       = "settings"
                        />
                    </button>
                </div>
            </InteractiveMap>
        )*/

    }

}
