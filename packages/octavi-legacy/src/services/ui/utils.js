import { _isBlank } from "chaire-lib-common/lib/utils/LodashExtensions";
import { groupBy } from "lodash";
import { union } from '@turf/turf';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import moment from 'moment-timezone';



const featureAggregator = function (aggregationProps, featureSet) {
    const aggArray     = groupBy(featureSet.features, item => item.properties.data[aggregationProps.aggregator])
    const features     = Object.keys(aggArray).map( (key, idx) => {
        const items = aggArray[key]
        // we order SR by desc size to make union easier to calculate
        items.sort((a, b) => {return _isBlank(a.geometry) || _isBlank(b.geometry) ? 1 : b.geometry.coordinates[0].length - a.geometry.coordinates[0].length})
        const geometry = items.reduce((accUnion, feature, index) => {
                if (index > 0) {
                    return union({ type: 'FeatureCollection', features: [accUnion, feature]})
                }
                return feature;
        })
        geometry['id'] = idx

        for (let prop of aggregationProps.props) {
            if (prop.type === "value") {
                geometry.properties[prop.name] = prop.parseToInt ? parseInt(items[0].properties.data[prop.name]) : items[0].properties.data[prop.name];
            }
            if (prop.type === "list") {
                geometry.properties[`${prop.name}s`]  = items.map(x => prop.parseToInt ? parseInt(x.properties.data[prop.name]) : x.properties.data[prop.name])
            }
        }
        return geometry
    });

    return {
        features    : features,
        type        : "FeatureCollection",
        level       : aggregationProps.level,
        aggregator  : aggregationProps.aggregator
    }
}
/** Export data into a csv file. This function is taken from https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
 * @params filename
 * @params rows
 *
 * @return none
 */
