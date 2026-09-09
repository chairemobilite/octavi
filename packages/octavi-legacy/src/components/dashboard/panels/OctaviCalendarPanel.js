import React from 'react';
import { withTranslation } from 'react-i18next';

import Calendar              from 'chaire-lib-frontend/lib/components/input/Calendar';
import moment                from 'moment';
import serviceLocator        from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import { _isBlank }          from 'chaire-lib-common/lib/utils/LodashExtensions';
import { getFilterIdx }      from '../../../services/ui/utils'
import octaviParameters      from '../../../services/ui/OctaviParameters';

 class CalendarPanel extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      filterSelected: octaviParameters.get('filterSelected', "FilterOne"),
      filters: octaviParameters.filters,
      dataSourceIds: octaviParameters.dataSourceIds
    };

    this.onValidityPeriodChange  = this.onValidityPeriodChange.bind(this);
    this.updateDataSourceIds     = this.updateDataSourceIds.bind(this);
    this.updateFilterSelection   = this.updateFilterSelection.bind(this);
    this.updateFilter            = this.updateFilter.bind(this);

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

  onValidityPeriodChange(startTime, endTime, filterName) {
    const filterIdx = getFilterIdx(this.state.filters, filterName)

    const start = moment(startTime).format("YYYY-MM-DD");
    const newFilters = [... this.state.filters];
    newFilters[filterIdx]['calendarStartAt'] = start;

    if (endTime) {
      const end = moment(endTime).format("YYYY-MM-DD");
      newFilters[filterIdx]['calendarEndAt'] = end;
    }
    this.setState({filters: newFilters});

    octaviParameters.filters = newFilters;
    serviceLocator.eventManager.emit('taxi.filter.data.update');
  }

  render() {
    const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)
    if (this.state.dataSourceIds.length === 0 || this.state.filters.length === 0)
    {
      return <LoadingPage />;
    }
    return (
        <div className="tr__form-input-container">
            <Calendar
                id            = {`formFieldTaxiActivitesEditStartAndEndDate`}
                onChange      = {(start, end) => this.onValidityPeriodChange(start, end, this.state.filterSelected)}
                dateFormat    = "YYYY-MM-DD"
                startDate     = {this.state.filters[filterIdx]['calendarStartAt']}
                endDate       = {this.state.filters[filterIdx]['calendarEndAt']}
                language      = {this.props.i18n.language}
            />
        </div>
    );
  }
}

export default withTranslation()(CalendarPanel);
