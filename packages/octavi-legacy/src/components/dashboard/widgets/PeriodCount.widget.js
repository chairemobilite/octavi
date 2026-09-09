import React from 'react';
import moment from 'moment-timezone';
import { faSync } from '@fortawesome/free-solid-svg-icons/faSync';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { _isBlank }               from 'chaire-lib-common/lib/utils/LodashExtensions';
import { LoadingPage } from "chaire-lib-frontend/lib/components/pages";
import serviceLocator             from 'chaire-lib-common/lib/utils/ServiceLocator';
import { loadLocalStorageFromFilter, saveLocalStorageDataFromFilter, getLocalStorageKey, clearLocalStorageForFilter } from '../../../services/ui/localStorageManager'
import { OctaviFilterResult } from './OctaviComponent.widget';
import octaviParameters from '../../../services/ui/OctaviParameters';
import { getFilterIdx, buildWidgetFilter, getDatesForPeriodAggregation, exportTocsv } from '../../../services/ui/utils';

const weekDayStrByIsoWeekDay = { // from sql
  '1': 'monday',
  '2': 'tuesday',
  '3': 'wednesday',
  '4': 'thursday',
  '5': 'friday',
  '6': 'saturday',
  '7': 'sunday'
}


export default class PeriodCountWidget extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
        widgetOptions           : (octaviParameters.selectedWidgets[this.props.parentUuid] || {}).options || {},
        comparisonIsSelected    : octaviParameters.get('comparisonIsSelected', false),
        // TODO Not an array because each value is updated independently. This avoids state update race condition. But each filter's data should be in its own widget, with its own state
        value0                  : null,
        value1                  : null,
        filters                 : octaviParameters.filters
      };

    this.updateTimeRange = this.updateTimeRange.bind(this);
    this.updateComparisonSelection = this.updateComparisonSelection.bind(this);
    this.updateWidgetOptions  = this.updateWidgetOptions.bind(this);
    this.onDownloadClick = this.onDownloadClick.bind(this);
  }

  componentDidMount() {
    //connect to filter modification
    serviceLocator.eventManager.on('taxi.filter.submit', this.updateTimeRange);
    //connect widget to comparision
    serviceLocator.eventManager.on('taxi.filter.comparisonIsSelected.update', this.updateComparisonSelection);
    //connect widget to options
    serviceLocator.eventManager.on(`taxi.widget.${this.props.parentUuid}SelectOptions.update`, this.updateWidgetOptions);

    this.updateTimeRange();
  }

  componentWillUnmount() {
    serviceLocator.eventManager.off('taxi.filter.submit', this.updateTimeRange);
    serviceLocator.eventManager.off('taxi.filter.comparisonIsSelected.update', this.updateComparisonSelection);
    serviceLocator.eventManager.off(`taxi.widget.${this.props.parentUuid}SelectOptions.update`, this.updateWidgetOptions);
  }

  updateComparisonSelection () {
    this.setState({
        comparisonIsSelected: octaviParameters.comparisonIsSelected
      });
      this.updateTimeRange()
  }

  updateWidgetOptions () {
    this.setState({ widgetOptions: octaviParameters.selectedWidgets[this.props.parentUuid].options });
    this.updateTimeRange()
  }

  getDataType = () => {
    return this.props.period === 'dow'
        ? 'totalCountPerWeekday'
        : this.props.period === 'hour'
            ? 'totalCountPerHour'
            : undefined;
  }

  clearValueFilter = (filterName) => {
    const dataType = this.getDataType();
    const widgetOptions = octaviParameters.get(`selectedWidgets.${this.props.parentUuid}.options`, {});
    const filterKey     = getLocalStorageKey(this.state.filters, filterName, widgetOptions);
    clearLocalStorageForFilter(filterKey, this.props.object, dataType)
  }

  updateValueFilter(filterName) {
    const filterIdx     = getFilterIdx(this.state.filters, filterName)
    const widgetOptions = octaviParameters.get(`selectedWidgets.${this.props.parentUuid}.options`, {});
    const filterKey     = getLocalStorageKey(this.state.filters, filterName, widgetOptions)

    const dataType = this.getDataType();

    const result   = loadLocalStorageFromFilter(filterKey, this.props.object, dataType)
    // data already existing in locale storage
    if (result) {
        this.setState({ [`value${filterIdx}`]: result })
    }
    // data doesn't exist in locale storage, need to import and compute data
    else {
      const dates = getDatesForPeriodAggregation(
        this.state.filters[filterIdx]['calendarStartAt'],
        this.state.filters[filterIdx]['calendarEndAt'],
        widgetOptions.temporalOption
      )

      const startAt = dates['periodStart'].tz('utc').unix();
      const endAt = dates['periodEnd'].tz('utc').unix();


      let queryType;
      switch (this.props.period) {
          case "dow":
            queryType = "byWeekday";
            break
          case "hour":
            queryType = "byHour";
            break
      }

      serviceLocator.socketEventManager.emit(`taxi.count.${queryType}.timeRange`, {
        object              : this.props.object,
        customFilterString  : this.props.customFilterString? this.props.customFilterString : "",
        dataSourceIds       : octaviParameters.dataSourceIds,
        startAt             : startAt,
        endAt               : endAt,
        filters             : buildWidgetFilter(this.state.filters, filterName, this.props.object, widgetOptions),
        type               : this.props.type,
        widgetSpecs        : this.props.widgetSpecs
      }, function(responseStatus) {
        let result;
        if (Status.isStatusOk(responseStatus)) {
            const response = Status.unwrap(responseStatus);
            result = { status: response.status, ...response.counts };
            saveLocalStorageDataFromFilter(filterKey, this.props.object, result, dataType)
        } else {
            // error status
            result = { status: 'error' };
        }

        this.setState({ [`value${filterIdx}`]: result })
      }.bind(this))
    }
  }

  updateTimeRange() {
    const newFilters = octaviParameters.filters;

    const idxFilterOne = getFilterIdx(newFilters, 'FilterOne')
    const idxFilterTwo = getFilterIdx(newFilters, 'FilterTwo')

    //we only updqte filters if dates are not null
    if (newFilters[idxFilterOne]['calendarStartAt'] && newFilters[idxFilterOne]['calendarEndAt'])
    {
      // we start by init value to null to relaunch loading page
      this.setState({
        value0: null,
        value1: null,
        filters: newFilters
        }, function() {
            this.updateValueFilter("FilterOne")

            if (octaviParameters.comparisonIsSelected && this.state.filters[idxFilterTwo]['calendarStartAt'] && this.state.filters[idxFilterTwo]['calendarEndAt']) {
              this.updateValueFilter("FilterTwo")
            }
        }.bind(this));
    }
  }

  onDownloadClick(data) {
    exportTocsv(`${this.props.fileName}.csv`, data)
  }

  onRefreshClick = () => {
    // Make sure to reset the data in the local storage before
    this.clearValueFilter('FilterOne');
    if (octaviParameters.comparisonIsSelected) {
        this.clearValueFilter('FilterTwo');
    }

    // Reset the values to load again
    this.setState({
        value0: null,
        value1: null
    }, () => {
        this.updateTimeRange()
    });
  }

  getNumberOfActivities = (value, item) =>
    value && value.status === 'success' ? value[item] || 0 : value && value.status === 'no_data' ? 'no_data' : Number.NaN;

  render() {
    const idxFilterOne = getFilterIdx(this.state.filters, 'FilterOne')
    const idxFilterTwo = getFilterIdx(this.state.filters, 'FilterTwo')

    if (
        (_isBlank(this.state[`value${idxFilterOne}`]))
        || ((this.state.comparisonIsSelected==true) && ((_isBlank(this.state[`value${idxFilterOne}`])) || (_isBlank(this.state[`value${idxFilterTwo}`]))))
        )
    {
      return <LoadingPage />;
    }

    //periods count is used to render table and periods data is passed to csv downloader
    const periodCount = [];
    const periodData = [];

    let fileExportName;
    switch (this.props.period) {
        case "dow":
          fileExportName = "weekDay";
          break
        case "hour":
          fileExportName = "hour";
          break
    }

    if (this.state.comparisonIsSelected) {
        periodCount.push(
            <tr key="init">
                <th/>
                <td>{"P 1"}</td>
                <td className="right">{"P 2"}</td>
            </tr>
        )
        periodData.push([this.props.t(`octavi:filesExport:${fileExportName}`), 'value p 1', 'value p 2']);
    } else {
        periodData.push([this.props.t(`octavi:filesExport:${fileExportName}`), 'value']);
    }

    let iterator;
    switch (this.props.period) {
        case "dow":
            iterator = weekDayStrByIsoWeekDay;
          break
        case "hour":
            iterator = [...Array(24).keys()];
          break
    }

    let itemTextFonction;
    switch (this.props.period) {
        case "dow":
            itemTextFonction = function(_item) {
                return this.props.t(`main:dateTime:weekdays:${weekDayStrByIsoWeekDay[_item]}`)
            }.bind(this);
          break
        case "hour":
            itemTextFonction = function(_item) {
                return `${_item}:00${this.props.t("main:rangeTo")}${_item}:59`
            }.bind(this);
          break
    }


    for (const item in iterator)
    {
      periodCount.push(
        <tr key={item}>
          <th className="right" style={{paddingRight: "10px"}}>{itemTextFonction(item)}</th>
          <td><OctaviFilterResult value={this.getNumberOfActivities(this.state[`value${idxFilterOne}`], item.toString())}/></td>
          {this.state.comparisonIsSelected && <td className="right _left_border"><OctaviFilterResult value={this.getNumberOfActivities(this.state[`value${idxFilterTwo}`], item.toString())}/></td>}
        </tr>
      );
      if (this.state.comparisonIsSelected) {
        periodData.push([itemTextFonction(item), this.getNumberOfActivities(this.state[`value${idxFilterOne}`], item.toString()), this.getNumberOfActivities(this.state[`value${idxFilterTwo}`], item.toString())])
      } else {
        periodData.push([itemTextFonction(item), this.getNumberOfActivities(this.state[`value${idxFilterOne}`], item.toString())])
      }
    }

    return (
    <div className="tr__widget__container">
        <div className={"tr__widget__header"}>
            <div className={"widget_title_width"}>
                <h3>
                    {this.props.title}
                </h3>
            </div>
            <div className={"widget_button_width"}>
                <button
                    className = {"transparent"}
                    type      = "button"
                    onClick   = {() => this.onDownloadClick(periodData)}
                >
                    <img
                        className = {`_icon chart_line_white`}
                        src       = "/dist/images/icons/octavi/export_to_file_white.svg"
                        alt       = "settings"
                    />
                </button>
            </div>
            <div className={"widget_button_width"}>
                <button
                    className = {"transparent"}
                    type      = "button"
                    onClick   = {() => this.onRefreshClick()}
                >
                    <FontAwesomeIcon icon={faSync} className={'icon_white'}/>
                </button>
            </div>
        </div>
    <table style={{"borderSpacing": 0, width: "100%"}}>
        <tbody>
          {periodCount}
        </tbody>
      </table>
      {!_isBlank(this.props.subtitle) && <p className="tr__widget__big-value-subtitle">{this.props.subtitle}</p>}
    </div>
    );
  }

}
