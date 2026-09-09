import React       from 'react';

import { LoadingPage } from "chaire-lib-frontend/lib/components/pages";
import { _isBlank }                       from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator                     from 'chaire-lib-common/lib/utils/ServiceLocator';
import OriginDestinationSRSM              from '../widgets/OriginDestinationSR_SMmap.mapWidget';
import octaviParameters from '../../../services/ui/OctaviParameters';

export default class OctaviMaps extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      isEnabled         : serviceLocator.collectionManager.has('zones'),
      taxiDataSourceId  : null,
      startAt           : null,
      endAt             : null,
      zoneDataHasLoaded : false,
      mapOptions        : octaviParameters.mapOptions
    };

    //sonce we don't have filter comparison in map, we make shure to have filterOne selected
    octaviParameters.filterSelected  = "FilterOne";
    serviceLocator.eventManager.emit('taxi.filter.filterSelection.update');

    this.enableMap              = this.enableMap.bind(this)
    this.updateDataSourceIds    = this.updateDataSourceIds.bind(this);
    this.updateWidgetSelection  = this.updateWidgetSelection.bind(this);
    this.loadZones_lvl1         = this.loadZones_lvl1.bind(this);
    this.addFeaturesDataProp    = this.addFeaturesDataProp.bind(this);

    //init zone data
    this.state = {...this.state,
        zone_data: this.loadZones_lvl1()
    };
    this.state = {...this.state,
        zoneDataHasLoaded: true
    }
  }

  componentDidMount() {
    serviceLocator.eventManager.on('taxi.dataSources.loaded', this.updateDataSourceIds);
    serviceLocator.eventManager.on('taxi.filter.selectedMapOptions.update', this.updateWidgetSelection);
    serviceLocator.eventManager.on("taxi.filter.spatial.enable", this.enableMap);
  }

  componentWillUnmount() {
    serviceLocator.eventManager.off('taxi.dataSources.loaded', this.updateDataSourceIds);
    serviceLocator.eventManager.off('taxi.filter.selectedMapOptions.update', this.updateWidgetSelection);
    serviceLocator.eventManager.off("taxi.filter.spatial.enable", this.enableMap);
  }

  enableMap() {
        this.setState(
            {
                isEnabled: true,
                zone_data:this.loadZones_lvl1()
            }
        )
    }

  updateDataSourceIds() {
    this.setState({
      dataSourceIds: octaviParameters.dataSourceIds
    });
  }

  updateWidgetSelection() {
    let newSelectedMapWidget = octaviParameters.selectedMapWidget;
    this.setState({ selectedMapWidget: newSelectedMapWidget })
  }

  loadZones_lvl1() {
    let features = (serviceLocator.collectionManager.has('zones')) ? serviceLocator.collectionManager.get('zones').features : [];
    features = this.addFeaturesDataProp('SM', features)
    features = this.addFeaturesDataProp('SR', features)
    features = this.addFeaturesDataProp('SM_name', features)
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

  getSelectedWidgetComponent() {
    if (this.state.mapOptions.selectedMapStyle && this.state.mapOptions.selectedMapStyle == "SRMap" || this.state.mapOptions.selectedMapStyle == "SMMap") {
        return (
            <OriginDestinationSRSM
                key                 = 'taxiOriginMapWidgetSMSR'
                t                   = {this.props.t}
                i18n                = {this.props.i18n}
                zone_data           = {this.state.zone_data}
                isEnabled           = {this.state.isEnabled}
            />
          )
    }
  }


  render() {
    if (octaviParameters.dataSourceIds.length === 0)
    {
      return <LoadingPage />;
    }
    // if map by zones, we make sure that the zones had time to load
    if (
        (this.state.mapOptions.selectedMapStyle && this.state.mapOptions.selectedMapStyle == "SRMap" || this.state.mapOptions.selectedMapStyle == "SMMap")
        && (!this.state.zoneDataHasLoaded || !this.state.isEnabled)
        ) {
        return <LoadingPage />
    }
    return (
      <div style={{width:'100%', height:'100%'}}>
        {this.getSelectedWidgetComponent()}
      </div>
    );
  }
}