const exportTocsv = function (filename, rows) {

    const processRow = function (row) {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null ? '' : row[j].toString();
            if (row[j] instanceof Date) {
                innerValue = row[j].toLocaleString();
            }
            let result = innerValue.replace(/"/g, '""'); //replace "
            if (result.search(/("|,|\n)/g) >= 0) //replce , and \n
                result = '"' + result + '"';
            if (j > 0)
                finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

        let csvFile = '';
        for (let i = 0; i < rows.length; i++) {
            csvFile += processRow(rows[i]);
        }
        let blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            const link = document.createElement("a");
            if (link.download !== undefined) { // feature detection
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }

/**
 * @param filters  list of all filters
 * @param filterName name of filter to get idx for
 *
 * @return filter idx in list
 */
const getFilterIdx = function (filters, filterName) {
    return filters.findIndex((filter) => filter.name === filterName);
}

/**
 * @params filters list of all filters
 * @params filterName name of filter to filter object for
 * @params options of widget to get filter for
 *
 * @return build formated filter object for widget
 */
const buildWidgetFilter = function (filters, filterName, object, widgetOption) {
    const filterIdx = getFilterIdx(filters, filterName)
    const filter = {
        object: object,
        mode:"simple"
    };
    filter['temporal'] = {
      hours        : filters[filterIdx][`hourIsSelected`] && filters[filterIdx][`temporalFilterIsSelected`]? filters[filterIdx][`hourChoices`]: null,
      dow          : filters[filterIdx][`dayIsSelected`]  && filters[filterIdx][`temporalFilterIsSelected`]? filters[filterIdx][`dayChoices`]: null,
    }
    filter['spatial'] = {
        origin       : filters[filterIdx][`originIsSelected`] && filters[filterIdx][`spatialFilterIsSelected`]? filters[filterIdx][`selectedOriginDistricts`]: null,
        destination  : filters[filterIdx][`destinationIsSelected`]  && filters[filterIdx][`spatialFilterIsSelected`]? filters[filterIdx][`selectedDestinationDistricts`]: null,
      }
    filter['options'] = widgetOption;

    // joining custom hour filter
    if (filter['temporal']['hours'] && filter['temporal']['hours'].includes('other')){
        let newHours = [...filter['temporal']['hours']]
        const otherIdx = newHours.indexOf('other');
        newHours.splice(otherIdx, 1);
        const customHours = filters[filterIdx][`hourCustomChoices`]
        newHours = newHours.concat(customHours)
        filter['temporal']['hours'] = newHours
    }
    return filter;
  }


/**
 * This function construct a text extracting all filter info and dowloads it in txt file
 *
 * @params filters  Lsit of all filter object to extract text from
 * @params indexToExport    list of indexes of filter to exponrt in filters
 * @params t        Translation class
 */
const exportFilter = function (filters, indexToExport, t) {

    let filterText = ''

    for (let filterIdx of indexToExport) {
        const filter = filters[filterIdx]

        let hourString    = '\t\t' + t('octavi:filesExport:filters:none')
        let dowString     = '\t\t' + t('octavi:filesExport:filters:none')
        let originString  = '\t\t' + t('octavi:filesExport:filters:none')
        let destinationString = '\t\t' + t('octavi:filesExport:filters:none')

        if (filter['temporalFilterIsSelected']) {
            if (filter['hourIsSelected']) {
                const hourPrefix = 'octavi:filters:temporal:hour_'
                hourString = '\t\t' + filter['hourChoices'].map(choice => t(`${hourPrefix}:${choice}`)).join(`\n\t\t`)

                if (filter['hourChoices'].includes('other')){
                    hourString += `\n\t${t('octavi:filesExport:filters:hourCustom')}`

                    for (let hour of filter['hourCustomChoices']) {
                        hourString +=`\n\t\t${hour.split("_")[0]}h ${t('main:rangeTo')} ${hour.split("_")[1]}h`
                    }
                }

            }

            if (filter['dayIsSelected']) {
                const dayPrefix = 'octavi:filters:temporal:day_'
                dowString = '\t\t' + filter['dayChoices'].map(choice => t(`${dayPrefix}:${choice}`)).join(`\n\t\t`)
            }
        }

        if (filter['spatialFilterIsSelected']) {
            let features = (serviceLocator.collectionManager.has('zones')) ? serviceLocator.collectionManager.get('zones').features : [];
            if (filter['originIsSelected']) {
                const selectedZones = features.filter(zone => filter['selectedOriginDistricts'].includes(zone.properties.id))
                originString = '\t\t' + selectedZones.map(zone => `${zone.properties.data.SM_name} - ${zone.properties.name}`).join(`\n\t\t`)
            }
            if (filter['destinationIsSelected']) {
                const selectedZones = features.filter(zone => filter['selectedDestinationDistricts'].includes(zone.properties.id))
                destinationString = '\t\t' + selectedZones.map(zone => `${zone.properties.data.SM_name} - ${zone.properties.name}`).join(`\n\t\t`)
            }
        }



        filterText += `${t('octavi:filesExport:filters:title')} ${parseInt(filterIdx) + 1}

${t('octavi:filesExport:filters:period')}
\t${filter['calendarStartAt']} - ${filter['calendarEndAt']}

${t('octavi:filesExport:filters:temporal')}
\t${t('octavi:filesExport:filters:hour')}
${hourString}

\t${t('octavi:filesExport:filters:dow')}
${dowString}

${t('octavi:filesExport:filters:spatial')}
\t${t('octavi:filesExport:filters:origin')}
${originString}

\t${t('octavi:filesExport:filters:destination')}
${destinationString}
----------------------------------------\n`
    }

    const fileName = 'filtre_octavi.txt'
    let blob = new Blob([filterText], { type: 'text/csv;charset=utf-8;' });
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, fileName);
    } else {
        const link = document.createElement("a");
        if (link.download !== undefined) { // feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

/**Get start and end date in case of a period aggregation
 *
 * @param {*} startDate     start date as selected in filter
 * @param {*} endDate       end date as selected in filter
 * @param {*} aggregation   aggrgation type. If different from byWeek or byMonth returns startDate and endDate
 *
 * @return Returns an object with prop perdioStart and periodEnd where they are both Date type
 */
const getDatesForPeriodAggregation = function(startDate, endDate, aggregation) {
    let periodStart = moment.tz(`${startDate} 00:00:00`, config.timezone).clone();
    let periodEnd = moment.tz(`${endDate} 23:59:59`, config.timezone).clone();

    // if temporal option is selected, we modify start date for the begining / end of the period
    if (aggregation === "byWeek") {
        periodStart.isoWeekday(1);
        if (periodEnd.isoWeekday() !== 7) {
            periodEnd.isoWeekday(7);
        }
    } else if (aggregation === "byMonth") {
        periodStart.startOf('month');
        periodEnd.endOf('month');
    }
    return {
        periodStart,
        periodEnd
    }
}




export {
    featureAggregator,
    exportTocsv,
    getFilterIdx,
    buildWidgetFilter,
    exportFilter,
    getDatesForPeriodAggregation
}
