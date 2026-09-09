import React from 'react';
import { withTranslation } from 'react-i18next';

import serviceLocator        from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank }          from 'chaire-lib-common/lib/utils/LodashExtensions';
import octaviParameters      from '../../../services/ui/OctaviParameters';
import { exportFilter }     from '../../../services/ui/utils'

class FilterExtract extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            comparisonIsSelected  : octaviParameters.get('comparisonIsSelected', false),
            filters               : octaviParameters.filters
        };


        this.updateComparisonSelection = this.updateComparisonSelection.bind(this);
        this.updateFilters = this.updateFilters.bind(this);
        this.onDownloadClick = this.onDownloadClick.bind(this)

    }

    componentDidMount() {
        serviceLocator.eventManager.on('taxi.filter.comparisonIsSelected.update', this.updateComparisonSelection);
        serviceLocator.eventManager.on('taxi.filter.submit', this.updateFilters);

    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('taxi.filter.comparisonIsSelected.update', this.updateComparisonSelection);
        serviceLocator.eventManager.off('taxi.filter.submit', this.updateFilters);
    }


    updateComparisonSelection () {
        this.setState({ comparisonIsSelected: octaviParameters.comparisonIsSelected });
      }

    updateFilters() {
        const newFilters = octaviParameters.filters;
        this.setState({
            filters: newFilters
        });
    }

    onDownloadClick() {
        exportFilter(
            this.state.filters,
            this.state.comparisonIsSelected ? [0,1] : [0],
            this.props.t
        )
    }



      render() {

        return (
            <div className='filter-overlay-download'>
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
        );
      }


}

export default withTranslation()(FilterExtract);
