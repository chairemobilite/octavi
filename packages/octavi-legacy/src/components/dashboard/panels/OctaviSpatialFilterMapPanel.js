import React from "react";
import { withTranslation } from 'react-i18next';
import PropTypes from "prop-types";

import ZonesInteractiveMap   from "./ZonesInteractiveMap"
import { getFilterIdx }      from '../../../services/ui/utils'


import AdvancedModal         from '../../AdvancedModal'
import serviceLocator        from 'chaire-lib-common/lib/utils/ServiceLocator';
import octaviParameters      from '../../../services/ui/OctaviParameters';
import { _isBlank }          from 'chaire-lib-common/lib/utils/LodashExtensions';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';

// this file contains SM id of aggrgetation i.e. mtl island north shore and south shore
import * as aggregatedzones from '../../../config/zonesSelection.json';
class SpatialFilterMap extends React.Component {
    constructor(props) {
        super(props);

        this.mapRef = React.createRef()

        this.state = {
            //map variables
            filterSelected                          : octaviParameters.get('filterSelected', "FilterOne"),
            filters                                 : octaviParameters.filters,
            currentZoneMapState                     : {},
            isActive: false,
            isEnabled: serviceLocator.collectionManager.has('zones'),
            zoneType: null
        };

        // this.zone_data = { features: [], type    : "FeatureCollection" }
        this.zone_data = this.loadZones_lvl1()

        this.updateFilter          = this.updateFilter.bind(this);
        this.handleClose           = this.handleClose.bind(this);
        this.handleOriginOpen      = this.handleOriginOpen.bind(this);
        this.handleDestinationOpen = this.handleDestinationOpen.bind(this);
        this.handleConfirm         = this.handleConfirm.bind(this);
        this.updateFilterSelection = this.updateFilterSelection.bind(this);
        this.updateZoneSelection   = this.updateZoneSelection.bind(this)
        this.enableSpatialFilter   = this.enableSpatialFilter.bind(this)

    }

    componentDidMount() {
        serviceLocator.eventManager.on('taxi.filter.init', this.updateFilter);
        serviceLocator.eventManager.on('taxi.filter.data.update', this.updateFilter);
        serviceLocator.eventManager.on("taxi.filter.selectOrigin.request", this.handleOriginOpen);
        serviceLocator.eventManager.on("taxi.filter.selectDestination.request", this.handleDestinationOpen);
        serviceLocator.eventManager.on('taxi.filter.filterSelection.update', this.updateFilterSelection);
        serviceLocator.eventManager.on("octaviZones.selection", this.updateZoneSelection);
        serviceLocator.eventManager.on("taxi.filter.spatial.enable", this.enableSpatialFilter);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('taxi.filter.init', this.updateFilter);
        serviceLocator.eventManager.off('taxi.filter.data.update', this.updateFilter);
        serviceLocator.eventManager.off("taxi.filter.selectOrigin.request", this.handleOriginOpen);
        serviceLocator.eventManager.off("taxi.filter.selectDestination.request", this.handleDestinationOpen);
        serviceLocator.eventManager.off('taxi.filter.filterSelection.update', this.updateFilterSelection);
        serviceLocator.eventManager.off("octaviZones.selection", this.updateZoneSelection)
        serviceLocator.eventManager.off("taxi.filter.spatial.enable", this.enableSpatialFilter);
    }

    updateFilter () {
        this.setState({
            filters: octaviParameters.filters
          });
      }

    updateFilterSelection() {
        this.setState({ filterSelected: octaviParameters.filterSelected });
    }

    updateZoneSelection(selection) {
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)
        const {origin, destination} = selection
        const newFilters = [... this.state.filters]
        newFilters[filterIdx][`selectedOriginDistricts`] = origin
        newFilters[filterIdx][`selectedDestinationDistricts`] = destination

        this.setState({ filters : newFilters })
    }

    handleClose() {
        this.setState({ isActive : false })
    }

    handleOriginOpen() {
        this.setState({ isActive : true, zoneType : "origin" })
    }

    handleDestinationOpen() {
        this.setState({ isActive : true, zoneType : "destination" })
    }

    handleConfirm() {
        const newFilters = [... this.state.filters]

        // update octavi parameters
        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update')
    }

    enableSpatialFilter() {
        this.zone_data = this.loadZones_lvl1()
        this.setState({ isEnabled: true})
    }

    loadZones_lvl1() {
        let features = (serviceLocator.collectionManager.has('zones'))
          ? serviceLocator.collectionManager.get('zones').features
          : []
        features = this.addFeaturesDataProp('SM', features)
        return {
            features: features,
            type    : "FeatureCollection"
        }
    }

    addFeaturesDataProp (propName, features) {
        return features.map(function(item){
            const newProps = {...item.properties}
            newProps[propName] = item.properties.data[propName]
            return {
                ...item,
                properties : newProps
            }
        })
    }

    renderContainer() {
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)

        const selected = {
            origin     : this.state.filters[filterIdx] && this.state.filters[filterIdx][`selectedOriginDistricts`] ? this.state.filters[filterIdx][`selectedOriginDistricts`]: [] ,
            destination: this.state.filters[filterIdx] && this.state.filters[filterIdx][`selectedDestinationDistricts`] ? this.state.filters[filterIdx][`selectedDestinationDistricts`] : []
        }

        const groupedZones = [{
            name : "northShore",
            ids : aggregatedzones.northShore,
            propName : "SM"
        },{
            name : "southShore",
            ids : aggregatedzones.southShore,
            propName : "SM"
        },{
            name : "mtl",
            ids : aggregatedzones.mtl,
            propName : "SM"
        },{
            name : "outterCMM",
            ids : ["noMatchFound"],
            propName : "raw"
        }]

        return (
            <div style={{width:"80vw", height:"70vh", position:"relative"}}>

                {this.state.isEnabled &&
                    <ZonesInteractiveMap
                        t                       = {this.props.t}
                        data                    = {this.zone_data}
                        lvl_0_label_key         = "SR"
                        aggregations            = {[{level: 1, aggregator:"SM", label_key:"SM_name"}]}
                        aggregationLocalPrefix  = 'octavi:filters:spatial:mapAggregation'
                        defaultLevel            = {1}
                        section                 = {this.props.activeSection}
                        style                   = {{height:"100%", zIndex:2, position: "absolute"}}
                        selected                = {selected}
                        allowComplexUi          = {true}
                        zoneType                = {this.state.zoneType}
                        groupedZones            = {groupedZones}
                        groupedZonesLocalPrefix = 'octavi:filters:spatial:groupedZones'
                    />
                }

                {!this.state.isEnabled &&
                    <LoadingPage
                        message = {this.props.t('octavi:filters:spatial:message:MapLoading')}
                    />
                }
            </div>
        )
    }

    render() {
        const { isActive } = this.state

        return (
            <AdvancedModal
                title                   = {this.props.t('octavi:filters:spatial:map')}
                t                       = {this.props.t}
                isOpen                  = {isActive}
                container               = {this.renderContainer()}
                showCancelButton        = {true}
                showConfirmButton       = {true}
                closeModal              = {this.handleClose}
                confirmAction           = {this.handleConfirm}
                isConfirmButtonDisabled = {false}
            />
        )
    }
}

export default withTranslation()(SpatialFilterMap);

SpatialFilterMap.propTypes = {
    activeSection: PropTypes.string
}
