import React from "react";
import { withTranslation } from 'react-i18next';
import PropTypes      from "prop-types";
import { union, centroid }      from '@turf/turf';
import { groupBy, orderBy, max } from "lodash";

import InteractiveMap, { Source, Layer } from "react-map-gl/maplibre";

import Preferences      from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator   from 'chaire-lib-common/lib/utils/ServiceLocator'
import InputSelect      from 'chaire-lib-frontend/lib/components/input/InputSelect'

import { _isBlank } from "chaire-lib-common/lib/utils/LodashExtensions";


class ZonesInteractiveMap extends React.Component {

	constructor(props) {
		super(props);

		this.mapRef = React.createRef()

		this.state = {
			viewport: {
                longitude: Preferences.get('map.center')[0],
                latitude : Preferences.get('map.center')[1],
                zoom     : Preferences.get('map.zoom'),
            },
            currSelection : {
                origin     : props.selected ? [...props.selected.origin] : [],
                destination: props.selected ? [...props.selected.destination] : []
            },
			hoverId: "",
            eventFeatures: {},
            popupOptions : {},
            showPopup    : false,
            zoneType     : props.zoneType ? props.zoneType : 'origin',
            level        : this.props.defaultLevel ? this.props.defaultLevel : 0,
            maxLevel     : this.props.aggregations ? max(this.props.aggregations.map(item => item.level)) : 0,
            sortedLevels : this.props.aggregations ? this.props.aggregations.map(item => item.level).sort() : [] //sorting in descending order
		}

        this.colors = this.props.colors ?
            this.props.colors :
            {
                origin: {
                    main: "#468024",
                    sub: "#000000"
                },
                destination: {
                    main: "#468024",
                    sub: "#000000"
                }
            }

        const aggregations =  serviceLocator.collectionManager.get('aggregatedZones')

        this.state = {
            ...this.state,
            aggregations
        }

		this.onViewportChange         = this.onViewportChange.bind(this);
		this.onClick                  = this.onClick.bind(this);
		this.onHover                  = this.onHover.bind(this);
		this.onClickDeleteSelection   = this.onClickDeleteSelection.bind(this);
		this.onClickSelectZone        = this.onClickSelectZone.bind(this);
		this.onClickOrigin            = this.onClickOrigin.bind(this);
		this.onClickDestination       = this.onClickDestination.bind(this);
		this.onChange_lvl             = this.onChange_lvl.bind(this);
		this.getLevelaggObjectName    = this.getLevelaggObjectName.bind(this);
		this.featureAggregator        = this.featureAggregator.bind(this);
		this.renderLayers             = this.renderLayers.bind(this);
        this.renderControlPanel       = this.renderControlPanel.bind(this)
	}

componentDidMount() {
        serviceLocator.eventManager.emit(`${process.env.APP_NAME}Zones.selection`, this.state.currSelection)
	}


	componentWillUnmount() {


        const newViewport = {
            'map.center' : [this.state.viewport.longitude, this.state.viewport.latitude],
            'map.zoom'   : this.state.viewport.zoom
          }
        Preferences.update(serviceLocator.socketEventManager, serviceLocator.eventManager, newViewport)
	}

	onViewportChange(viewport) {
        this.setState({ viewport })
    }

	onClick(event) {
        const { zoneType, showPopup, level, currSelection } = this.state
        //first we get the list of all element selected regarding aggregation level
        let selectedElements;
        if (level === 0) {
            selectedElements = [event.features[0].properties.id]
        } else {
            const lvlObjecName = this.getLevelaggObjectName(level)
            const objectId = event.features[0].properties[lvlObjecName]
            const selectedFeatures = this.props.data.features.filter(feature => feature.properties[lvlObjecName] === objectId)
            selectedElements = selectedFeatures.map(feature => feature.properties.id)
        }

        //then we add or substract selected zone to currSelection
        //we reselect a zone if at least one of its elements is not selected
        const newSelection = {...currSelection};
        newSelection[zoneType] = Array.isArray(newSelection[zoneType]) ? newSelection[zoneType] : []

        if (selectedElements.every(id => newSelection[zoneType].includes(id))) {
            selectedElements.forEach(id => {
                if (newSelection[zoneType].includes(id)) {
                    const idIdx = newSelection[zoneType].indexOf(id)
                    newSelection[zoneType].splice(idIdx, 1);
                }
            })
        } else {
            selectedElements.forEach(id => {
                if (!newSelection[zoneType].includes(id)) {
                    newSelection[zoneType].push(id)
                }
            })
        }
        newSelection[zoneType] =  newSelection.length === 0 ? "" : newSelection[zoneType]

        this._updateSelection(newSelection)
	}

