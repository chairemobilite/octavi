import { _isBlank }     from 'chaire-lib-common/lib/utils/LodashExtensions';
import config           from 'chaire-lib-common/lib/config/shared/project.config';
import moment           from 'moment-timezone';

import { getFilterIdx } from './utils';


const loadLocalStorageFromFilter = function(filterKey, object, dataType) {
    const octaviComputedDataString = window.localStorage.getItem("octaviComputedData")
    if (octaviComputedDataString) {
        const octaviComputedDataObject = JSON.parse(octaviComputedDataString)
        const result = octaviComputedDataObject[object] ? octaviComputedDataObject[object][filterKey] : null;
        return result ? result['data'][dataType] : null
    } else {
        return null
    }
}

const clearLocalStorageForFilter = (filterKey, object, dataType) => {
    const octaviComputedDataString = window.localStorage.getItem("octaviComputedData")
    if (octaviComputedDataString) {
        const octaviComputedDataObject = JSON.parse(octaviComputedDataString)
        const result = octaviComputedDataObject[object] ? octaviComputedDataObject[object][filterKey] : null;
        if (result && result['data'] && result['data'][dataType]) {
            delete result['data'][dataType];
        }
        window.localStorage.setItem("octaviComputedData", JSON.stringify(octaviComputedDataObject))
    } else {
        return null
    }
}

const saveLocalStorageDataFromFilter = function(filterKey, object, result, dataType) {
    const octaviComputedDataString = window.localStorage.getItem("octaviComputedData")
    const octaviComputedDataObject = octaviComputedDataString ? JSON.parse(octaviComputedDataString) : initDict()
    if (octaviComputedDataObject[object][filterKey] == undefined) {
        octaviComputedDataObject[object][filterKey] = {}
        octaviComputedDataObject[object][filterKey]['data'] = {}
    }
    const data = octaviComputedDataObject[object][filterKey]['data']
    data[dataType] = result

    const size_kB    = Math.round( 100 *(JSON.stringify(data).length * 2 / 1024))/ 100
    const timestamp = (new Date()).getTime()
    octaviComputedDataObject[object][filterKey] = { timestamp, size_kB, data }

    if (size_kB < 4500) {
        window.localStorage.setItem("octaviComputedData", JSON.stringify(octaviComputedDataObject))
    }
}

/**
 * @params filters list of all filters
 * @params filterName name of filter to value for
 * @params options of widget to get value for
 *
 * @returns filter local storage key
 */
const getLocalStorageKey = function(filters, filterName, widgetOptions = {}) {

    const filterIdx = getFilterIdx(filters, filterName)
    const ls_filterDict = {}

    ls_filterDict['calendarStartAt'] = filters[filterIdx]['calendarStartAt']
    ls_filterDict['calendarEndAt']   = filters[filterIdx]['calendarEndAt']

    //temporal key
    if (filters[filterIdx]['temporalFilterIsSelected']) {
      ["day", "hour"].forEach(parameter => {
        if (filters[filterIdx][parameter + 'IsSelected']) {
          ls_filterDict[parameter + 'Choices'] = filters[filterIdx][parameter + 'Choices']
          //we add custom hours if needed:
          if (parameter === "hour" && ls_filterDict[parameter + 'Choices'] && ls_filterDict[parameter + 'Choices'].includes('other')) {
            ls_filterDict['hourCustomChoices'] = filters[filterIdx]['hourCustomChoices']
          }
        }
      })
    }
    //spatioal key
    if (filters[filterIdx]['spatialFilterIsSelected']) {
      ["origin", "destination"].forEach(parameter => {
        if (filters[filterIdx][parameter + 'IsSelected']) {
          const Parameter = parameter.charAt(0).toUpperCase() + parameter.slice(1)
          ls_filterDict['selected' + Parameter + 'Districts'] = filters[filterIdx]['selected' + Parameter + 'Districts']
        }
      })
    }
    //widget option key
    for (const option in widgetOptions) {
        if (!_isBlank(widgetOptions[option]) && widgetOptions[option] !== "none") {
            ls_filterDict['widgetOption' + option] = widgetOptions[option];
        }
        //If we have a temporal option with a date periode, we modify start end end dates for the statr and end of the period
        if (widgetOptions.temporalOption && !_isBlank(widgetOptions.temporalOption) && widgetOptions.temporalOption !== "none" && widgetOptions.temporalOption !== "byDay") {
            let startAt;
            let endAt;
            if (widgetOptions.temporalOption === "byWeek" || widgetOptions.temporalOption === "byMonth")  {
                startAt = moment.tz(`${ls_filterDict['calendarStartAt']} 00:00:00`, config.timezone).clone();
                endAt = moment.tz(`${ls_filterDict['calendarEndAt']} 23:59:59`, config.timezone).clone();
                if (widgetOptions.temporalOption === "byWeek") {
                    startAt.isoWeekday(1);
                    if (endAt.isoWeekday() !== 7) {
                        endAt.isoWeekday(7);
                    }
                  } else if (widgetOptions.temporalOption === "byMonth") {
                    startAt.startOf('month');
                    endAt.endOf('month');
                  }
              }
              ls_filterDict['calendarStartAt'] = moment(startAt).format("YYYY-MM-DD")
              ls_filterDict['calendarEndAt'] = moment(endAt).format("YYYY-MM-DD");
        }
    }
    return JSON.stringify(ls_filterDict)
  }


const initDict = function() {
    return {
        "activities"    : {},
        "trips"         : {},
        "vehicles"      : {},
        "driver"        : {},
        "operators"     : {},
        "distance"      : {},
        "duration"      : {}
    }
}

export {
    loadLocalStorageFromFilter,
    saveLocalStorageDataFromFilter,
    getLocalStorageKey,
    clearLocalStorageForFilter
    // removeGraphOptionsFromExpiration
}
