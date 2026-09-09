import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import moment from 'moment-timezone';

import TrError from 'chaire-lib-common/lib/utils/TrError';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import Holidays from 'date-holidays';

// FIXME Circular dependency here
import taxiActivitesDbQueries  from './taxiActivities.db.queries';

const objectToDbColumn = {
    "activities": "taxi_activities.id",
    "trips"     : "taxi_activities.id",
    "vehicles"  : "tr_taxis.vehicle_id",
    "driver"    : "tr_taxis.driver_id",
    "operators" : "taxi_activities.operator_id",
    "distance"  : "distance_meters",
    "duration"  : "duration_seconds"
};

// const temporalOptionsToPostrgresExtract = {
//     "byMonth"       : "MONTH",
//     "byWeek"        : "WEEK",
//     "byDayOfWeek"   : "ISODOW",
//     "byHour"        : "HOUR",
// }

const temporalOptionsToPostrgresDateTrunc = {
    "byMonth"       : "MONTH",
    "byWeek"        : "WEEK",
    "byDay"         : "DAY",
}

const getFilterString = function(parameters) {
    const { filterString: temporalFilterString, placeholders } = getTemporalFilterString(parameters)
    const spatialString        = getSpatialFilterString(parameters)
    const statusString         = getStatusFilterString(parameters)
    const filterString = temporalFilterString + spatialString + statusString
    return { filterString, placeholders };
}

const getTemporalFilterString = function(parameters) {
    let filterString = `` //init filter string with 1=1 allows us to qdd every following args with AND
    const timezone = parameters.timezone || config.timezone || 'utc';
    const filters = parameters.filters;
    const placeholders = [];
    //temporal filter
    if (filters.temporal) {
        // filter on hour
        if (filters.temporal.hours) {
            filterString += ` AND ( 0=1` //all condition in this groupe qre chqined with OR --> init condition to 0=1 allows us to not select every line
            for (let hour of filters.temporal.hours) {
                if (!_isBlank(hour.split("_")[0]) && !_isBlank(hour.split("_")[1])) {
                    filterString += `
                        OR EXTRACT(HOUR from start_at AT time zone 'utc' AT time zone ?) BETWEEN ${hour.split("_")[0]} AND ${Math.max(parseInt(hour.split("_")[1]) - 1, 0)}
                    `
                    placeholders.push(timezone);
                }
            }
            filterString += `) `
        }

        // filter on day of week
        if (filters.temporal.dow) {
            filterString += `AND ( 0=1` //all condition in this groupe are chained with OR --> init condition to 0=1 allows us to not select every line
            if (filters.temporal.dow.includes('sunday')) {
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 0
                `
                placeholders.push(timezone);
            }
            if (filters.temporal.dow.includes('monday')) {
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 1
                `
                placeholders.push(timezone);
            }
            if (filters.temporal.dow.includes('tuesday')) {
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 2
                `
                placeholders.push(timezone);
            }
            if (filters.temporal.dow.includes('wednesday')) {
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 3
                `
                placeholders.push(timezone);
            }
            if (filters.temporal.dow.includes('thursday')) {
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 4
                `
                placeholders.push(timezone);
            }
            if (filters.temporal.dow.includes('friday')) {
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 5
                `
                placeholders.push(timezone);
            }
            if (filters.temporal.dow.includes('saturday')) {
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 6
                `
                placeholders.push(timezone);
            }
            if (filters.temporal.dow.includes('weekend')) {
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 6 OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 0
                `
                placeholders.push(timezone, timezone);
            }
            if (filters.temporal.dow.includes('non_working_day')) {
                const hdDates = getNonBussinessDays(parameters.startAt, parameters.endAt)
                filterString += `
                    OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 6 OR EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) = 0
                `
                placeholders.push(timezone, timezone);
                if (hdDates.length > 0) {
                    filterString +=`
                        OR DATE_TRUNC('day', start_at AT time zone 'utc' AT time zone ?) IN (${hdDates.map(date=>`TO_DATE('${date}', 'YYY-MM-DD')`).join(",")})
                    `
                    placeholders.push(timezone);
                }
            }
            if (filters.temporal.dow.includes('business_day')) {
                const hdDates = getNonBussinessDays(parameters.startAt, parameters.endAt)
                filterString += `
                    OR (EXTRACT(DOW from start_at AT time zone 'utc' AT time zone ?) BETWEEN 1 AND 6
                `
                placeholders.push(timezone);
                if (hdDates.length > 0) {
                    filterString +=`
                        AND DATE_TRUNC('day', start_at AT time zone 'utc' AT time zone ?) NOT IN (${hdDates.map(date=>`TO_DATE('${date}', 'YYY-MM-DD')`).join(",")})
                    `
                    placeholders.push(timezone);
                }
                filterString += `) `
            }
            filterString += `) `
        }
    }
    return { filterString, placeholders };

}

