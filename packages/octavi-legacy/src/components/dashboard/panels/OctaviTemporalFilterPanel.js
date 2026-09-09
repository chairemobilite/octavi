import React from 'react';
import { withTranslation } from 'react-i18next';
import Switch               from 'react-switch';
import { cloneDeep }        from 'lodash';

import serviceLocator        from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import { _isBlank }          from 'chaire-lib-common/lib/utils/LodashExtensions';
import { getFilterIdx }      from '../../../services/ui/utils'

// import Button from 'transition-frontend/src/components/input/Button'
import InputMultiselect from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import octaviParameters      from '../../../services/ui/OctaviParameters';

import { isNull } from 'lodash';

class TemporalFilterPanel extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
          filterSelected: octaviParameters.get('filterSelected', "FilterOne"),
          filters: octaviParameters.filters,
          dataSourceIds: octaviParameters.dataSourceIds
        };

        this.hourChoices = [
            { value: "0_6"  },
            { value: "6_9"  },
            { value: "9_15" },
            { value: "15_18"},
            { value: "18_24"},
            { value: "other"}
        ]

        this.dayChoices = [
            { value: "monday"         },
            { value: "tuesday"        },
            { value: "wednesday"      },
            { value: "thursday"       },
            { value: "friday"         },
            { value: "saturday"       },
            { value: "sunday"         },
            { value: "business_day"   },
            { value: "non_working_day"},
            { value: "weekend"        }
        ]


        this.updateFilter = this.updateFilter.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
        this.onSwitchChange = this.onSwitchChange.bind(this)
        this.updateDataSourceIds = this.updateDataSourceIds.bind(this);
        this.updateFilterSelection = this.updateFilterSelection.bind(this);
        this.onValueChange = this.onValueChange.bind(this);;
        this.onCustomHourChange = this.onCustomHourChange.bind(this);
        this.onCustomHourDeleteButtonClick = this.onCustomHourDeleteButtonClick.bind(this);
        this.onCustomHourAddButtonClick = this.onCustomHourAddButtonClick.bind(this);

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
        // name is name of the clicked button must be "hourIsSelected", "dayIsSelected"
        const newFilters = cloneDeep(this.state.filters)
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)
        const generalSwitchState = this.state.filters[filterIdx].temporalFilterIsSelected

        // if switch is on off we set switch to on and only set clicked button to on
        if (!generalSwitchState){
            newFilters[filterIdx]['hourIsSelected'] = name == "hourIsSelected" ? true : false;
            newFilters[filterIdx]['dayIsSelected'] = name == "dayIsSelected" ? true : false;
            newFilters[filterIdx]['temporalFilterIsSelected'] = true

        } else {
            // by default we change button  state
            if (name === 'hourIsSelected') {
                newFilters[filterIdx]['hourIsSelected'] = !newFilters[filterIdx]['hourIsSelected']
            } else if (name === 'dayIsSelected') {
                newFilters[filterIdx]['dayIsSelected'] = !newFilters[filterIdx]['dayIsSelected']
            }

            // if all filters are on off we also set switch to off
            if (!newFilters[filterIdx]['hourIsSelected'] && !newFilters[filterIdx]['dayIsSelected']){
                newFilters[filterIdx]['temporalFilterIsSelected'] = false;
            }
        }
        //update filter values
        this.setState({filters: newFilters});

        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update');
    }


    onSwitchChange() {
        const newFilters = cloneDeep(this.state.filters)
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)
        const previousGeneralSwitchState = this.state.filters[filterIdx].temporalFilterIsSelected

        newFilters[filterIdx]['temporalFilterIsSelected'] = !previousGeneralSwitchState

        //if we set switch to one, we make sure to have a list one filter to one
        if (newFilters[filterIdx]['temporalFilterIsSelected']) {

            // if no filter
            if (!newFilters[filterIdx]['dayIsSelected'] && !newFilters[filterIdx]['hourIsSelected']){
                newFilters[filterIdx]['dayIsSelected']        = true;
                newFilters[filterIdx]['hourIsSelected']   = false;
            }
        }
        //update filter values
        this.setState({filters: newFilters});

        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update');
    }


    onValueChange(selectedObjectName, value, pairedButtonName) {
        const newFilters = cloneDeep(this.state.filters)
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)

        let needToUpatePairedButton = false
        // if unselecting all values set filter to off
        if ((isNull(value)) || (value.length==0)){
            if (this.state.filters[filterIdx][pairedButtonName]) {
                needToUpatePairedButton = true
            }
        }
        //compare with old state to see if adding or deleting
        else if (value.length !== (_isBlank(this.state.filters[filterIdx][selectedObjectName]) ? 0: this.state.filters[filterIdx][selectedObjectName].length)) {
            //if filter is not selected and we add a value --> we select the filter$
            if (!this.state.filters[filterIdx][pairedButtonName] || !this.state.filters[filterIdx][`temporalFilterIsSelected`]) {
                needToUpatePairedButton = true
            }
        }

        // order the value list from choice list order
        if (value) {
            const choices       = selectedObjectName.includes('hour') ? this.hourChoices : this.dayChoices
            const choicesValues = choices.map( x => x.value )
            const idxs = value.map( x => choicesValues.indexOf(x) ).sort()
            value = idxs.map( x => choicesValues[x] )
        } else {
            value = []
        }

        newFilters[filterIdx][selectedObjectName] = value;

        //add or delete custom value when selecting or unslecting other in hour filter
        if (selectedObjectName.includes('hour') && value.includes('other') ) {
            //case when selecting other --> we inti custom filters
            if (value.includes('other') && (_isBlank(this.state.filters[filterIdx][selectedObjectName]) || !this.state.filters[filterIdx][selectedObjectName].includes('other'))) {
                newFilters[filterIdx][`hourCustomChoices`] = ["0_24"]
            }
            // case when deleting options
            else if (!value.includes('other') && !_isBlank(this.state.filters[filterIdx][selectedObjectName]) && this.state.filters[filterIdx][selectedObjectName].includes('other')) {
                newFilters[filterIdx][`hourCustomChoices`] = null
            }
        }

        this.setState({filters: newFilters}, function() {
            if (needToUpatePairedButton) {
                this.onButtonClick(pairedButtonName);
            }
        });

        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update');
    }

    onCustomHourChange(e, hourType, idx) {
        const newFilters = cloneDeep(this.state.filters)
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)

        const newCustomHour = newFilters[filterIdx][`hourCustomChoices`]
        const oldValue = newCustomHour[idx]
        if (hourType === "start") {
            //verification of hour validity
            if (0 <= e.target.value && e.target.value <= Math.min(parseInt(oldValue.split("_")[1]), 24)) {
                newCustomHour[idx] = `${e.target.value}_${oldValue.split("_")[1]}`
            }
        } else if (hourType === "end") {
            if (Math.max(parseInt(oldValue.split("_")[0]), 0) <= e.target.value && e.target.value <= 24) {
                newCustomHour[idx] = `${oldValue.split("_")[0]}_${e.target.value}`
            }
        }

        newFilters[filterIdx][`hourCustomChoices`] = newCustomHour
        this.setState({filters: newFilters});

        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update');
    }

    onCustomHourDeleteButtonClick(idx) {
        const newFilters = cloneDeep(this.state.filters)
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)

        const newCustomHour = newFilters[filterIdx][`hourCustomChoices`]
        newCustomHour.splice(idx, 1)

        newFilters[filterIdx][`hourCustomChoices`] = newCustomHour
        this.setState({filters: newFilters});

        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update');
    }

    onCustomHourAddButtonClick() {
        const newFilters = cloneDeep(this.state.filters)
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)

        const newCustomHour = !isNull(newFilters[filterIdx][`hourCustomChoices`]) ? newFilters[filterIdx][`hourCustomChoices`] : []
        newCustomHour.push("0_24")

        newFilters[filterIdx][`hourCustomChoices`] = newCustomHour
        this.setState({filters: newFilters});

        octaviParameters.filters = newFilters
        serviceLocator.eventManager.emit('taxi.filter.data.update');
    }


    render() {
        //temporal filters component construction
        const temporalFiltersInput = [];
        const filterIdx = getFilterIdx(this.state.filters, this.state.filterSelected)

        if (this.state.filters.length !== 0) {


            // hour filter construction
            temporalFiltersInput.push(
                <div className="oct_filter_section _space-between-columns" key={"temporalFilterHour"}>
                    <button
                        id        = {`formFieldTaxiActivitiesSelectTemporalFilterHour`}
                        className = {this.state.filters[filterIdx][`hourIsSelected`] && this.state.filters[filterIdx][`temporalFilterIsSelected`] ? "button green _three_columns" : "button grey _three_columns"}
                        type      = "button"
                        onClick   = {x => this.onButtonClick(`hourIsSelected`)}
                    >
                        {this.props.t('octavi:filters:temporal:hour')}
                    </button>
                    <div className="_two_third_column">
                        <InputMultiselect
                            style           = {{display: "inline-block"}}
                            choices         = {this.hourChoices}
                            localePrefix    = {'octavi:filters:temporal:hour_'}
                            t               = {this.props.t}
                            disabled        = {false}
                            id              = {`formFieldTaxiActivitiesSelectTemporalFilterHourChoices`}
                            value           = {this.state.filters[filterIdx][`hourChoices`]? this.state.filters[filterIdx][`hourChoices`]: []}
                            onValueChange   = {(e) => this.onValueChange(`hourChoices`, e.target.value, `hourIsSelected`)}
                            customStyles    = {this.state.filters[filterIdx][`hourIsSelected`] && this.state.filters[filterIdx][`temporalFilterIsSelected`] ?{
                                                    multiValue: (base, _state) => ({
                                                        ...base,
                                                        backgroundColor:'rgba(70, 128, 36,0.5)'
                                                    })
                                                }: null}
                        />
                    </div>
                </div>
            )

            //custom hour filter
            if ((this.state.filters[filterIdx][`hourChoices`]? this.state.filters[filterIdx][`hourChoices`]: []).includes('other')) {
                for (let idx in this.state.filters[filterIdx][`hourCustomChoices`]) {
                    const customFilter = this.state.filters[filterIdx][`hourCustomChoices`][idx]
                    temporalFiltersInput.push(
                        <div className="oct_filter_section _space-between-columns" key={`temporalCustomFilterHour_${idx}`}>
                            <div className=' _three_columns'>
                                {`${this.props.t('octavi:filters:temporal:customHours:name')} ${parseInt(idx) + 1}`}
                            </div>
                            <div className="_two_third_column same_line">
                                <div className="_three_columns">
                                    <InputString
                                        value           = {customFilter.split("_")[0]}
                                        type            = {'number'}
                                        onValueChange   = {(e) => this.onCustomHourChange(e, "start", idx)}
                                    />
                                </div>
                                <div className="center">
                                {this.props.t("main:rangeTo")}
                                </div>
                                <div className="_three_columns">
                                    <InputString
                                        value           = {customFilter.split("_")[1]}
                                        type            = {'number'}
                                        onValueChange   = {(e) => this.onCustomHourChange(e, "end", idx)}
                                    />
                                </div>
                                <button
                                    type      = "button"
                                    className = "option_delete_button"
                                    onClick   = {() => this.onCustomHourDeleteButtonClick(idx)}
                                    disabled  = {this.state.filters[filterIdx][`hourCustomChoices`].length <= 1}
                                >
                                    <img
                                        src       = "/dist/images/icons/octavi/close_white.svg"
                                        alt       = "delete"
                                        style     = {{width: "90%"}}
                                    />
                                </button>
                            </div>
                        </div>
                    )
                }
                temporalFiltersInput.push(
                    <button
                        className = "_two_third_column _input _input-select-button _bottom_padding"
                        key       = "addCustomFilter"
                        style     = {{display: "inline-block"}}
                        type      = "button"
                        onClick   = {this.onCustomHourAddButtonClick}
                    >
                        {this.props.t('octavi:filters:temporal:customHours:addButton')}
                    </button>
                )


            }

            //day filter construction
            temporalFiltersInput.push(
                <div className="oct_filter_section _space-between-columns" key={"temporalFilterDay"}>
                    <button
                        id        = {`formFieldTaxiActivitiesSelectTemporalFilterDay`}
                        className = {this.state.filters[filterIdx][`dayIsSelected`] && this.state.filters[filterIdx][`temporalFilterIsSelected`]? "button green _three_columns" : "button grey _three_columns"}
                        type      = "button"
                        onClick   = {x => this.onButtonClick(`dayIsSelected`)}
                    >
                        {this.props.t('octavi:filters:temporal:day')}
                    </button>
                    <div className="_two_third_column">
                        <InputMultiselect
                            style           = {{display: "inline-block"}}
                            choices         = {this.dayChoices}
                            localePrefix    = {'octavi:filters:temporal:day_'}
                            t               = {this.props.t}
                            disabled        = {false}
                            id              = {`formFieldTaxiActivitiesSelectTemporalFilterDayChoices`}
                            value           = {this.state.filters[filterIdx][`dayChoices`]? this.state.filters[filterIdx][`dayChoices`]: []}
                            onValueChange   = {(e) => this.onValueChange(`dayChoices`, e.target.value, `dayIsSelected`)}
                            customStyles    = {this.state.filters[filterIdx][`dayIsSelected`] && this.state.filters[filterIdx][`temporalFilterIsSelected`] ?{
                                multiValue: (base, _state) => ({
                                    ...base,
                                    backgroundColor:'rgba(70, 128, 36,0.5)'
                                })
                            }: null}
                        />
                    </div>
                </div>
            )
        }



        if (this.state.dataSourceIds.length === 0 || this.state.filters.length === 0)
        {
          return <LoadingPage />;
        }
        return (
            <div className="tr__form-input-container _margin_bottom_small">
                <div className="_margin_bottom_small _bottom_border">
                    <div className="oct_filter_section _space-between-columns _margin_bottom_small">
                        <h3 className="_left">
                            {this.props.t('octavi:filters:temporal:sectionName')}
                        </h3>
                        <Switch
                            id        = {`formFieldTaxiActivitiesSelectTemporalFilter`}
                            onChange  = {this.onSwitchChange}
                            checked   = {this.state.filters[filterIdx][`temporalFilterIsSelected`]}
                            onColor   = '#609112'
                            height    = {25}
                        />
                    </div>
                </div>
                {temporalFiltersInput}
            </div>
        );
      }


}

export default withTranslation()(TemporalFilterPanel);