	onHover(event) {
        if (!this.state.showPopup) {
            if (event.features && event.features[0] && event.features[0].properties.data && event.features[0].properties.id != this.state.hoverId) {
                const hoverId = event.features[0].properties[this.getLevelaggObjectName(this.state.level)]
                this.setState({ hoverId })
            }
        }
	}

    onClickDeleteSelection(e) {
        e.preventDefault()
        const newSelection = {...this.state.currSelection};
        newSelection[this.state.zoneType] = []
        this._updateSelection(newSelection)
    }

    onClickSelectZone(e, zoneProps, propName) {
        e.preventDefault()
        const newSelection = {...this.state.currSelection};
        //then we add or substract selected zone to currSelection
        //we reselect a zone if at least one of its elements is not selected
        //raw prop name can be used to pass direct zone ids. In this case we won't filter them via componant data
        let zoneIds;
        if (propName === "raw") {
            zoneIds = zoneProps
        } else(
            zoneIds = this.props.data.features.filter((zone) => zone.properties.data[propName] && zoneProps.includes(zone.properties.data[propName])).map((zone) => zone.properties.id)
        )

        if (zoneIds.every(id => newSelection[this.state.zoneType].includes(id))) {
            zoneIds.forEach(id => {
                if (newSelection[this.state.zoneType].includes(id)) {
                    const idIdx = newSelection[this.state.zoneType].indexOf(id)
                    newSelection[this.state.zoneType].splice(idIdx, 1);
                }
            })
        } else {
            zoneIds.forEach(id => {
                if (!newSelection[this.state.zoneType].includes(id)) {
                    newSelection[this.state.zoneType].push(id)
                }
            })
        }
        this._updateSelection(newSelection)
    }

    onClickOrigin(e) {
        e.stopPropagation()
        e.preventDefault()
        const currSelection = this.state.currSelection
        if (this.props.ableUniqueSelector) {
            currSelection.destination = []
            serviceLocator.eventManager.emit(`${process.env.APP_NAME}Zones.selection`, currSelection)
        }
        this.setState({ zoneType: "origin", showPopup: false, currSelection})
    }

    onClickDestination(e) {
        e.preventDefault()
        const currSelection = this.state.currSelection
        if (this.props.ableUniqueSelector) {
            currSelection.origin = []
            serviceLocator.eventManager.emit(`${process.env.APP_NAME}Zones.selection`, currSelection)
        }
        this.setState({ zoneType: "destination", showPopup: false, currSelection})
    }

    onChange_lvl(e) {
        e.preventDefault()
        this.setState({ level: parseInt(e.target.value), showPopup: false})
    }


    _updateSelection(newSelection) {
        this.setState({
            currSelection: newSelection,
            showPopup    : false
        })
        serviceLocator.eventManager.emit(`${process.env.APP_NAME}Zones.selection`, newSelection)
    }

    getLevelaggObjectName(level) {
        if (level === 0) {
            return "id"
        } else {
            const levelProp = this.props.aggregations.filter(lvl => lvl.level === level)[0]
            return this.state.aggregations[`data_lvl${level}`].aggregator
        }
    }

    getAggregationChoices() {
        const choices = [{
            value: 0,
            label: this.props.aggregationLocalPrefix ? `${this.props.t('osc2ar:by')} ${this.props.t(`${this.props.aggregationLocalPrefix}:lvl0`)}`: "level 0"
        }]

        for (let aggregation of this.props.aggregations) {
            choices.push({
                value: aggregation.level,
                label: this.props.aggregationLocalPrefix ? `${this.props.t('osc2ar:by')} ${this.props.t(`${this.props.aggregationLocalPrefix}:lvl${aggregation.level}`)}`: `level ${aggregation.level}`
            })
        }

        return choices
    }

