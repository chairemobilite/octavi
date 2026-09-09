import React from 'react';
import { withTranslation } from 'react-i18next';
import Switch               from 'react-switch';

import serviceLocator        from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import { _isBlank }          from 'chaire-lib-common/lib/utils/LodashExtensions';
import octaviParameters      from '../../../services/ui/OctaviParameters';

class ComparisonPanel extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
          comparisonIsSelected  : octaviParameters.get('comparisonIsSelected', false),
          filterSelected        : octaviParameters.get('filterSelected', "FilterOne"),
          dataSourceIds         : octaviParameters.dataSourceIds
        };


        this.onButtonClick = this.onButtonClick.bind(this);
        this.onSwitchChange = this.onSwitchChange.bind(this)
        this.updateDataSourceIds = this.updateDataSourceIds.bind(this);

    }

    componentDidMount() {
        serviceLocator.eventManager.on('taxi.dataSources.loaded', this.updateDataSourceIds);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('taxi.dataSources.loaded', this.updateDataSourceIds);
    }


    updateDataSourceIds() {
        this.setState({
          dataSourceIds: octaviParameters.dataSourceIds
        });
    }


    onButtonClick(name){

        this.setState({
            filterSelected  : name
        });

        octaviParameters.filterSelected  = name;
        serviceLocator.eventManager.emit('taxi.filter.filterSelection.update');
    }

    onSwitchChange() {
        let newState
        // if comparison is selected --> set comparison to off and active filter one by default
        if (this.state.comparisonIsSelected) {
            newState = {
                comparisonIsSelected    : false,
                filterSelected          : "FilterOne",
            };
        }
        // if filter was not selected turn it to on and automaticaly select driver if no object was previously selected
        else {
            newState = {
                comparisonIsSelected    : true,
                filterSelected          : this.state.filterSelected,

            };
        }

        this.setState(newState);

        octaviParameters.comparisonIsSelected = newState.comparisonIsSelected;
        serviceLocator.eventManager.emit('taxi.filter.comparisonIsSelected.update');

        octaviParameters.filterSelected   = newState.filterSelected;
        serviceLocator.eventManager.emit('taxi.filter.filterSelection.update');
    }




      render() {
        if (this.state.dataSourceIds.length === 0)
        {
          return <LoadingPage />;
        }
        return (
            <div className="tr__form-input-container">
                <div className="_margin_bottom_small _bottom_border">
                    <div className="oct_filter_section _space-between-columns _margin_bottom_small">
                        <h3 className="_left">
                            {this.props.t('octavi:filters:comparison:sectionName')}
                        </h3>
                        <Switch
                            id        = {`formFieldTaxiActivitiesComparisonFilter`}
                            onChange  = {this.onSwitchChange}
                            checked   = {this.state.comparisonIsSelected}
                            onColor   = '#609112'
                            height    = {25}
                        />
                    </div>

                    {this.state.comparisonIsSelected && <div className="oct_filter_section _space-between-columns">
                        <button
                            id        = {`formFieldComparisonFilterOneSelector`}
                            className = {this.state.filterSelected == "FilterOne" && this.state.comparisonIsSelected ? "_input _input-select-button _green" : "_input _input-select-button grey"}
                            type      = "button"
                            style     = {{display: "inline-block"}}
                            onClick   = {x => this.onButtonClick("FilterOne")}
                        >
                            {this.props.t('octavi:filters:comparison:filterOne')}
                        </button>

                        <button
                            id        = {`formFieldComparisonFilterTwoSelector`}
                            className = {this.state.filterSelected == "FilterTwo" && this.state.comparisonIsSelected? "_input _input-select-button _green" : "_input _input-select-button grey"}
                            type      = "button"
                            style     = {{display: "inline-block"}}
                            onClick   = {x => this.onButtonClick("FilterTwo")}
                        >
                            {this.props.t('octavi:filters:comparison:filterTwo')}
                        </button>
                    </div>}
                </div>
            </div>
        );
      }


}

export default withTranslation()(ComparisonPanel);
