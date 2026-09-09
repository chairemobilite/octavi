import React                from 'react';
import Switch from 'react-switch';
import { withTranslation } from 'react-i18next';
import { cloneDeep }        from 'lodash';

import serviceLocator        from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import { _isBlank }          from 'chaire-lib-common/lib/utils/LodashExtensions';
import { getFilterIdx }      from '../../../services/ui/utils'
import octaviParameters      from '../../../services/ui/OctaviParameters';

class SpatialFilterPanel extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
          filterSelected : octaviParameters.get('filterSelected', "FilterOne"),
          filters        : octaviParameters.filters,
          dataSourceIds  : octaviParameters.dataSourceIds
        };

        this.onButtonClick          = this.onButtonClick.bind(this);
        this.onSwitchChange         = this.onSwitchChange.bind(this);
        this.onButtonSelectClick    = this.onButtonSelectClick.bind(this);
        this.updateFilterSelection  = this.updateFilterSelection.bind(this);
        this.updateDataSourceIds    = this.updateDataSourceIds.bind(this);
        this.updateFilter           = this.updateFilter.bind(this);

      }

      componentDidMount() {
        serviceLocator.eventManager.on('taxi.dataSources.loaded', this.updateDataSourceIds);
        serviceLocator.eventManager.on('taxi.filter.filterSelection.update', this.updateFilterSelection);
        serviceLocator.eventManager.on('taxi.filter.init', this.updateFilter);
        serviceLocator.eventManager.on('taxi.filter.data.update', this.updateFilter);
      }

      componentWillUnmount() {
        serviceLocator.eventManager.off('taxi.dataSources.loaded', this.updateDataSourceIds);
        serviceLocator.eventManager.off('taxi.filter.filterSelection.update', this.updateFilterSelection);
        serviceLocator.eventManager.off('taxi.filter.init', this.updateFilter);
        serviceLocator.eventManager.off('taxi.filter.data.update', this.updateFilter);
      }


      updateDataSourceIds() {
        this.setState({
          dataSourceIds: octaviParameters.dataSourceIds
        });
      }

      updateFilterSelection () {
        this.setState({
            filterSelected: octaviParameters.filterSelected
          });
      }

      updateFilter () {
        this.setState({
            filters: octaviParameters.filters
          });
      }

      onButtonClick(name){
        // name is name of the clicked button must be "origin" or "destination"
        const newFilters = cloneDeep(this.state.filters)
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)
        const generalSwitchState = this.state.filters[filterIdx].spatialFilterIsSelected

        // if switch is set to off when clicking we set switch to on and only set clicked button to on
        if (!generalSwitchState){
            newFilters[filterIdx]['originIsSelected']           =  name == "origin" ? true : false;
            newFilters[filterIdx]['destinationIsSelected']      =  name == "destination" ? true : false
            newFilters[filterIdx]['spatialFilterIsSelected']    =  true

        //else we switch correspondinf filter
        } else {
            if (name === 'origin') {
                newFilters[filterIdx]['originIsSelected'] = !newFilters[filterIdx]['originIsSelected']
            } else if (name === 'destination') {
                newFilters[filterIdx]['destinationIsSelected'] = !newFilters[filterIdx]['destinationIsSelected']
            }

            // if all filters are on off we also set switch to off
            if (!newFilters[filterIdx]['originIsSelected'] && !newFilters[filterIdx]['destinationIsSelected']){
                newFilters[filterIdx]['spatialFilterIsSelected'] = false;
            }
        }

        //update filter values
        this.setState({filters:newFilters});

        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update');
    }


    onSwitchChange() {
        const newFilters = cloneDeep(this.state.filters)
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)
        const previousGeneralSwitchState = this.state.filters[filterIdx].spatialFilterIsSelected

        newFilters[filterIdx]['spatialFilterIsSelected'] = !previousGeneralSwitchState

        // if we select filter, we make sure to have at list origine or destination sleected
        if (newFilters[filterIdx]['spatialFilterIsSelected']) {

            // if no filter
            if (!newFilters[filterIdx]['originIsSelected'] && !newFilters[filterIdx]['destinationIsSelected']){
                newFilters[filterIdx]['originIsSelected']        = true;
                newFilters[filterIdx]['destinationIsSelected']   = false;
            }
        }
        //update filter values
        this.setState({filters:newFilters});

        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update');
    }

    onButtonSelectClick(name) {
        if (name=="origin") {
            serviceLocator.eventManager.emit('taxi.filter.selectOrigin.request');
        } else if (name=="destination") {
            serviceLocator.eventManager.emit('taxi.filter.selectDestination.request');
        }
    }


      render() {
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)

        if (this.state.dataSourceIds.length === 0 || this.state.filters.length === 0)
        {
          return <LoadingPage />;
        }
        const originDistricts       = this.state.filters[filterIdx]['selectedOriginDistricts'] || [];
        const destinationDistricts  = this.state.filters[filterIdx]['selectedDestinationDistricts'] || []

        return (
            <div className="tr__form-input-container _margin_bottom_small">
                <div className="_margin_bottom_small _bottom_border">
                    <div className="oct_filter_section _space-between-columns _margin_bottom_small">
                        <h3 className="_left">
                            {this.props.t('octavi:filters:spatial:sectionName')}
                        </h3>
                        <Switch
                            id        = {`formFieldTaxiActivitiesSelectSpatialFilter`}
                            onChange  = {this.onSwitchChange}
                            checked   = {this.state.filters[filterIdx][`spatialFilterIsSelected`]}
                            onColor   = '#609112'
                            height    = {25}
                        />
                    </div>
                </div>

                <div className="oct_filter_section _space-between-columns">
                    <button
                        id        = {`formFieldTaxiActivitiesSelectSpatialFilterOrigin`}
                        className = {this.state.filters[filterIdx][`originIsSelected`] && this.state.filters[filterIdx][`spatialFilterIsSelected`] ? "button green _three_columns" : "button grey _three_columns"}
                        type      = "button"
                        onClick   = {x => this.onButtonClick("origin")}
                    >
                        {this.props.t('octavi:filters:spatial:origin')}
                    </button>
                    <div className="_two_third_column">
                        <div className="_right">
                            {`${originDistricts.length} ${this.props.t("octavi:filters:spatial:zoneCount")}`}
                        </div>
                    </div>
                </div>

                <div className="oct_filter_section _space-between-columns">
                    <button
                        id        = {`formFieldTaxiActivitiesSelectSpatialFilterDestination`}
                        className = {this.state.filters[filterIdx][`destinationIsSelected`] && this.state.filters[filterIdx][`spatialFilterIsSelected`] ? "button green _three_columns" : "button grey _three_columns"}
                        type      = "button"
                        onClick   = {x => this.onButtonClick("destination")}
                    >
                        {this.props.t('octavi:filters:spatial:destination')}
                    </button>
                    <div className="_two_third_column">
                        <div className="_right">
                        {`${destinationDistricts.length} ${this.props.t("octavi:filters:spatial:zoneCount")}`}
                        </div>
                    </div>
                </div>

                <div style     = {{height: "2em"}}>
                    <button
                        className = "_input _input-select-button"
                        style     = {{display: "inline-block"}}
                        type      = "button"
                        onClick   = {x => this.onButtonSelectClick("origin")}
                    >
                        {this.props.t('octavi:filters:spatial:select')}
                    </button>
                </div>

            </div>
        );
      }


}

export default withTranslation()(SpatialFilterPanel);
