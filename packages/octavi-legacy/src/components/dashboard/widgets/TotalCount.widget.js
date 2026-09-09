import React from 'react';
import { withTranslation } from 'react-i18next';
import Collapsible from 'react-collapsible';
import { camelCase } from 'lodash'
import { faSync } from '@fortawesome/free-solid-svg-icons/faSync';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import moment from 'moment-timezone';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { _isBlank }     from 'chaire-lib-common/lib/utils/LodashExtensions';
import { LoadingPage } from "chaire-lib-frontend/lib/components/pages";
import serviceLocator   from 'chaire-lib-common/lib/utils/ServiceLocator';


import { getFilterIdx, buildWidgetFilter, getDatesForPeriodAggregation }    from '../../../services/ui/utils'
import octaviParameters from '../../../services/ui/OctaviParameters';

import Chart                from "../../graph/Chart";
import columnChartOptions   from "../../graph/columnChartOptions";
import distributionChartOptions   from "../../graph/distributionChartOptions";
import { loadLocalStorageFromFilter, saveLocalStorageDataFromFilter, getLocalStorageKey, clearLocalStorageForFilter } from '../../../services/ui/localStorageManager';
import PeriodCountWidget from './PeriodCount.widget';
import WidgetOptionsSelector from './WidgetOptionsSelector';
import { OctaviFilterResult } from './OctaviComponent.widget';