    featureAggregator (aggAtribute, featureSet) {
        const aggArray     = groupBy(featureSet.features, item => item.properties.data[aggAtribute])
        const features     = Object.keys(aggArray).map( (key, idx) => {
            const item        = aggArray[key]
            // we order SR by desc size to make union easier to calculate
            item.sort((a, b) => {return _isBlank(a.geometry) || _isBlank(b.geometry) ? 1 : b.geometry.coordinates[0].length - a.geometry.coordinates[0].length})
            const geometry = item.reduce((accUnion, feature, index) => index? union(accUnion, feature):null )
            geometry['id']              = idx
            geometry.properties['ids']  = item.map(x => x.properties.id)
            geometry.properties['name'] = key
            return geometry
        });
        return {
            features: features,
            type    : "FeatureCollection"
        }
    }

    renderLayers(){
        const { zoneType, showPopup, hoverId, currSelection, eventFeatures } = this.state
        const main = zoneType
        const sub  = zoneType == 'origin' ? 'destination' : 'origin'

        const layers = []

        // construction of aggregated layers
        if (this.state.maxLevel > 0) {
            for (let lvlIdx in this.state.sortedLevels) {
                const lvl = this.state.sortedLevels[lvlIdx]
                layers.push(
                    <Source id={`zonesLvl${lvl}`} key={`zonesLvl${lvl}`} type="geojson" data={this.state.aggregations[`data_lvl${lvl}`]}>
                        <Layer
                            id       = {`borders_lvl${lvl}`}
                            beforeId = {lvlIdx  == this.state.sortedLevels.length - 1 ? null : `borders_lvl${this.state.sortedLevels[parseInt(lvlIdx)+1]}`} // shoud be "road-label-small" for highest level  //warning "===" comparison doesn't work --> needs to be "==" for types reasons
                            type     = "line"
                            paint    = {{
                                "line-color": `rgb(${30 * (1 - lvl/this.state.maxLevel)},${30 * (1 - lvl/this.state.maxLevel)},${30 * (1 - lvl/this.state.maxLevel)})`
                            }}
                        />
                    </Source>
                )
            }
        }
         // then we add layers for level 0
         layers.push(
            <Source id="zonesLvl0" key="zonesLvl0" type="geojson" data={this.props.data}>
                <Layer
                    id       = "borders_lvl0"
                    beforeId = {this.state.maxLevel > 0 ? `borders_lvl${this.state.maxLevel}`: "road-label-small"}
                    type     = "line"
                    paint    = {{
                        'line-color': this.state.maxLevel >  0 ? `rgb(30,30,30)` : 'rgb(0,0,0)',
                        'line-opacity': 0.75
                    }}
                />

                <Layer
                    id       = "hoveredZone"
                    beforeId = "borders_lvl0"
                    type     = "fill"
                    filter   = {['in', this.getLevelaggObjectName(this.state.level), showPopup ? eventFeatures[this.getLevelaggObjectName(this.state.level)] : hoverId]}
                    paint = {{
                        'fill-color': '#193d85',
                        'fill-opacity': 0.5
                    }}                />

                <Layer
                    id       = "mainSelection"
                    beforeId = "hoveredZone"
                    type     = "fill"
                    filter   = {['in', 'id'].concat(currSelection[main])}
                    paint    = {{
                        "fill-color"   : this.colors[main].main,
                        'fill-opacity': 0.7
                    }}

                />
                <Layer
                    id       = "subSelection"
                    beforeId = "mainSelection"
                    type     = "fill"
                    filter   = {['in', 'id'].concat(currSelection[sub])}
                    paint = {{
                        'fill-color': this.colors[sub].sub,
                        'fill-opacity': 0.3
                    }}
                />
                <Layer
                    id       = "zones"
                    beforeId = "subSelection"
                    type     = "fill"
                    paint    = {{ 'fill-color': 'rgba(255,255,255,0.2)' }}
                />

            </Source>
         )


         return layers
    }

