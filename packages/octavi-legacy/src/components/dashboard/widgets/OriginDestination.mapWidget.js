import React from 'react';
import moment from 'moment-timezone';
import geobuf from 'geobuf';
import Pbf    from 'pbf';

import { _isBlank }     from 'chaire-lib-common/lib/utils/LodashExtensions';
import { LoadingPage } from "chaire-lib-frontend/lib/components/pages";
import serviceLocator   from 'chaire-lib-common/lib/utils/ServiceLocator';
import config           from 'chaire-lib-common/lib/config/shared/project.config';
import originDestinationMapOptions from '../graphOptions/originDestinationMapOptions';
import octaviParameters from '../../../services/ui/OctaviParameters';

import Maps                 from "../../graph/Map";

export default class OriginDestinationMapWidget extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      valueFilterOne        : null,
    };

    this.updateTimeRange = this.updateTimeRange.bind(this);
  }

  componentDidMount() {
    //connect to filter modification
    serviceLocator.eventManager.on('taxi.filter.submit', this.updateTimeRange);
    serviceLocator.eventManager.on(`taxi.widget.${this.props.object}widgetChartStatus.update`, this.updateTimeRange);
    this.updateTimeRange();
  }

  componentWillUnmount() {
    serviceLocator.eventManager.off('taxi.filter.submit', this.updateTimeRange);
    serviceLocator.eventManager.off(`taxi.widget.${this.props.object}widgetChartStatus.update`, this.updateTimeRange);
  }

  updateValueFilter() {
    // const filterKey = getLocalStorageKey("FilterOne")

    // const dataType = "originDestination"
    // const result   = loadLocalStorageFromFilter(filterKey, this.props.requestName, dataType)
    // if (result) { // data already existing in locale storage
    //   this.setState({ ["valueFilterOne"]: result })
    // }
    // else { // data doesn't exist in locale storage, need to import and compute data
      serviceLocator.socketEventManager.emit(`taxiTrips.${this.props.requestName}GeojsonCollection.timeRange`, {
        dataSourceIds: octaviParameters.dataSourceIds,
        startAt      : moment.tz(`${octaviParameters["calendarStartAtFilterOne"]} 00:00:00`, config.timezone).clone().tz('utc').unix(),
        endAt        : moment.tz(`${octaviParameters["calendarEndAtFilterOne"]} 23:59:59`, config.timezone).clone().tz('utc').unix(),
        format       : 'geobuf',
				filters      : this.getFilter("FilterOne")
        //sampleSize: 1000
      }, function(geojsonResponse) {
        const geojson = geojsonResponse.geobuf ? geobuf.decode(new Pbf(geojsonResponse.geobuf)) : geojsonResponse.geojson;
        // saveLocalStorageDataFromFilter(filterKey, this.props.requestName, geojson, dataType) //too big for localestorage for now
        this.setState({ ["valueFilterOne"]: geojson});
      }.bind(this));
    // }
  }

  updateTimeRange() {
    if (octaviParameters['calendarStartAtFilterOne'] && octaviParameters['calendarEndAtFilterOne'])
    {
      // we start by init value to null to relaunch loading page
      this.setState({ valueFilterOne: null });
      this.updateValueFilter()
    }
  }


  getFilter() {
    const filter = {mode:"simple"};
    filter['temporal'] = {
      hours        : octaviParameters[`hourIsSelectedFilterOne`] && octaviParameters[`temporalFilterIsSelectedFilterOne`]? octaviParameters[`hourChoicesFilterOne`]: null,
      dow          : octaviParameters[`dayIsSelectedFilterOne`]  && octaviParameters[`temporalFilterIsSelectedFilterOne`]? octaviParameters[`dayChoicesFilterOne`]: null,
    }
    filter['spatial'] = {
			origin       : octaviParameters[`originIsSelectedFilterOne`] && octaviParameters[`spatialFilterIsSelectedFilterOne`]? octaviParameters[`selectedOriginDistrictsFilterOne`]: null,
			destination  : octaviParameters[`destinationIsSelectedFilterOne`]  && octaviParameters[`spatialFilterIsSelectedFilterOne`]? octaviParameters[`selectedDestinationDistrictsFilterOne`]: null,
		}

    // joining custom hour filter
    if (filter['temporal']['hours'] && filter['temporal']['hours'].includes('other')){
        let newHours = [...filter['temporal']['hours']]
        const otherIdx = newHours.indexOf('other');
        newHours.splice(otherIdx, 1);
        const customHours = octaviParameters[`hourCustomChoicesFilterOne`]
        newHours = newHours.concat(customHours)
        filter['temporal']['hours'] = newHours
    }
    return filter;
  }

render () {
    if (_isBlank(this.state.valueFilterOne)){
      return (
          <LoadingPage />
    	);
    }
    return (
        <Maps
            t               = {this.props.t}
            size            = {"main"}
            data            = {this.state.valueFilterOne}
            name            = {`${this.props.labelName}`}
            filter          = {this.getFilter()}
            generateOptions = {originDestinationMapOptions}
            disableControl  = {false}
        />
    )

  }

}