const getNonBussinessDays = function(startAtEpoch, endAtEpoch) {
    const hd = new Holidays()
    hd.init('CA', 'qc')

    const hdDates = [];

    let curentEpoc = startAtEpoch;

    while (curentEpoc <= endAtEpoch) {
        if (hd.isHoliday(new Date(curentEpoc*1000))) {
            hdDates.push(moment(curentEpoc*1000).format("YYYY-MM-DD"));
        }
        curentEpoc = curentEpoc + 3600*24;
    }
    return hdDates
}


const getSpatialFilterString = function(parameters) {
    let filterString = `` //init filter string with 1=1 allows us to qdd every following args with AND
    const filters = parameters.filters

    if (filters.spatial) {
        if (filters.spatial.origin) {
            filterString += `AND taxi_activities.data #>> '{zones, origin}' IN ('${filters.spatial.origin.join("','")}')`
        }
        if (filters.spatial.destination) {
            filterString += `AND taxi_activities.data #>> '{zones, destination}' IN ('${filters.spatial.destination.join("','")}')`
        }
    }
    return filterString
}

const getStatusFilterString = function(parameters) {
    let filterString = `` //init filter string with 1=1 allows us to qdd every following args with AND
    const filters = parameters.filters

    if (filters.options && filters.options.statusOption && filters.options.statusOption !== "none") {
        filterString += `AND taxi_activities.status = '${filters.options.statusOption}'`
    }
    return filterString
}


const dataQualityString = function(tableName) {
    if (!tableName) {
        return `
            AND distance_meters IS NOT NULL
            AND start_at IS NOT NULL
            AND end_at IS NOT NULL
            AND distance_meters BETWEEN 400 AND 250000
            AND (duration_seconds / 60) BETWEEN 1.5 AND 180
            AND (distance_meters / duration_seconds) BETWEEN 1 AND 34
        `
    } else {
        return `
            AND ${tableName}.distance_meters IS NOT NULL
            AND ${tableName}.start_at IS NOT NULL
            AND ${tableName}.end_at IS NOT NULL
            AND ${tableName}.distance_meters BETWEEN 400 AND 250000
            AND (EXTRACT(EPOCH from ${tableName}.end_at - ${tableName}.start_at) / 60) BETWEEN 1.5 AND 180
            AND (${tableName}.distance_meters/EXTRACT(EPOCH from ${tableName}.end_at - ${tableName}.start_at)) BETWEEN 1 AND 34
        `
    }
}