class TotalCountWidget extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      detailOpen            : false,
      widgetChartIsActive   : octaviParameters.get(`${this.props.uuid}widgetChartIsActive`, false),
      widgetOptions         : (octaviParameters.selectedWidgets[this.props.uuid] || {}).options || {},
      comparisonIsSelected  : octaviParameters.get('comparisonIsSelected', false),
      // TODO Not an array because each value is updated independently. This avoids state update race condition. But each filter's data should be in its own widget, with its own state
      value0                : null,
      value1                : null,
      filters               : octaviParameters.filters
    };

    this.onChartButtonClick         = this.onChartButtonClick.bind(this);
    this.onSettingsButtonClick      = this.onSettingsButtonClick.bind(this);
    this.onDeleteButtonClick        = this.onDeleteButtonClick.bind(this);
    this.updateTimeRange            = this.updateTimeRange.bind(this);
    this.updateComparisonSelection  = this.updateComparisonSelection.bind(this);
    this.updateWidgetOptions        = this.updateWidgetOptions.bind(this);
    this.getWidgetTitleType         = this.getWidgetTitleType.bind(this);
    this.onDetailOpening            = this.onDetailOpening.bind(this);
    this.onDetailClose              = this.onDetailClose.bind(this)
  }

  componentDidMount() {
    //connect to filter modification
    serviceLocator.eventManager.on('taxi.filter.submit', this.updateTimeRange);
    //connect to widget status modification
    serviceLocator.eventManager.on(`taxi.widget.${this.props.uuid}widgetChartStatus.update`, this.updateTimeRange);
    //connect widget to comparision
    serviceLocator.eventManager.on('taxi.filter.comparisonIsSelected.update', this.updateComparisonSelection);
    //connect widget to options
    serviceLocator.eventManager.on(`taxi.widget.${this.props.uuid}SelectOptions.update`, this.updateWidgetOptions);
    this.updateTimeRange();
  }

  componentWillUnmount() {
    serviceLocator.eventManager.off('taxi.filter.submit', this.updateTimeRange);
    serviceLocator.eventManager.off(`taxi.widget.${this.props.uuid}widgetChartStatus.update`, this.updateTimeRange);
    serviceLocator.eventManager.off('taxi.filter.comparisonIsSelected.update', this.updateComparisonSelection);
    serviceLocator.eventManager.off(`taxi.widget.${this.props.uuid}SelectOptions.update`, this.updateWidgetOptions);
  }


  onChartButtonClick(){
    const oldState = this.state.widgetChartIsActive

    this.setState({
        widgetChartIsActive : !oldState,
        value0: null,
        value1: null
    });
    octaviParameters[`${this.props.uuid}widgetChartIsActive`] = !oldState;
    serviceLocator.eventManager.emit(`taxi.widget.${this.props.uuid}widgetChartStatus.update`);
  }

  onSettingsButtonClick(){
    serviceLocator.eventManager.emit(`taxi.widget.${this.props.uuid}ManageOptions.request`);
  }

  onDeleteButtonClick(){
    serviceLocator.eventManager.emit('taxi.filter.selectedWidgets.delete', this.props.uuid)
  }

  updateComparisonSelection () {
    this.setState({ comparisonIsSelected: octaviParameters.comparisonIsSelected });
    this.updateTimeRange()
  }

  updateWidgetOptions () {
    this.setState({ widgetOptions: octaviParameters.get(`selectedWidgets.${this.props.uuid}.options`, {}) });
    this.updateTimeRange()
  }

  updateValueFilter(graphState, requestOption, filterName) {
    const filterIdx     = getFilterIdx(this.state.filters, filterName)
    const widgetOptions = octaviParameters.get(`selectedWidgets.${this.props.uuid}.options`, {})
    const filterKey     = getLocalStorageKey(this.state.filters, filterName, widgetOptions)

    const dataType = graphState ? "totalCountGraph" : "totalCount"
    const Action = this.props.object.charAt(0).toUpperCase() + this.props.object.slice(1) + dataType.charAt(0).toUpperCase() + dataType.slice(1)

    // Load data from locale storage
    const progressString = this.props.t(`notifications:OctaviLoading${Action}`,  { n: filterName === 'FilterOne' ? 1 : 2 })
    serviceLocator.eventManager.emit('progress', {name: progressString, progress: 0})
    const result   = loadLocalStorageFromFilter(filterKey, this.props.object, dataType)

    // data already existing in locale storage
    if (result) {
      this.setState({ [`value${filterIdx}`]: result });
      serviceLocator.eventManager.emit('progress', {name: progressString, progress: 1})
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

      serviceLocator.socketEventManager.emit(`taxi.totalCount.${requestOption}timeRange`, {
          object             : this.props.object,
          customFilterString : this.props.customFilterString? this.props.customFilterString : "",
          dataSourceIds      : octaviParameters.dataSourceIds,
          startAt            : startAt,
          endAt              : endAt,
          filters            : buildWidgetFilter(this.state.filters, filterName, this.props.object, widgetOptions),
          type               : this.props.type,
          widgetSpecs        : this.props.widgetSpecs
      }, function(responseStatus) {
          let requestResult
          if (Status.isStatusOk(responseStatus)) {
            const response = Status.unwrap(responseStatus);
            requestResult = graphState ? response : response.status === 'no_data' ? 'no_data' : response.count;
            saveLocalStorageDataFromFilter(filterKey, this.props.object, requestResult, dataType)
          } else {
            // error status, set NaN for count
            requestResult = graphState ? { status: 'error' } : Number.NaN;
          }

          this.setState({ [`value${filterIdx}`]: requestResult })

          serviceLocator.eventManager.emit('progress', {name: progressString, progress: 1})
      }.bind(this))
    }
  }

  updateTimeRange() {
    // this is needed because when updateTimeRange for the first time, octaviParameters.activeDriverCountWidgetChart is not defined yet
    // and when pushing button state is not up to date
    const graphState = octaviParameters[`${this.props.uuid}widgetChartIsActive`] !== undefined ? octaviParameters[`${this.props.uuid}widgetChartIsActive`]: this.state.widgetChartIsActive;
    let  requestOption = ""
    if (graphState) {
        const latesOptions = octaviParameters.get(`selectedWidgets.${this.props.uuid}.options`, {});
        if (latesOptions.graphOption && latesOptions.graphOption === "objectDistribution") {
            requestOption = "byObject."
        } else if (latesOptions.graphOption && latesOptions.graphOption === "spatialDistribution") {
            requestOption = "byZone."
        } else {
            requestOption = "byPeriod."
        }
    }

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
            this.updateValueFilter(graphState, requestOption, "FilterOne")

            if (octaviParameters.comparisonIsSelected && this.state.filters[idxFilterTwo]['calendarStartAt'] && this.state.filters[idxFilterTwo]['calendarEndAt']) {
              this.updateValueFilter(graphState, requestOption, "FilterTwo")
            }
        }.bind(this));
    }
  }

  getWidgetTitleType() {
    if (
        (this.state.widgetOptions.objectOption && !_isBlank(this.state.widgetOptions.objectOption) && this.state.widgetOptions.objectOption !== "none")
        || (this.state.widgetOptions.temporalOption && !_isBlank(this.state.widgetOptions.temporalOption) && this.state.widgetOptions.temporalOption !== "none")
     ) {
        return "mean";
    } else {
        return "count";
    }
  }

  addOptionsTitle(title, isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull, isStatusOptionNull) {
    if ( isObjectOptionNotNull ) {
        title += " " + this.props.t(`octavi:widgetOptions:objectOption:${this.state.widgetOptions.objectOption}`).toLowerCase()
    }
    if ( isGeographicalOptionNotNull ) {
        title += " " + this.props.t(`octavi:widgetOptions:geographicalOption:${this.state.widgetOptions.geographicalOption}`).toLowerCase()
        title += " (" + this.props.t(`octavi:widgetOptions:onLocationOption:${this.state.widgetOptions.onLocationOption}`).toLowerCase() + ")"
    }
    if ( isStatusOptionNull && (this.props.object !== 'trips')) {
        if (this.state.widgetOptions.statusOption === 'occupied') {
            // Special option title for trips instead of status 'occupied'
            title += " " + this.props.t(`octavi:widgetOptions:statusOption:trips`);
         } else {
            title += " " + this.props.t(`octavi:widgetOptions:statusOption:titleFirstPart`) + " " + this.props.t(`octavi:widgetOptions:statusOption:${this.state.widgetOptions.statusOption}`).toLowerCase();
        }
    }
    if ( isTemporalOptionNotNull ) {
        title += " " + this.props.t(`octavi:widgetOptions:temporalOption:${this.state.widgetOptions.temporalOption}`).toLowerCase();
    }
    return title
  }

  addOptionFileName(fileName, isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull, isStatusOptionNull) {
    if ( isObjectOptionNotNull ) {
        fileName += " " + this.props.t(`octavi:widgetOptions:objectOption:${this.state.widgetOptions.objectOption}`)
    }
    if ( isGeographicalOptionNotNull ) {
        fileName += " " + this.props.t(`octavi:widgetOptions:geographicalOption:file:${this.state.widgetOptions.geographicalOption}`)
        fileName += " " + this.props.t(`octavi:widgetOptions:onLocationOption:file:${this.state.widgetOptions.onLocationOption}`)
    }
    if ( isStatusOptionNull ) {
        fileName += " " + this.props.t(`octavi:widgetOptions:statusOption:${this.state.widgetOptions.statusOption}`);
    }
    if ( isTemporalOptionNotNull ) {
        fileName += " " + this.props.t(`octavi:widgetOptions:temporalOption:${this.state.widgetOptions.temporalOption}`).toLowerCase();
    }
    return fileName
  }

  addFilterFileName = (fileName, filter) => {
    const dates = getDatesForPeriodAggregation(
        filter['calendarStartAt'],
        filter['calendarEndAt'],
        this.state.widgetOptions.temporalOption
      )
    const startString = moment(dates['periodStart']).format("YYYYMMDD");
    const endString = moment(dates['periodEnd']).format("YYYYMMDD");
    fileName += '-' + startString + "_" + endString

    if (filter.temporalFilterIsSelected === true) {
        if (filter.dayIsSelected === true) {
            const daysString = (filter.dayChoices || [])
                .map(day => this.props.t(`octavi:filters:temporal:day_:${day}`).substr(0, 2))
                .join('');
            if (daysString !== '') {
                fileName += '_' + daysString;
            }
        }
        if (filter.hourIsSelected === true) {
            const hours = (filter.hourChoices || [])
                .filter(hour => hour !== 'other');
            const customHours = (filter.hourCustomChoices || []);
            hours.push(...customHours);
            if (hours.length !== 0) {
                fileName += '_' + hours.join('&');
            }
        }
    }
    if (filter.spatialFilterIsSelected === true) {
        if (filter.originIsSelected === true && (filter.selectedOriginDistricts || []).length > 0) {
            fileName += '_O' + filter.selectedOriginDistricts.length + 'zones';
        }
        if (filter.destinationIsSelected === true && (filter.selectedDestinationDistricts || []).length > 0) {
            fileName += '_D' + filter.selectedDestinationDistricts.length + 'zones';
        }
    }

    return fileName
  }

  /**
   * @params periodStringName name of periode (i.e sur la periode, sur la semaine, sur le mois....)
   * @parmas titleType (optional) type of widget (i.e. mean, chart, sum...)
   *
   *@return retunrs a list with name where elt 0 is widget name; elt 1 is graph name
   */
  getTitle(periodStringName, titleType=null) {
    //geting first part of the title
    const isObjectOptionNotNull       = !_isBlank(this.state.widgetOptions.objectOption) && this.state.widgetOptions.objectOption !== "none"
    const isTemporalOptionNotNull     = !_isBlank(this.state.widgetOptions.temporalOption) && this.state.widgetOptions.temporalOption !== "none"
    const isGeographicalOptionNotNull = !_isBlank(this.state.widgetOptions.geographicalOption) && this.state.widgetOptions.geographicalOption !== "none"
    const isStatusOptionNull          = !_isBlank(this.state.widgetOptions.statusOption) && this.state.widgetOptions.statusOption !== "none"
    const names = ['', ''];

    // title for graphs
    if (this.state.widgetChartIsActive) {
        // case of object distribution graph
        if (this.state.widgetOptions.graphOption === "objectDistribution") {
            names[0] = this.props.t(`octavi:widgets.${this.state.widgetOptions.objectOption}.distribution`)
            names[0] += " " +  this.props.t(`octavi:widgets.${this.props.labelName}.aggregator`)
            names[0] = this.addOptionsTitle(names[0], false, isTemporalOptionNotNull, isGeographicalOptionNotNull)

            names[1] = this.props.t(`octavi:widgets.${this.state.widgetOptions.objectOption}.file`)
            names[1] += " " + this.props.t(`octavie:charts:by`)
            names[1] += " " + this.props.t(`octavi:widgets.${this.props.labelName}.file`)
            names[1] = this.addOptionFileName(names[1], false, isTemporalOptionNotNull, isGeographicalOptionNotNull)

        //case of spatial distribution graph
        } else if (this.state.widgetOptions.graphOption === "spatialDistribution"){
            names[0] = this.props.t(`octavi:widgets:spatial:distribution:${this.state.widgetOptions.geographicalOption}`).toLowerCase()
            names[0] += " (" + this.props.t(`octavi:widgetOptions:onLocationOption:${this.state.widgetOptions.onLocationOption}`).toLowerCase() + ")"
            names[0] += " " +  this.props.t(`octavi:widgets.${this.props.labelName}.aggregator`)
            names[0] = this.addOptionsTitle(names[0], isObjectOptionNotNull, isTemporalOptionNotNull, false)

            names[1] = this.props.t(`octavi:widgets:spatial:file:${this.state.widgetOptions.geographicalOption}`)
            names[1] += " " + this.props.t(`octavie:charts:by`)
            names[1] += " " + this.props.t(`octavi:widgets.${this.props.labelName}.file`)
            names[1] += " " + this.props.t(`octavi:widgetOptions:onLocationOption:${this.state.widgetOptions.onLocationOption}`)
            names[1] = this.addOptionFileName(names[1], isObjectOptionNotNull, isTemporalOptionNotNull, false)


        // case of raw count or mean per day graph
        }else {
            //case of mean per day
            if ( isObjectOptionNotNull || isTemporalOptionNotNull || isGeographicalOptionNotNull) {
                names[0]  = this.props.t(`octavi:widgets.${this.props.labelName}.mean`)
                names[1]  = this.props.t(`octavi:widgets.${this.props.labelName}.fileMean`)
            //case of total per day graph
            } else {
                names[0]  = this.props.t(`octavi:widgets.${this.props.labelName}.count`)
                names[1]  = this.props.t(`octavi:widgets.${this.props.labelName}.fileCount`)
            }

            // options part
            names[0] = this.addOptionsTitle(names[0], isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull)
            names[1] = this.addOptionFileName(names[1], isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull)
        }

    // title for number
    } else {
        // first title part
        if ( (isObjectOptionNotNull || isTemporalOptionNotNull || isGeographicalOptionNotNull) || titleType === "mean" ) {
            names[0]  = this.props.t(`octavi:widgets.${this.props.labelName}.mean`)
            names[1]  = this.props.t(`octavi:widgets.${this.props.labelName}.fileMean`)
        } else {
            names[0]  = this.props.t(`octavi:widgets.${this.props.labelName}.count`)
            names[1]  = this.props.t(`octavi:widgets.${this.props.labelName}.fileCount`)
        }

        // options part
        names[0] = this.addOptionsTitle(names[0], isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull, isStatusOptionNull)
        names[1] = this.addOptionFileName(names[1], isObjectOptionNotNull, isTemporalOptionNotNull, isGeographicalOptionNotNull, isStatusOptionNull)
    }

    if (periodStringName) {
        names[0] += " " + this.props.t(`octavi:widgets:${periodStringName}`)
        names[1] += " " + this.props.t(`octavi:widgets:${periodStringName}`)
    } else {
        names[0] += " " + this.props.t(`octavi:widgets:periodString`)
    }

    //file nams are made with camel case
    names[1] = camelCase(names[1])


    //add dates info to file names
    const idxFilterOne = getFilterIdx(this.state.filters, 'FilterOne')
    const idxFilterTwo = getFilterIdx(this.state.filters, 'FilterTwo')

    if (this.state.filters[idxFilterOne]['calendarStartAt'] && this.state.filters[idxFilterOne]['calendarEndAt']) {
        names[1] = this.addFilterFileName(names[1], this.state.filters[idxFilterOne]);
    }
    if (octaviParameters.comparisonIsSelected && this.state.filters[idxFilterTwo]['calendarStartAt'] && this.state.filters[idxFilterTwo]['calendarEndAt']) {
        names[1] = this.addFilterFileName(names[1], this.state.filters[idxFilterTwo]);
    }

    return names;
  }

  onDetailOpening() {
      this.setState({
          detailOpen: true
      })
  }

  onDetailClose() {
      this.setState({
          detailOpen: false
      })
  }

  clearValueFilter = (filterName, graphState) => {
    const dataType = graphState ? "totalCountGraph" : "totalCount"
    const widgetOptions = octaviParameters.get(`selectedWidgets.${this.props.uuid}.options`, {});
    const filterKey     = getLocalStorageKey(this.state.filters, filterName, widgetOptions);
    clearLocalStorageForFilter(filterKey, this.props.object, dataType)
  }

  onRefreshClick = () => {
    const graphState = octaviParameters[`${this.props.uuid}widgetChartIsActive`] !== undefined ? octaviParameters[`${this.props.uuid}widgetChartIsActive`]: this.state.widgetChartIsActive;
    // Make sure to reset the data in the local storage before
    this.clearValueFilter('FilterOne', graphState);
    if (octaviParameters.comparisonIsSelected) {
        this.clearValueFilter('FilterTwo', graphState);
    }

    // Reset the values to load again
    this.setState({
        value0: null,
        value1: null
    }, () => {
        this.updateTimeRange()
    });
  }

  widgetContent(type) {
    const idxFilterOne = getFilterIdx(this.state.filters, 'FilterOne')
    const idxFilterTwo = getFilterIdx(this.state.filters, 'FilterTwo')

    if (type == "number") {
        return (
        <div className="oct_widget_content">
            <div className="_full-width _space-around">
                <span className="_blue tr__widget__big-value _center"><OctaviFilterResult value={this.state[`value${idxFilterOne}`]}/></span>
                {this.state.comparisonIsSelected && <span className="tr__widget__big-value _center"><OctaviFilterResult value={this.state[`value${idxFilterTwo}`]}/></span>}
            </div>
            <div className="_full-width _space-around">
                <span className="_pale _blue">{this.state.comparisonIsSelected ? this.props.t('octavi:filters:comparison:filterOne') : this.props.t(`octavi:widgets.${this.props.labelName}.object`)}</span>
                {this.state.comparisonIsSelected && <span className="_pale">{this.props.t('octavi:filters:comparison:filterTwo')}</span>}
            </div>
            {!_isBlank(this.props.subtitle) && <p className="tr__widget__big-value-subtitle">{this.props.subtitle}</p>}

            {(this.props.countPerWeekday || this.props.countPerHour) &&
                <Collapsible trigger="+" open={false} transitionTime={100} onOpening={this.onDetailOpening} onClose={this.onDetailClose}>
                    {this.props.countPerWeekday && <PeriodCountWidget
                        period              = "dow"
                        t                   = {this.props.t}
                        i18n                = {this.props.i18n}
                        object              = {this.props.object}
                        customFilterString  = {this.props.customFilterString? this.props.customFilterString : ""}
                        labelName           = {this.props.labelName}
                        title               = {this.getTitle("dowString", "mean")[0]}
                        fileName            = {this.getTitle("dowString", "mean")[1]}
                        type                = {this.props.type}
                        widgetSpecs         = {this.props.widgetSpecs}
                        parentUuid          = {this.props.uuid}
                    />}
                    {this.props.countPerHour && <PeriodCountWidget
                        period              = "hour"
                        t                   = {this.props.t}
                        i18n                = {this.props.i18n}
                        object              = {this.props.object}
                        customFilterString  = {this.props.customFilterString? this.props.customFilterString : ""}
                        labelName           = {this.props.labelName}
                        title               = {this.getTitle("hourString", "mean")[0]}
                        fileName            = {this.getTitle("hourString", "mean")[1]}
                        type                = {this.props.type}
                        widgetSpecs         = {this.props.widgetSpecs}
                        parentUuid          = {this.props.uuid}
                    />}
                </Collapsible>}
        </div>
        );


    } else if (type == "chart") {
        return (
            <div className="box" key={JSON.stringify(this.state)}>
                <Chart
                    t               = {this.props.t}
                    i18n            = {this.props.i18n}
                    size            = {"small"}
                    fileName        = {this.getTitle()[1]}
                    data            = {this.state.comparisonIsSelected ? {valueFilterOne :this.state[`value${idxFilterOne}`], valueFilterTwo :this.state[`value${idxFilterTwo}`],} : {valueFilterOne :this.state[`value${idxFilterOne}`]}}
                    name            = {`${this.props.labelName}`}
                    filter          = {buildWidgetFilter(this.state.filters, 'FilterOne', this.props.object, this.state.widgetOptions)} //
                    generateOptions = {this.state.widgetOptions.graphOption && (this.state.widgetOptions.graphOption === "objectDistribution" || this.state.widgetOptions.graphOption === "spatialDistribution")? distributionChartOptions : columnChartOptions}
                />
            </div>
        )
    }
  }

  renderWidget() {
    const idxFilterOne = getFilterIdx(this.state.filters, 'FilterOne')
    const idxFilterTwo = getFilterIdx(this.state.filters, 'FilterTwo')

    if (
        (_isBlank(this.state[`value${idxFilterOne}`])) ||
        ((this.state.comparisonIsSelected==true) && ((_isBlank(this.state[`value${idxFilterOne}`])) || (_isBlank(this.state[`value${idxFilterTwo}`]))))
        )
    {
        return (
            <LoadingPage />
        );
    }

    return (
        <React.Fragment>
            <div className="tr__widget__header">
                <div className={"widget_title_width"}>
                    <h3>
                        {this.getTitle()[0]}
                    </h3>
                </div>
                <div className={"widget_button_width"}>
                    <button
                        className = {"button grey"}
                        type      = "button"
                        onClick   = {x => this.onSettingsButtonClick()}
                    >
                        <img
                            className = {`_icon chart_line_white`}
                            src       = "/dist/images/icons/octavi/settings_white.svg"
                            alt       = "settings"
                        />
                    </button>
                </div>
                <div className={"widget_button_width"}>
                    <button
                        className = {"button grey"}
                        type      = "button"
                        onClick   = {x => this.onChartButtonClick()}
                    >
                        <img
                            className = {`_icon chart_line_white`}
                            src       = {this.state.widgetChartIsActive?`/dist/images/icons/octavi/number_white.svg`:`/dist/images/icons/octavi/chart_line_white.svg`}
                            alt       = {this.state.widgetChartIsActive?`number`:`graph`}
                        />
                    </button>
                </div>
                <div className={"widget_button_width"}>
                    <button
                        className = {"button grey"}
                        type      = "button"
                        onClick   = {() => this.onRefreshClick()}
                    >
                        <FontAwesomeIcon icon={faSync} className={'icon_white'}/>
                    </button>
                </div>
            </div>
            {this.state.widgetChartIsActive? this.widgetContent("chart"):this.widgetContent("number")}
            <WidgetOptionsSelector
                id          = {`widgetOptionManager`}
                uuid        = {this.props.uuid}
                t           = {this.props.t}
                i18n        = {this.props.i18n}
                object      = {this.props.object}
                labelName   = {this.props.labelName}
                allowStatus = {!_isBlank(this.props.widgetSpecs.allowStatus) ? this.props.widgetSpecs.allowStatus : true}
            />
        </React.Fragment>
    );
  }

  render() {

    return (
        <div className={`tr__widget__container _position_relative ${this.state.detailOpen? "_big_height" : ""}`}>
            <button
                type      = "button"
                className ="widget_delete_button"
                onClick   = {x => this.onDeleteButtonClick()}
            >
                <img
                    src       = "/dist/images/icons/octavi/close_white.svg"
                    alt       = "delete"
                    style     = {{width: "90%"}}
                />
            </button>
            {this.renderWidget()}
        </div>
    );
  }

}

export default withTranslation()(TotalCountWidget);