    renderControlPanel() {
        const { zoneType, level } = this.state
        return (
            <div className = "mapButton_container" style={{zIndex:this.props.style.zIndex == 0 ? 0 : this.props.style.zIndex + 1}}>
                <div className = "buttonZonesSelection_container" style={{}}>
                    <button
                        className = "_input"
                        onClick   = {this.onClickDeleteSelection}
                    > {this.props.t('osc2ar:deleteSelection')}
                    </button>

                    {this.props.groupedZones && this.props.groupedZones.map(zone => {
                        //we llok if all zone in group are selected to have relevant class name
                        let zoneIds;
                        if (zone.propName === "raw") {
                            zoneIds = zone.ids
                        } else(
                            zoneIds = this.props.data.features.filter((zoneInfo) => zoneInfo.properties.data[zone.propName] && zone.ids.includes(zoneInfo.properties.data[zone.propName])).map((zoneInfo) => zoneInfo.properties.id)
                        )
                        const selectionIncludesAllGroupZones = zoneIds.every(id => this.state.currSelection[this.state.zoneType].includes(id))

                        return (
                            <button
                                key = {`zone_button_${zone.name}`}
                                className = {selectionIncludesAllGroupZones ? "_input _input-select-button _green" : "_input"}
                                onClick   = {(e) => this.onClickSelectZone(e, zone.ids, zone.propName)}
                            > {`${this.props.t('osc2ar:selectZone')} : ${this.props.t(`${this.props.groupedZonesLocalPrefix}:${zone.name}`)}`}
                            </button>
                        )
                    })}
                </div>

                <div>
                    <div className = "buttonOriginDestination_container" style={{}}>
                        <button
                            id        = "origin"
                            className = "buttonOriginDestination"
                            style    = {{backgroundColor: `${zoneType == "origin" ? this.colors.origin.main  : "#ffffff"}`}}
                            onClick   = {this.onClickOrigin}
                            disabled  = {zoneType == "origin"}
                        > {this.props.t('osc2ar:origin')}
                        </button>

                        <button
                            id       = "destination"
                            className = "buttonOriginDestination"
                            style    = {{backgroundColor: `${zoneType == "destination" ? this.colors.destination.main : "#ffffff"}`}}
                            onClick  = {this.onClickDestination}
                            disabled = {zoneType == "destination"}
                        > {this.props.t('osc2ar:destination')}
                        </button>
                    </div>

                    <div className = "buttonOriginDestination_container" style={{top:"5px"}}>
                        <div className="buttonAggregationLevel">
                            <InputSelect
                                className       = "buttonAggregationLevel"
                                choices         = {this.getAggregationChoices()}
                                value           = {level}
                                onValueChange   = {(e) => this.onChange_lvl(e)}
                                noBlank = {true}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    }


	render() {
        const { showPopup, viewport, eventFeatures } = this.state
        const popupPosition = showPopup ? centroid(eventFeatures.geometry) : ""

        const isMapActive = _isBlank(this.props.isActive) ? true : this.props.isActive

        return (
            <div>
                { isMapActive &&
                    <div>
                        {this.renderControlPanel()}
                        <InteractiveMap
                            initialViewState = {viewport}
                            style  = {this.props.style}
                            ref    = {this.mapRef}
                            width  = "100%"
                            height = {this.props.style.height}
                            onMove           = {(event) => this.onViewportChange(event.viewState)}
                            onClick          = {this.onClick}
                            onHover			 = {this.onHover}
                            dragRotate       = {false}
                            mapStyle           = "https://demotiles.maplibre.org/style.json"
                        >
                            {this.renderLayers()}
                        </InteractiveMap>
                    </div>
                }
            </div>
		)
	}

}

ZonesInteractiveMap.defaultProps = {
    allowComplexUi: true,
    lvl_0_label_key: "id"
  };


ZonesInteractiveMap.propTypes = {
    style           : PropTypes.object,
    data            : PropTypes.object,
    section         : PropTypes.string,
    allowComplexUi  : PropTypes.bool,
    levels          : PropTypes.object
}

        // var a = document.createElement("a");
        // var file = new Blob([JSON.stringify(this.state.currSelection)], {type: 'text/plain'});
        // a.href = URL.createObjectURL(file);
        // a.download = 'zoneIds.json';
        // a.click();
export default withTranslation()(ZonesInteractiveMap);