const getActiveObjectStatForDataSourcesAndTimeRange = async (parameters) => {

    const dataSourceIdsArray = Array.isArray(parameters.dataSourceIds) ? parameters.dataSourceIds : [parameters.dataSourceIds];
    const startAtEpoch       = parameters.startAt; // must be unix epoch in timezone
    const endAtEpoch         = parameters.endAt;   // must be unix epoch in timezone
    const timezone           = parameters.timezone || config.timezone || 'utc';
    const activeObject       = objectToDbColumn[parameters.object];
    const customFilterString = parameters.customFilterString? parameters.customFilterString : "";
    const hasObjectAggregation       = (parameters.filters.options && parameters.filters.options.objectOption && !_isBlank(parameters.filters.options.objectOption) && parameters.filters.options.objectOption !== "none");
    const hasTemporalAggregation     = (parameters.filters.options && parameters.filters.options.temporalOption && !_isBlank(parameters.filters.options.temporalOption) && parameters.filters.options.temporalOption !== "none");
    const hasGeographicalAggregation = (parameters.filters.options && parameters.filters.options.geographicalOption && !_isBlank(parameters.filters.options.geographicalOption) && parameters.filters.options.geographicalOption !== "none" && parameters.filters.options.onLocationOption);

    // first we get tables names
    try {
        const tablesNamesList = await Promise.all(dataSourceIdsArray.map((dataSourceId) => taxiActivitesDbQueries.getTablesNameForDateRangeAndDataSource(startAtEpoch, endAtEpoch, dataSourceId)));
        // then we select table for the request
        const tableNames = tablesNamesList.flat()
        let subQuery = knex(tableNames[0]).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')).as("taxi_activities")
        // if request needs more than two table we performe union here
        if (tableNames.length > 1) {
            const unionsRequest = tableNames.splice(1 ,tableNames.length).map((tableName) => knex(tableName).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')));
            subQuery = subQuery.unionAll(unionsRequest)
        }
        let knexRequest = knex(subQuery)
            .leftJoin('tr_taxis', 'tr_taxis.id', 'taxi_activities.taxi_id');

        // then we select object to count
        if (parameters.statType === "count") {
            knexRequest = knexRequest
                .countDistinct(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        } else if (parameters.statType === "sum") {
            knexRequest = knexRequest
                .sum(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        } else if (parameters.statType === "avg") {
            knexRequest = knexRequest
                .avg(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        }


        // then if we add temporal and object aggregator
        if (hasTemporalAggregation) {
            knexRequest = knexRequest.select(knex.raw(`DATE_TRUNC('${temporalOptionsToPostrgresDateTrunc[parameters.filters.options.temporalOption]}', start_at AT time zone 'utc' AT time zone ?) AS temporal_agg`, timezone));
        }
        if (hasGeographicalAggregation) {
            knexRequest = knexRequest
                .leftJoin('tr_zones', knex.raw(`CAST(taxi_activities.data #>> '{zones,${parameters.filters.options.onLocationOption}}' AS uuid)`), 'tr_zones.id')
                .select(knex.raw(`CAST(tr_zones.data -> '${parameters.filters.options.geographicalOption.slice(2)}' AS text) AS geographical_agg`))
        }
        if (hasObjectAggregation) {
            knexRequest = knexRequest
                .select(`${objectToDbColumn[parameters.filters.options.objectOption]} AS object_agg`)
                .havingNotNull(objectToDbColumn[parameters.filters.options.objectOption]);
        }

        // this part is for filtering and data quality controle
        const { filterString, placeholders } = getFilterString(parameters);
        knexRequest = knexRequest
            .whereRaw(`
                    start_at BETWEEN (to_timestamp(?) AT time zone 'utc')
                        AND (to_timestamp(?) AT time zone 'utc')
                ` + customFilterString + dataQualityString() + filterString
                , [startAtEpoch, endAtEpoch, ...placeholders]
            );

        // the following parts are for aggregation
        if (hasTemporalAggregation || hasObjectAggregation || hasGeographicalAggregation) {
            // If we have both temporal and object aggregation (i.e. number of trip per driver per month), we need to do the temporal aggrgation first
            // In case of number of trip per driver per month we first do the number of trip for every month and for all drivers
            // then we make the mean by month for every driver
            // then we make the mean for the drivers

            // knexRequest = knex(knexRequest.groupBy(hasObjectAggregation ? 'object_agg' : null, hasTemporalAgregation ? 'temporal_agg' : null).as("foo"))
            if (hasObjectAggregation) {
                knexRequest = knexRequest.groupBy('object_agg')
            }
            if (hasTemporalAggregation) {
                knexRequest = knexRequest.groupBy('temporal_agg')
            }
            if (hasGeographicalAggregation) {
                knexRequest = knexRequest.groupBy('geographical_agg')
            }

            knexRequest = knex(knexRequest.as("foo"));


            // knexRequest = knex(knexRequest.groupBy(hasObjectAggregation ? 'object_agg' : null).groupBy('test').as("foo"))
            // if we have both temp and object agg --> we are making the second step of aggregation
            if (hasTemporalAggregation && hasObjectAggregation) {
                knexRequest = knex(knexRequest.select('object_agg').avg('stat as stat').groupBy('object_agg').as("foo_prime"));
            }


            // then depending on aggregation type we add correct aggregator
            knexRequest = knexRequest.avg('stat as stat')
        }
        try {
            const response = await knexRequest;
            if (response && response[0] && !_isBlank(response[0].stat))
            {
                const parsedResponse = parseFloat(response[0].stat);
                let formatedResponse
                if (parsedResponse % 1 === 0) {
                    formatedResponse = Math.round(parsedResponse)
                } else {
                    formatedResponse = Math.round(parsedResponse * 100) / 100
                }
                if (parameters.widgetSpecs && parameters.widgetSpecs.divider && parameters.divider !== 0) {
                    formatedResponse = formatedResponse / parameters.widgetSpecs.divider
                    formatedResponse = Math.round(formatedResponse * 100) / 100
                }
                return { status: 'success', count: formatedResponse };
            } else {
                return { status: 'success', count: 0 };
            }
        } catch(error) {
            throw new TrError(
                `cannot get stat for active object ${activeObject} because of a database error (knex error: ${error})`,
                'DBQCOUNTTAXIACTOPC0001',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            );
        };
    } catch(err) {
        if (TrError.isTrError(err) && err.code === 'DBTAXIDATERANGENODATA') {
            return { status: 'no_data' };
        }
        throw err;
    };
  }


  const getActiveObjectStatDistributionByTimePeriodDataSourcesAndTimeRange = async (parameters) => {
    // if no temporalAgregation is specified, we use day bay default
    const dataSourceIdsArray = Array.isArray(parameters.dataSourceIds) ? parameters.dataSourceIds : [parameters.dataSourceIds];
    const startAtEpoch       = parameters.startAt; // must be unix epoch in timezone
    const endAtEpoch         = parameters.endAt;   // must be unix epoch in timezone
    const timezone           = parameters.timezone || config.timezone || 'utc';
    const activeObject      = objectToDbColumn[parameters.object];
    const customFilterString = parameters.customFilterString? parameters.customFilterString : "";
    const hasObjectAggregation       = (parameters.filters.options && parameters.filters.options.objectOption && !_isBlank(parameters.filters.options.objectOption) && parameters.filters.options.objectOption !== "none");
    const hasTemporalAgregation      = (parameters.filters.options && parameters.filters.options.temporalOption && !_isBlank(parameters.filters.options.temporalOption) && parameters.filters.options.temporalOption !== "none");
    const hasGeographicalAggregation = (parameters.filters.options && parameters.filters.options.geographicalOption && !_isBlank(parameters.filters.options.geographicalOption) && parameters.filters.options.geographicalOption !== "none" && parameters.filters.options.onLocationOption);

    // first we get tables names
    try {
        const tablesNamesList = await Promise.all(dataSourceIdsArray.map((dataSourceId) => taxiActivitesDbQueries.getTablesNameForDateRangeAndDataSource(startAtEpoch, endAtEpoch, dataSourceId)));
        const tablesNames = tablesNamesList.flat();
        let subQuery = knex(tablesNames[0]).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')).as("taxi_activities")
        // if request needs more than two table we performe union here
        if (tablesNames.length > 1) {
            const unionsRequest = tablesNames.splice(1 ,tablesNames.length).map((tableName) => knex(tableName).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')));
            subQuery = subQuery.unionAll(unionsRequest)
        }
        // first we select table for the request
        let knexRequest = knex(subQuery)
            .leftJoin('tr_taxis', 'tr_taxis.id', 'taxi_activities.taxi_id');

        // then we select object to count
        if (parameters.statType === "count") {
            knexRequest = knexRequest
                .countDistinct(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        } else if (parameters.statType === "sum") {
            knexRequest = knexRequest
                .sum(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        } else if (parameters.statType === "avg") {
            knexRequest = knexRequest
                .avg(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        }

        // then if we add temporal and object aggregator
        // if no temporalAgregation is specified, we use day bay default
        if (hasTemporalAgregation) {
            //the conditional on by week is due to the fact that postgress week starts on monday
            knexRequest = knexRequest.select(knex.raw(`DATE_TRUNC('${temporalOptionsToPostrgresDateTrunc[parameters.filters.options.temporalOption]}', start_at AT time zone 'utc' AT time zone ?) AS temporal_agg`, timezone));
        } else {
            knexRequest = knexRequest.select(knex.raw(`DATE_TRUNC('${temporalOptionsToPostrgresDateTrunc.byDay}', start_at AT time zone 'utc' AT time zone ?) AS temporal_agg`, timezone));
        }
        if (hasGeographicalAggregation) {
            knexRequest = knexRequest
                .leftJoin('tr_zones', knex.raw(`CAST(taxi_activities.data #>> '{zones,${parameters.filters.options.onLocationOption}}' AS uuid)`), 'tr_zones.id')
                .select(knex.raw(`CAST(tr_zones.data -> '${parameters.filters.options.geographicalOption.slice(2)}' AS text) AS geographical_agg`))
        }
        if (hasObjectAggregation) {
            knexRequest = knexRequest
                .select(`${objectToDbColumn[parameters.filters.options.objectOption]} AS object_agg`)
                .havingNotNull(objectToDbColumn[parameters.filters.options.objectOption]);
        }

        // this part is for filtering and data quality controle
        const { filterString, placeholders } = getFilterString(parameters);
        knexRequest = knexRequest
            .whereRaw(`
                    start_at BETWEEN (to_timestamp(?) AT time zone 'utc')
                        AND (to_timestamp(?) AT time zone 'utc')
                ` + customFilterString + dataQualityString() + filterString
                , [startAtEpoch, endAtEpoch, ...placeholders]
            );

        // the following parts are for aggregation
        if (hasObjectAggregation && hasGeographicalAggregation) {
            knexRequest = knexRequest.groupBy('object_agg', 'geographical_agg', 'temporal_agg')
        }
        else if (hasObjectAggregation) {
            knexRequest = knexRequest.groupBy('object_agg', 'temporal_agg')
        }
        else if (hasGeographicalAggregation) {
            knexRequest = knexRequest.groupBy('geographical_agg', 'temporal_agg')
        } else {
            knexRequest = knexRequest.groupBy('temporal_agg')
        }

        knexRequest = knex(knexRequest.as("foo"));
        knexRequest = knexRequest.avg('stat as stat').select(knex.raw(`temporal_agg at time zone ? as temporal_agg`, timezone))
        knexRequest = knexRequest.groupBy('temporal_agg').orderBy('temporal_agg')

        try {
            const response = await knexRequest;
            const formatResponse = function(numberString) {
                const parsedResponse = parseFloat(numberString);
                let formatedResponse
                if (parsedResponse % 1 === 0) {
                formatedResponse = Math.round(parsedResponse)
                } else {
                formatedResponse = Math.round(parsedResponse * 100) / 100
                }
                if (parameters.widgetSpecs && parameters.widgetSpecs.divider && parameters.divider !== 0) {
                    formatedResponse = formatedResponse / parameters.widgetSpecs.divider
                    formatedResponse = Math.round(formatedResponse * 100) / 100
                }
                return formatedResponse
            };
            const statPerPeriod = {};
            if (response.length > 0)
            {
                for (let i = 0; i < response.length; i++){
                    statPerPeriod[moment(response[i].temporal_agg).tz(timezone).format('YYYY-MM-DD HH:mm')] = !_isBlank(response[i].stat) ? formatResponse(response[i].stat) : 0;
                }
                return { status: 'success', counts: statPerPeriod };
            }
            else
            {
                return { status: 'success', counts: {} };
            }
        } catch(error) {
            throw new TrError(
                `cannot get stat active object ${activeObject} by temporal period because of a database error (knex error: ${error})`,
                'DBQCOUNTTAXIACTDRC0001',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            );
        };
    } catch(err) {
        if (TrError.isTrError(err) && err.code === 'DBTAXIDATERANGENODATA') {
            return { status: 'no_data' };
        }
        throw err;
    };
};

const getActiveObjectStatDistributionBySpatialZoneDataSourcesAndTimeRange = async (parameters) => {

    // if no temporalAgregation is specified, we use day bay default
    const dataSourceIdsArray = Array.isArray(parameters.dataSourceIds) ? parameters.dataSourceIds : [parameters.dataSourceIds];
    const startAtEpoch       = parameters.startAt; // must be unix epoch in timezone
    const endAtEpoch         = parameters.endAt;   // must be unix epoch in timezone
    const timezone           = parameters.timezone || config.timezone || 'utc';
    const activeObject      = objectToDbColumn[parameters.object];
    const customFilterString = parameters.customFilterString? parameters.customFilterString : "";
    const hasObjectAggregation = (parameters.filters.options && parameters.filters.options.objectOption && !_isBlank(parameters.filters.options.objectOption) && parameters.filters.options.objectOption !== "none");
    const hasTemporalAgregation = (parameters.filters.options && parameters.filters.options.temporalOption && !_isBlank(parameters.filters.options.temporalOption) && parameters.filters.options.temporalOption !== "none");
    const hasGeographicalAggregation = (parameters.filters.options && parameters.filters.options.geographicalOption && !_isBlank(parameters.filters.options.geographicalOption) && parameters.filters.options.geographicalOption !== "none" && parameters.filters.options.onLocationOption);

    // first we get tables names
    try {
        const tablesNamesList= await Promise.all(dataSourceIdsArray.map((dataSourceId) => taxiActivitesDbQueries.getTablesNameForDateRangeAndDataSource(startAtEpoch, endAtEpoch, dataSourceId)));
        const tablesNames = tablesNamesList.flat();
        let subQuery = knex(tablesNames[0]).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')).as("taxi_activities")
        // if request needs more than two table we performe union here
        if (tablesNames.length > 1) {
            const unionsRequest = tablesNames.splice(1 ,tablesNames.length).map((tableName) => knex(tableName).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')));
            subQuery = subQuery.unionAll(unionsRequest)
        }
        let knexRequest = knex(subQuery)
            .leftJoin('tr_taxis', 'tr_taxis.id', 'taxi_activities.taxi_id');

        // then we select object to count
        if (parameters.statType === "count") {
            knexRequest = knexRequest
                .countDistinct(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        } else if (parameters.statType === "sum") {
            knexRequest = knexRequest
                .sum(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        } else if (parameters.statType === "avg") {
            knexRequest = knexRequest
                .avg(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        }

        // then if we add temporal, spatial and object aggregator
        if (hasTemporalAgregation) {
            knexRequest = knexRequest.select(knex.raw(`DATE_TRUNC('${temporalOptionsToPostrgresDateTrunc[parameters.filters.options.temporalOption]}', start_at AT time zone 'utc' AT time zone ?) AS temporal_agg`, timezone));
        }
        if (hasObjectAggregation) {
            knexRequest = knexRequest.select(`${objectToDbColumn[parameters.filters.options.objectOption]} AS object_agg`).havingNotNull(objectToDbColumn[parameters.filters.options.objectOption]);
        }
        // normaly we should always have either a spatial agregation or in this function
        if (hasGeographicalAggregation) {
            knexRequest = knexRequest
                .leftJoin('tr_zones', knex.raw(`CAST(taxi_activities.data #>> '{zones,${parameters.filters.options.onLocationOption}}' AS uuid)`), 'tr_zones.id')
                .select(knex.raw(`CAST(tr_zones.data -> '${parameters.filters.options.geographicalOption.slice(2)}' AS text) AS geographical_agg`))
        }



        // this part is for filtering and data quality controle
        const { filterString, placeholders } = getFilterString(parameters);
        knexRequest = knexRequest
            .whereRaw(`
                    start_at BETWEEN (to_timestamp(?) AT time zone 'utc')
                        AND (to_timestamp(?) AT time zone 'utc')
                ` + customFilterString + dataQualityString() + filterString
                , [startAtEpoch, endAtEpoch, ...placeholders]
            );

        // the following parts are for aggregation
        if (hasTemporalAgregation || hasObjectAggregation) {
            if (hasTemporalAgregation) {
                knexRequest = knexRequest.groupBy('temporal_agg')
            } if (hasObjectAggregation) {
                knexRequest = knexRequest.groupBy('object_agg')
            }

            knexRequest = knex(knexRequest.groupBy('geographical_agg').as("foo")).avg('stat as stat').select('geographical_agg')
        }

        knexRequest = knexRequest.groupBy('geographical_agg').orderBy('stat')


        try {
            const response = await knexRequest;
            const formatResponse = function(numberString) {
                const parsedResponse = parseFloat(numberString);
                let formatedResponse = Math.round(parsedResponse)
                // if (parsedResponse % 1 === 0) {
                //   formatedResponse = Math.round(parsedResponse)
                // } else {
                //   formatedResponse = Math.round(parsedResponse * 100) / 100
                // }
                if (parameters.widgetSpecs && parameters.widgetSpecs.divider && parameters.divider !== 0) {
                    formatedResponse = formatedResponse / parameters.widgetSpecs.divider
                    formatedResponse = Math.round(formatedResponse * 100) / 100
                }
                return formatedResponse
            };
            const statPerZone = {};
            if (response.length > 0)
            {
                for (let i = 0; i < response.length; i++){
                    if (response[i].geographical_agg) {
                        statPerZone[response[i].geographical_agg.toString()] = !_isBlank(response[i].stat) ? formatResponse(response[i].stat) : 0;
                    }
                }
                return { status: 'success', counts: statPerZone };
            } else {
                return { status: 'success', counts: {} };
            }
        } catch(error) {
            throw new TrError(
                `cannot get stat for active object ${activeObject} by spatial zone because of a database error (knex error: ${error})`,
                'DBQCOUNTTAXIACTDRC0001',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            );
        };
    } catch(err) {
        if (TrError.isTrError(err) && err.code === 'DBTAXIDATERANGENODATA') {
            return { status: 'no_data' };
        }
        throw err;
    };
};



const getActiveObjectStatDistributionByObjectDataSourcesAndTimeRange = async (parameters) => {

    // if no temporalAgregation is specified, we use day bay default
    const dataSourceIdsArray = Array.isArray(parameters.dataSourceIds) ? parameters.dataSourceIds : [parameters.dataSourceIds];
    const startAtEpoch       = parameters.startAt; // must be unix epoch in timezone
    const endAtEpoch         = parameters.endAt;   // must be unix epoch in timezone
    const timezone           = parameters.timezone || config.timezone || 'utc';
    const activeObject      = objectToDbColumn[parameters.object];
    const customFilterString = parameters.customFilterString? parameters.customFilterString : "";
    const hasObjectAggregation = (parameters.filters.options && parameters.filters.options.objectOption && !_isBlank(parameters.filters.options.objectOption) && parameters.filters.options.objectOption !== "none");
    const hasTemporalAgregation = (parameters.filters.options && parameters.filters.options.temporalOption && !_isBlank(parameters.filters.options.temporalOption) && parameters.filters.options.temporalOption !== "none");
    const hasGeographicalAggregation = (parameters.filters.options && parameters.filters.options.geographicalOption && !_isBlank(parameters.filters.options.geographicalOption) && parameters.filters.options.geographicalOption !== "none" && parameters.filters.options.onLocationOption);
    // first we get tables names
    try {
        const tablesNamesList = await Promise.all(dataSourceIdsArray.map((dataSourceId) => taxiActivitesDbQueries.getTablesNameForDateRangeAndDataSource(startAtEpoch, endAtEpoch, dataSourceId)));
        const tablesNames = tablesNamesList.flat();
        let subQuery = knex(tablesNames[0]).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')).as("taxi_activities")
        // if request needs more than two table we performe union here
        if (tablesNames.length > 1) {
            const unionsRequest = tablesNames.splice(1 ,tablesNames.length).map((tableName) => knex(tableName).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')));
            subQuery = subQuery.unionAll(unionsRequest)
        }
        let knexRequest = knex(subQuery)
            .leftJoin('tr_taxis', 'tr_taxis.id', 'taxi_activities.taxi_id');

        // then we select object to count
        if (parameters.statType === "count") {
            knexRequest = knexRequest
                .countDistinct(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        } else if (parameters.statType === "sum") {
            knexRequest = knexRequest
                .sum(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        } else if (parameters.statType === "avg") {
            knexRequest = knexRequest
                .avg(activeObject, { as: 'stat' })
                .whereNotNull(activeObject);
        }

        // then if we add temporal, spatial and object aggregator
        if (hasTemporalAgregation) {
            knexRequest = knexRequest.select(knex.raw(`DATE_TRUNC('${temporalOptionsToPostrgresDateTrunc[parameters.filters.options.temporalOption]}' ,start_at AT time zone 'utc' AT time zone ?) AS temporal_agg`, timezone));
        }
        if (hasGeographicalAggregation) {
            knexRequest = knexRequest
                .leftJoin('tr_zones', knex.raw(`CAST(taxi_activities.data #>> '{zones,${parameters.filters.options.onLocationOption}}' AS uuid)`), 'tr_zones.id')
                .select(knex.raw(`CAST(tr_zones.data -> '${parameters.filters.options.geographicalOption.slice(2)}' AS text) AS geographical_agg`))
        }
        // normaly we should always have either an object agregation or in this function
        if (hasObjectAggregation) {
            knexRequest = knexRequest.select(`${objectToDbColumn[parameters.filters.options.objectOption]} AS object_agg`).havingNotNull(objectToDbColumn[parameters.filters.options.objectOption]);
        }


        // this part is for filtering and data quality controle
        const { filterString, placeholders } = getFilterString(parameters);
        knexRequest = knexRequest
            .whereRaw(`
                    start_at BETWEEN (to_timestamp(?) AT time zone 'utc')
                        AND (to_timestamp(?) AT time zone 'utc')
                ` + customFilterString + dataQualityString() + filterString
                , [startAtEpoch, endAtEpoch, ...placeholders]
            );

        // the following parts are for aggregation
        if (hasTemporalAgregation || hasGeographicalAggregation) {
            if (hasTemporalAgregation) {
                knexRequest = knexRequest.groupBy('temporal_agg')
            } if (hasGeographicalAggregation) {
                knexRequest = knexRequest.groupBy('geographical_agg')
            }

            knexRequest = knex(knexRequest.groupBy('object_agg').as("foo")).avg('stat as stat').select('object_agg')
        }

        knexRequest = knexRequest.groupBy('object_agg').orderBy('stat')

        try {
            const response = await knexRequest
            const formatResponse = function(numberString) {
                const parsedResponse = parseFloat(numberString);
                let formatedResponse = Math.round(parsedResponse);
                // if (parsedResponse % 1 === 0) {
                //   formatedResponse = Math.round(parsedResponse)
                // } else {
                //   formatedResponse = Math.round(parsedResponse * 100) / 100
                // }
                if (parameters.widgetSpecs && parameters.widgetSpecs.divider && parameters.divider !== 0) {
                    formatedResponse = formatedResponse / parameters.widgetSpecs.divider;
                    formatedResponse = Math.round(formatedResponse * 100) / 100;
                }
                return formatedResponse;
            };
            const statPerObject = {};
            if (response.length > 0)
            {
                for (let i = 0; i < response.length; i++){
                    statPerObject[response[i].object_agg.toString()] = !_isBlank(response[i].stat) ? formatResponse(response[i].stat) : 0;
                }
                return { status: 'success', counts: statPerObject };
            } else {
                return { status: 'success', counts: {} };
            }
        } catch(error) {
            throw new TrError(
                `cannot get stat for object ${activeObject} by object because of a database error (knex error: ${error})`,
                'DBQCOUNTTAXIACTDRC0001',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            );
        };
    } catch(err) {
        if (TrError.isTrError(err) && err.code === 'DBTAXIDATERANGENODATA') {
            return { status: 'no_data' };
        }
        throw err;
    };
};


const getActiveObjectStatDistributionByPeriodDataSourcesAndTimeRange = async (parameters, period) => {

    // if no temporalAgregation is specified, we use day bay default
    const dataSourceIdsArray = Array.isArray(parameters.dataSourceIds) ? parameters.dataSourceIds : [parameters.dataSourceIds];
    const startAtEpoch       = parameters.startAt; // must be unix epoch in timezone
    const endAtEpoch         = parameters.endAt;   // must be unix epoch in timezone
    const timezone           = parameters.timezone || config.timezone || 'utc';
    const activeObject      = objectToDbColumn[parameters.object];
    const customFilterString = parameters.customFilterString? parameters.customFilterString : "";
    const hasObjectAggregation = (parameters.filters.options && parameters.filters.options.objectOption && !_isBlank(parameters.filters.options.objectOption) && parameters.filters.options.objectOption !== "none");
    const hasGeographicalAggregation = (parameters.filters.options && parameters.filters.options.geographicalOption && !_isBlank(parameters.filters.options.geographicalOption) && parameters.filters.options.geographicalOption !== "none" && parameters.filters.options.onLocationOption);
    try {
        const tablesNamesList = await Promise.all(dataSourceIdsArray.map((dataSourceId) => taxiActivitesDbQueries.getTablesNameForDateRangeAndDataSource(startAtEpoch, endAtEpoch, dataSourceId)))
        const tablesNames = tablesNamesList.flat();
        let subQuery = knex(tablesNames[0]).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')).as("taxi_activities")
        // if request needs more than two table we performe union here
        if (tablesNames.length > 1) {
            const unionsRequest = tablesNames.splice(1 ,tablesNames.length).map((tableName) => knex(tableName).select(knex.raw('id, start_at, end_at, taxi_id, distance_meters, operator_id, status, data, EXTRACT(EPOCH FROM end_at - start_at) AS duration_seconds')));
            subQuery = subQuery.unionAll(unionsRequest)
        }
        let knexRequest = knex(subQuery)
            .leftJoin('tr_taxis', 'tr_taxis.id', 'taxi_activities.taxi_id');

        // then we select object to count and date
        if (parameters.statType === "count") {
            knexRequest = knexRequest
                .countDistinct(activeObject, { as: 'stat' })
                .select(knex.raw(`DATE(start_at AT time zone 'utc' AT time zone ?) AS date`, timezone))
                .whereNotNull(activeObject);
        } else if (parameters.statType === "sum") {
            knexRequest = knexRequest
                .sum(activeObject, { as: 'stat' })
                .select(knex.raw(`DATE(start_at AT time zone 'utc' AT time zone ?) AS date`, timezone))
                .whereNotNull(activeObject);
        } else if (parameters.statType === "avg") {
            knexRequest = knexRequest
                .avg(activeObject, { as: 'stat' })
                .select(knex.raw(`DATE(start_at AT time zone 'utc' AT time zone ?) AS date`, timezone))
                .whereNotNull(activeObject);
        }

        // then if we add moment and object aggregator
        knexRequest = knexRequest.select(knex.raw(`EXTRACT( ${period} FROM start_at AT time zone 'utc' AT time zone ?) AS moment`, timezone))

        if (hasGeographicalAggregation) {
            knexRequest = knexRequest
                .leftJoin('tr_zones', knex.raw(`CAST(taxi_activities.data #>> '{zones,${parameters.filters.options.onLocationOption}}' AS uuid)`), 'tr_zones.id')
                .select(knex.raw(`CAST(tr_zones.data -> '${parameters.filters.options.geographicalOption.slice(2)}' AS text) AS geographical_agg`))
        }

        // if no temporalAgregation is specified, we use day bay default
        if (hasObjectAggregation) {
            knexRequest = knexRequest.select(`${objectToDbColumn[parameters.filters.options.objectOption]} AS object_agg`).havingNotNull(objectToDbColumn[parameters.filters.options.objectOption]);
        }

        // this part is for filtering and data quality controle
        const { filterString, placeholders } = getFilterString(parameters);
        knexRequest = knexRequest
            .whereRaw(`
                    start_at BETWEEN (to_timestamp(?) AT time zone 'utc')
                        AND (to_timestamp(?) AT time zone 'utc')
                ` + customFilterString + dataQualityString() + filterString
                , [startAtEpoch, endAtEpoch, ...placeholders]
            );


        // the following parts are for aggregation
        if (hasGeographicalAggregation) {
            knexRequest = knexRequest.groupBy('geographical_agg')
        }

        if (hasObjectAggregation) {
            knexRequest = knex(knexRequest.groupBy('object_agg', 'date', 'moment')
                .as("foo"))
                .avg('stat as stat')
                .select('moment')
        } else {
            knexRequest = knex(knexRequest.groupBy('date', 'moment').as("foo"))
                .avg('stat as stat')
                .select('moment')
        }

        knexRequest = knexRequest.groupBy('moment').orderBy('moment')

        try {
            const response = await knexRequest
            const formatResponse = function(numberString) {
                const parsedResponse = parseFloat(numberString);
                let formatedResponse;
                if (parsedResponse % 1 === 0) {
                formatedResponse = Math.round(parsedResponse)
                } else {
                formatedResponse = Math.round(parsedResponse * 100) / 100
                }
                if (parameters.widgetSpecs && parameters.widgetSpecs.divider && parameters.divider !== 0) {
                    formatedResponse = formatedResponse / parameters.widgetSpecs.divider
                    formatedResponse = Math.round(formatedResponse * 100) / 100
                }
                return formatedResponse
            };
            const statPerMoment = {};
            if (response.length > 0)
            {
                for (let i = 0; i < response.length; i++){
                    statPerMoment[response[i].moment.toString()] = !_isBlank(response[i].stat) ? formatResponse(response[i].stat) : 0;
                }
                return { status: 'success', counts: statPerMoment };
            } else {
                return { status: 'success', counts: {} };
            }
        } catch(error) {
            throw new TrError(
                `cannot get stat for active object ${activeObject} by moment because of a database error (knex error: ${error})`,
                'DBQCOUNTTAXIACTDRC0001',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            );
        };
    } catch(err) {
        if (TrError.isTrError(err) && err.code === 'DBTAXIDATERANGENODATA') {
            return { status: 'no_data' };
        }
        throw err;
    };
};

export default {
    dataQualityString,
    getFilterString,
    getActiveObjectStatForDataSourcesAndTimeRange,
    getActiveObjectStatDistributionByTimePeriodDataSourcesAndTimeRange,
    getActiveObjectStatDistributionBySpatialZoneDataSourcesAndTimeRange,
    getActiveObjectStatDistributionByObjectDataSourcesAndTimeRange,
    getActiveObjectStatDistributionByPeriodDataSourcesAndTimeRange,
}
