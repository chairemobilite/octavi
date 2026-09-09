import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import _get        from 'lodash/get';
import _set        from 'lodash/set';
import _maxBy      from 'lodash/maxBy';
import _minBy      from 'lodash/minBy';
import _filter     from 'lodash/filter';
import _cloneDeep  from 'lodash/cloneDeep';
import knexPostgis from 'knex-postgis';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

import { exists as existsForTable, read as readForTable, create as createForTable, createMultiple as createMultipleForTable, update as updateForTable, deleteRecord as _deleteForTable, truncate as truncateForTable, destroy } from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import config from 'chaire-lib-common/lib/config/shared/project.config';
// FIXME Circular dependency here
import taxisDbQueriesUtils  from './taxiUtils.db.queries';
import { minBy, maxBy } from 'lodash';


// const tableName = 'tr_taxi_activities';
const st        = knexPostgis(knex);

const attributesCleaner = function(attributes) {
  const _attributes = _cloneDeep(attributes);
  if (_attributes.origin_geography)
  {
    _attributes.origin_geography = st.geomFromGeoJSON(JSON.stringify(_attributes.origin_geography));
  }
  if (_attributes.destination_geography)
  {
    _attributes.destination_geography = st.geomFromGeoJSON(JSON.stringify(_attributes.destination_geography));
  }
  delete _attributes.is_frozen;
  return _attributes;
};

const makeTablesUnionString = function(tablesNameList) {
    // Using union all as there should be no duplicate and union gives error for json types
    return tablesNameList.map((tableName) => `SELECT * FROM ${tableName}`).join(' UNION ALL ')
}

const getAllTablesForDataSource = function(parameters) {
    /* parameters:
    - dataSourceId,
    */
    return new Promise(function(resolve, reject) {
        return knex('tr_taxi_activities_master').where('data_source_id', parameters.dataSourceId).then(function(response) {
            resolve(response)
        }).catch(function(error) {
            reject(new TrError(
            `cannot get month activities table foar data source ${parameters.dataSourceId} by moment because of a database error (knex error: ${error})`,
            'DBQCOUNTTAXIACTDRC0001',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        });
    })
}

const getTableNameForDateAndDataSource = function(startDate, dataSourceId) {
    /*Get table name for one date
    date must be in epoch
    */
    return new Promise(function(resolve, reject) {
        return knex.raw(`
            SELECT table_name
            FROM tr_taxi_activities_master
            WHERE EXTRACT(YEAR from start_date AT time zone 'utc') = EXTRACT(YEAR from to_timestamp(${startDate}) AT time zone 'utc')
            AND EXTRACT(MONTH from start_date AT time zone 'utc') = EXTRACT(MONTH from to_timestamp(${startDate}) AT time zone 'utc')
            AND data_source_id = '${dataSourceId}'
            ORDER BY start_date DESC
            LIMIT 1
        `).then(function(response) {
            response && response.rows.length === 1 ? resolve(response.rows[0]['table_name']) : resolve(null);
        }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        })
    })
}

/** returns the table name as string where the activity with id is located,
 * otherwise undefined if the activity was not found */
const getTableNameForId = async (id, returnError=true) => {
    /*Get table name for one trip id
    */
    try {
        const tablesInfo = await knex('tr_taxi_activities_master').select('table_name');
        for (let i = 0; i < tablesInfo.length; i++) {
            const table_name = tablesInfo[i].table_name;
            if (await existsForTable(knex, table_name, id)) {
                return table_name;
            }
        }
        return undefined;
    } catch (error) {
        throw new TrError(
            `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiActivityTableNameCouldNotBeFoundForId"
        );
    }
}

/**
 * Get the names of the tables for a certain date range. . If the date range is
 * outside the range of the data in the database, a TrError will be thrown with
 * code `DBTAXIDATERANGENODATA`.
 *
 * @param {*} firstStartDate Start of date range, as unix timestamp
 * @param {*} lastStartDate End of date range, as unix timestamp
 * @param {*} dataSourceId Data source ID
 * @returns The array of table names covering this date range. The table names
 * will always be non-empty.
 */
const getTablesNameForDateRangeAndDataSource = function(firstStartDate, lastStartDate, dataSourceId) {
    const start_date    = new Date(firstStartDate * 1000)
    const end_date      = new Date(lastStartDate * 1000)
    const start_month   = start_date.getUTCMonth()
    const start_year    = start_date.getUTCFullYear()
    const end_month     = end_date.getUTCMonth()
    const end_year      = end_date.getUTCFullYear()

    const nb_of_table = (end_year - start_year) * 12 - start_month + end_month + 1;

    return new Promise(function(resolve, reject) {
        return knex.raw(`
            SELECT table_name
            FROM tr_taxi_activities_master
            WHERE start_date <= to_timestamp(${lastStartDate}) AT time zone 'utc'
            AND data_source_id = '${dataSourceId}'
            ORDER BY start_date DESC
            LIMIT ${nb_of_table}
        `).then(function(response) {
            if (response && response.rows) {
                if (response.rows.length === 0) {
                    reject(new TrError(
                        'No taxi activities found in specified date range',
                        'DBTAXIDATERANGENODATA',
                        "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
                    ))
                } else {
                    resolve(response.rows.map(row => row.table_name));
                }
                return;
            }
            reject(new TrError(
                'cannot fetch taxi activity table because database did not return a valid result',
                'DBQSELECTTAXIACC0001',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        })
    })
}

const getAllTablesNameForDataSource = function(dataSourceId) {
    return new Promise(function(resolve, reject) {
        return (getAllTablesForDataSource({dataSourceId})).then(function(rows) {
            rows && rows.length >= 0 ? resolve(rows.map(row => row.table_name)) : reject(new TrError(
                'cannot fetch taxi activity tables because database did not return a valid result',
                'DBQSELECTTAXIACC0001',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        })
    })
}

const getAllTablesName = function() {
    return new Promise(function(resolve, reject) {
        return knex.raw(`
            SELECT table_name
            FROM tr_taxi_activities_master
            ORDER BY start_date
        `).then(function(response) {
            if (response && response.rows) {
                resolve(response.rows.map(row => row.table_name));
                return;
            }
            reject(new TrError(
                'cannot fetch taxi activity table because database did not return a valid result',
                'DBQSELECTTAXIACC0001',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        })
    })
}


const getLastMonthTableForDataSource = function(dataSourceId) {
    /*Get last table name
    */
    return new Promise(function(resolve, reject) {
        return knex.raw(`
            SELECT table_name
            FROM tr_taxi_activities_master
            WHERE data_source_id = '${dataSourceId}'
            ORDER BY start_date DESC
            LIMIT 1
        `).then(function(response) {
            response && response.rows.length >= 1 ? resolve(response.rows[0]['table_name']) : resolve(null);
        }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        })
    })
}

const getFirstMonthTableForDataSource = function(dataSourceId) {
    /*Get first table name
    */
    return new Promise(function(resolve, reject) {
        return knex.raw(`
            SELECT table_name
            FROM tr_taxi_activities_master
            WHERE data_source_id = ${dataSourceId}
            ORDER BY start_date DESC
            LIMIT 1
        `).then(function(response) {
            response && response.rows.length >= 1 ? resolve(response.rows[0]['table_name']) : resolve(null);
        }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        })
    })
}

const getPreviousTableNameforDataSource = function(tableName, dataSourceId) {
    /* Get previous table name for a table name and a data source
    */
    return new Promise(function(resolve, reject) {
        return knex('tr_taxi_activities_master').select('table_name')
            .where('start_date', '<', knex.table('tr_taxi_activities_master').select('start_date').where('table_name', tableName))
            .andWhere('data_source_id', dataSourceId)
            .orderBy('start_date', 'desc')
            .limit(1)
        .then(function(response) {
            response && response.length >= 1 ? resolve(response[0]['table_name']) : resolve(null);
        }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        })
    })
}

const getNextTableNameforDataSource = function(tableName, dataSourceId) {
    /* Get next table name for a table name and a data source
    */
    return new Promise(function(resolve, reject) {
        return knex('tr_taxi_activities_master').select('table_name')
            .where('start_date', '>', knex.table('tr_taxi_activities_master').select('start_date').where('table_name', tableName))
            .andWhere('data_source_id', dataSourceId)
            .orderBy('start_date', 'asc')
            .limit(1)
        .then(function(response) {
            response && response.length >= 1 ? resolve(response[0]['table_name']) : resolve(null);
        }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity table because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        })
    })
}

const selectActivity = function(parameters = {}) {
  /* parameters:
  - dataSourceId,
  - taxiId,
  - status
  - startAt
  - endAt
  - originGeography
  - destinationGeography
  - timezone
  */
 return new Promise(function(resolve, reject) {
  return getTableNameForDateAndDataSource(parameters.startAt, parameters.dataSourceId).then(function(tableName) {
    if (tableName === null) {
        resolve(null);
    }
    return knex.raw(`
        SELECT
        ta.*,
        CASE origin_geography      WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.origin_geography)::jsonb      END as origin_geography,
        CASE destination_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.destination_geography)::jsonb END as destination_geography
        FROM ${tableName} ta
        WHERE
            ta.status                = '${parameters.status}'
        AND ta.taxi_id               = '${parameters.taxiId}'
        AND ta.start_at              = to_timestamp(${parameters.startAt.unix()}) AT time zone 'utc'
        AND ta.end_at                = to_timestamp(${parameters.endAt.unix()}) AT time zone 'utc'
        AND ta.origin_geography      = ${st.geomFromGeoJSON(JSON.stringify(parameters.originGeography))}
        AND ta.destination_geography = ${st.geomFromGeoJSON(JSON.stringify(parameters.destinationGeography))};
    `).then(function(response) {
        const activities = _get(response, 'rows');
        activities && activities.length === 1 ? resolve(activities[0]) : !(activities && activities.length > 1)  ? resolve(null) : reject(new TrError(
        'cannot fetch taxi activity because database did not return a valid result or returned more than one activity (not unique)',
        'DBQSELECTTAXIACC0001',
        "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
    }).catch(function(error) {
        reject(new TrError(
        `cannot fetch taxi activity because of a database error (knex error: ${error})`,
        'DBQSELECTTAXIACC0002',
        "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
    });
    });
  })
};

const selectLastTaxiActivityBeforeTimestamp = function(parameters = {}) {
    /* parameters:
    - dataSourceId,
    - taxiId,
    -timestamp
    */
   const timezone  = parameters.timezone || config.timezone || 'utc';
   return getTableNameForDateAndDataSource(parameters.timestamp, parameters.dataSourceId).then(function(tableName) {
        //if table name is nome, we return null
        if (tableName) {
            return new Promise(function(resolve, reject) {
                return knex.raw(`
                    SELECT
                        ta.*,
                        CASE origin_geography      WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.origin_geography)::jsonb      END as origin_geography,
                        CASE destination_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.destination_geography)::jsonb END as destination_geography
                        FROM ${tableName} ta
                    WHERE
                            ta.taxi_id    = '${parameters.taxiId}'
                            AND ta.end_at IS NOT NULL
                            AND ta.end_at <= to_timestamp(${parameters.timestamp}) AT time zone '${timezone}'
                        ORDER BY ta.end_at DESC
                        LIMIT 1
                `).then(function(response) {
                    const activities = _get(response, 'rows');
                    if (activities && activities.length === 1) {
                        resolve(activities[0])
                    // if we didn't find any activity we look into previous table. This is to make sure that trips ending at the end of the month are not split by mistake
                    } else {
                        return getPreviousTableNameforDataSource(tableName, parameters.dataSourceId).then(function(previousTableName) {
                            if (previousTableName === null) {
                                resolve(null);
                            }
                            return knex.raw(`
                                SELECT
                                    ta.*,
                                    CASE origin_geography      WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.origin_geography)::jsonb      END as origin_geography,
                                    CASE destination_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.destination_geography)::jsonb END as destination_geography
                                    FROM ${previousTableName} ta
                                WHERE
                                        ta.taxi_id    = '${parameters.taxiId}'
                                        AND ta.end_at IS NOT NULL
                                        AND ta.end_at <= to_timestamp(${parameters.timestamp}) AT time zone '${timezone}'
                                    ORDER BY ta.end_at DESC
                                    LIMIT 1
                            `).then(function(previousResponse) {
                                const previousActivities = _get(previousResponse, 'rows');
                                previousActivities && previousActivities.length === 1 ? resolve(previousActivities[0]) : resolve(null);
                            })
                        })
                    }
                }).catch(function(error) {
                    reject(new TrError(
                        `cannot fetch taxi activity because of a database error (knex error: ${error})`,
                        'DBQSELECTTAXIACC0002',
                        "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
                    ));
                });
            })
        }
        else {
            return null;
        }
    });
  };

  const selectLastActivityTimestamp = function(parameters = {}) {
    /* parameters:
    - dataSourceId,
    */
    return getLastMonthTableForDataSource(parameters.dataSourceId).then(function(tableName) {
        if (!tableName) {
            return undefined;
        }
        return new Promise(function(resolve, reject) {
            return knex.table(tableName)
                .whereNotNull('end_at')
                .max('end_at')
            .then(function(response) {
                resolve(response[0].max);
            }).catch(function(error) {
                reject(new TrError(
                    `cannot fetch taxi activity because of a database error (knex error: ${error})`,
                    'DBQSELECTTAXIACC0002',
                    "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
                ));
            });
        });
    });
  };

  const selectFirsActivityTimestamp = function(parameters = {}) {
    /* parameters:
    - dataSourceId,
    */
    return getFirstMonthTableForDataSource(parameters.dataSourceId).then(function(tableName) {
        return new Promise(function(resolve, reject) {
            return knex.raw(`
            SELECT
                min(ta.start_at)
                FROM ${tableName} ta
            WHERE
                    ta.start_at IS NOT NULL
            `).then(function(response) {
                const lastTimestamp = _get(response, 'rows');
                resolve(lastTimestamp[0].max);
            }).catch(function(error) {
            reject(new TrError(
                `cannot fetch taxi activity because of a database error (knex error: ${error})`,
                'DBQSELECTTAXIACC0002',
                "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
            });
        });
    });
  };

// FIXME This returns the next activities in the current table only, there may be activities in future tables
const selectNextTaxiActivitiesAfterTimestamp = async (parameters = {}) => {
    /* parameters:
    - dataSourceId,
    - taxiId,
    -timestamp
    -latestStart (time after which we don't want activities)
    */
    const timezone  = parameters.timezone || config.timezone || 'utc';
    try {
        const tableName = await getTableNameForDateAndDataSource(parameters.timestamp, parameters.dataSourceId)
        //if table name is nome, we return null
        if (tableName) {
            const response = await knex.raw(`
                SELECT
                    ta.*,
                    CASE origin_geography      WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.origin_geography)::jsonb      END as origin_geography,
                    CASE destination_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.destination_geography)::jsonb END as destination_geography
                    FROM ${tableName} ta
                WHERE
                        ta.taxi_id    = '${parameters.taxiId}'
                        AND ta.end_at IS NOT NULL
                        AND ta.end_at > to_timestamp(${parameters.timestamp}) AT TIME ZONE '${timezone}'
                        ${parameters.latestStart !== undefined ? ` AND ta.start_at < to_timestamp(${parameters.latestStart}) AT TIME ZONE '${timezone}'` : ''}
                    ORDER BY ta.end_at ASC
            `);
            const activities = _get(response, 'rows');
            if (activities && activities.length >= 1) {
                return activities;
            // if we didn't find any activity we look into next table. This is to make sure that trips ending at the end of the month are not split by mistake
            } else {
                const nextTableName = await getNextTableNameforDataSource(tableName, parameters.dataSourceId)
                if (nextTableName === null) {
                    return null;
                }
                const nextResponse = await knex.raw(`
                    SELECT
                        ta.*,
                        CASE origin_geography      WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.origin_geography)::jsonb      END as origin_geography,
                        CASE destination_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.destination_geography)::jsonb END as destination_geography
                        FROM ${nextTableName} ta
                    WHERE
                        ta.taxi_id    = '${parameters.taxiId}'
                        AND ta.end_at IS NOT NULL
                        AND ta.end_at > to_timestamp(${parameters.timestamp}) AT TIME ZONE '${timezone}'
                        ${parameters.latestStart !== undefined ? ` AND ta.start_at < to_timestamp(${parameters.latestStart}) AT TIME ZONE '${timezone}'` : ''}
                    ORDER BY ta.end_at ASC
                `)
                const nextActivities = _get(nextResponse, 'rows');
                return nextActivities && nextActivities.length >= 1 ? nextActivities : null;
            }
        } else {
            return null;
        }
    } catch(error) {
        throw new TrError(
            `cannot fetch next taxi activity because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiNextActivitiesCouldNotBeFetchedBecauseDatabaseError"
        );
    }
};

const collection = function(dataSourceIds, parameters) {

  if (_isBlank(parameters)) {
      parameters = {}
  }
  if (_isBlank(parameters.limit)) {
      parameters.limit = "NULL";
    }
  if (_isBlank(parameters.offset)) {
    parameters.offset = 0;
  }
  if (_isBlank(parameters.sampleSize)) {
    parameters.sampleSize = null;
  }
  return Promise.all(dataSourceIds.map((dataSourceId) => getAllTablesNameForDataSource(dataSourceId))).then((tablesNameLists) => {
  // TODO see usage activitiers collection object may be too big to handle eficiently
    if (tablesNameLists.length === 0) {
        return [];
    }
    const unionString = tablesNameLists.map((tablesNameList) => makeTablesUnionString(tablesNameList))
    return new Promise(function(resolve, reject) {
        return knex.raw(`
        SELECT
            ta.*,
            CASE origin_geography      WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.origin_geography)::jsonb      END as origin_geography,
            CASE destination_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(ta.destination_geography)::jsonb END as destination_geography
        FROM (${unionString}) ta
        ORDER BY ${parameters.sampleSize !== null ? `RANDOM() LIMIT ${parameters.sampleSize}`: `ta.start_at LIMIT ${parameters.limit} OFFSET ${parameters.offset}`}
        `).then(function(response) {
        const collection = _get(response, 'rows');
        collection ? resolve(collection) : reject(new TrError(
            'cannot fetch taxi activities collection because database did not return a valid array',
            'DBQTAXIACC0001',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
        }).catch(function(error) {
        reject(new TrError(
            `cannot fetch taxi activities collection because of a database error (knex error: ${error})`,
            'DBQTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
        });
    });
  })
};


const originGeojsonCollection = function(dataSourceIds, limit = "NULL", offset = 0, sampleSize = null) {
  // TODO see usage activitiers collection object may be too big to handle eficiently

  return Promise.all(dataSourceIds.map((dataSourceId) => getAllTablesNameForDataSource(dataSourceId))).then((tablesNameLists) => {
    const unionString = tablesNameLists.map((tablesNameList) => makeTablesUnionString(tablesNameList))

    return new Promise(function(resolve, reject) {
        return knex.raw(`
        SELECT jsonb_build_object(
            'type',     'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
        ) as geojson
        FROM (
            SELECT jsonb_build_object(
            'type'      , 'Feature'                                 ,
            'id'        , inputs.integer_id                         ,
            'geometry'  , ST_AsGeoJSON(inputs.origin_geography)::jsonb,
            'properties', inputs.properties
            ) AS feature
            FROM (
            SELECT
                ta.id,
                ta.origin_geography,
                ta.integer_id,
                json_build_object(
                'id'                          , ta.id                    ,
                'data_source_id'              , ta.data_source_id        ,
                'taxi_id'                     , ta.taxi_id               ,
                'status'                      , ta.status                ,
                'integer_id'                  , ta.integer_id            ,
                'start_at'                    , ta.start_at              ,
                'end_at'                      , ta.end_at                ,
                'distance_meters'             , ta.distance_meters       ,
                'operator_id'                 , ta.operator_id
                ) AS properties
            FROM (${unionString}) ta
            ORDER BY ${sampleSize !== null ? `RANDOM() LIMIT ${sampleSize}`: `ta.integer_id LIMIT ${limit} OFFSET ${offset}`}
            ) inputs
        ) features;
        `).then(function(response) {
        const geojson = _get(response, 'rows[0].geojson');
        geojson ? resolve(geojson) : reject(new TrError(
            'cannot fetch taxi activities origin geojson collection because database did not return a valid geojson',
            'DBQTAXISACOC0003',
            "OdTripOriginGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
        }).catch(function(error) {
        reject(new TrError(
            `cannot fetch taxi activities origin geojson collection because of a database error (knex error: ${error})`,
            'DBQTAXISACOC0004',
            "OdTripOriginGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
        });

    });
  });

};

const originGeojsonCollectionForDataSourcesAndTimeRange = function(parameters) {
  // TODO see usage activitiers collection object may be too big to handle eficiently


  if (_isBlank(parameters.limit)) {
    parameters.limit = "NULL";
  }
  if (_isBlank(parameters.offset)) {
    parameters.offset = 0;
  }
  if (_isBlank(parameters.sampleSize)) {
    parameters.sampleSize = null;
  }
  const startAtEpoch     = parameters.startAt; // must be unix epoch in timezone
  const endAtEpoch       = parameters.endAt;   // must be unix epoch in timezone
  const timezone         = parameters.timezone || config.timezone || 'utc';
  return Promise.all(parameters.dataSourceIds.map((dataSourceId) => getAllTablesNameForDataSource(dataSourceId))).then((tablesNameLists) => {
    const unionString = tablesNameLists.map((tablesNameList) => makeTablesUnionString(tablesNameList))

    return new Promise(function(resolve, reject) {
        return knex.raw(`
        SELECT jsonb_build_object(
            'type',     'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
        ) as geojson
        FROM (
            SELECT jsonb_build_object(
            'type'      , 'Feature'                                 ,
            'id'        , inputs.integer_id                         ,
            'geometry'  , ST_AsGeoJSON(inputs.origin_geography)::jsonb,
            'properties', inputs.properties
            ) AS feature
            FROM (
            SELECT
                ta.id,
                ta.origin_geography,
                ta.integer_id,
                json_build_object(
                'id'                          , ta.id                    ,
                'data_source_id'              , ta.data_source_id        ,
                'taxi_id'                     , ta.taxi_id               ,
                'status'                      , ta.status                ,
                'integer_id'                  , ta.integer_id            ,
                'start_at'                    , ta.start_at              ,
                'end_at'                      , ta.end_at                ,
                'distance_meters'             , ta.distance_meters       ,
                'operator_id'                 , ta.operator_id
                ) AS properties
            FROM (${unionString}) ta
            WHERE
            ta.status = 'occupied'
            AND ta.start_at between (to_timestamp(?) AT time zone 'utc')
                AND (to_timestamp(?) AT time zone 'utc')
            `+ taxisDbQueriesUtils.dataQualityString("ta") + taxisDbQueriesUtils.getFilterString(parameters) +`
            ORDER BY ${parameters.sampleSize !== null ? `RANDOM() LIMIT ${parameters.sampleSize}`: `ta.integer_id LIMIT ${parameters.limit} OFFSET ${parameters.offset}`}
            ) inputs
        ) features;
        `, [startAtEpoch, endAtEpoch]).then(function(response) {
        const geojson = _get(response, 'rows[0].geojson');
        geojson ? resolve(geojson) : reject(new TrError(
            'cannot fetch taxi activities origin geojson collection because database did not return a valid geojson',
            'DBQTAXISACOC0005',
            "OdTripOriginGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
        }).catch(function(error) {
        reject(new TrError(
            `cannot fetch taxi activities origin geojson collection because of a database error (knex error: ${error})`,
            'DBQTAXISACOC0006',
            "OdTripOriginGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
        });

    });
  });

};


const destinationGeojsonCollection = function(dataSourceIds, limit = "NULL", offset = 0, sampleSize = null) {
  // TODO see usage activitiers collection object may be too big to handle eficiently

  return Promise.all(dataSourceIds.map((dataSourceId) => getAllTablesNameForDataSource(dataSourceId))).then((tablesNameLists) => {
    const unionString = tablesNameLists.map((tablesNameList) => makeTablesUnionString(tablesNameList))
    return new Promise(function(resolve, reject) {
        return knex.raw(`
        SELECT jsonb_build_object(
            'type',     'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
        ) as geojson
        FROM (
            SELECT jsonb_build_object(
            'type'      , 'Feature'                                 ,
            'id'        , inputs.integer_id                         ,
            'geometry'  , ST_AsGeoJSON(inputs.destination_geography)::jsonb,
            'properties', inputs.properties
            ) AS feature
            FROM (
            SELECT
                ta.id,
                ta.destination_geography,
                ta.integer_id,
                json_build_object(
                'id'                          , ta.id                    ,
                'data_source_id'              , ta.data_source_id        ,
                'taxi_id'                     , ta.taxi_id               ,
                'status'                      , ta.status                ,
                'integer_id'                  , ta.integer_id            ,
                'start_at'                    , ta.start_at              ,
                'end_at'                      , ta.end_at                ,
                'distance_meters'             , ta.distance_meters       ,
                'operator_id'                 , ta.operator_id
                ) AS properties
            FROM (${unionString}) ta
            ORDER BY ${sampleSize !== null ? `RANDOM() LIMIT ${sampleSize}`: `ta.integer_id LIMIT ${limit} OFFSET ${offset}`}
            ) inputs
        ) features;
        `).then(function(response) {
        const geojson = _get(response, 'rows[0].geojson');
        geojson ? resolve(geojson) : reject(new TrError(
            'cannot fetch taxi activities destination geojson collection because database did not return a valid geojson',
            'DBQTAXISACDC0003',
            "OdTripDestinationGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
        }).catch(function(error) {
        reject(new TrError(
            `cannot fetch taxi activities destination geojson collection because of a database error (knex error: ${error})`,
            'DBQTAXISACDC0004',
            "OdTripDestinationGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError"
        ));
        });

    });
  });

};

const destinationGeojsonCollectionForDataSourcesAndTimeRange = function(parameters) {
  // TODO see usage activitiers collection object may be too big to handle eficiently


    if (_isBlank(parameters.limit)) {
      parameters.limit = "NULL";
    }
    if (_isBlank(parameters.offset)) {
      parameters.offset = 0;
    }
    if (_isBlank(parameters.sampleSize)) {
      parameters.sampleSize = null;
    }
    const startAtEpoch     = parameters.startAt; // must be unix epoch in timezone
    const endAtEpoch       = parameters.endAt;   // must be unix epoch in timezone
    const timezone         = parameters.timezone || config.timezone || 'utc';
    return Promise.all(parameters.dataSourceIds.map((dataSourceId) => getAllTablesNameForDataSource(dataSourceId))).then((tablesNameLists) => {
        const unionString = tablesNameLists.map((tablesNameList) => makeTablesUnionString(tablesNameList))

        return new Promise(function(resolve, reject) {
        return knex.raw(`
            SELECT jsonb_build_object(
            'type',     'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
            ) as geojson
            FROM (
            SELECT jsonb_build_object(
                'type'      , 'Feature'                                 ,
                'id'        , inputs.integer_id                         ,
                'geometry'  , ST_AsGeoJSON(inputs.destination_geography)::jsonb,
                'properties', inputs.properties
            ) AS feature
            FROM (
                SELECT
                ta.id,
                ta.destination_geography,
                ta.integer_id,
                json_build_object(
                    'id'                          , ta.id                    ,
                    'data_source_id'              , ta.data_source_id        ,
                    'taxi_id'                     , ta.taxi_id               ,
                    'status'                      , ta.status                ,
                    'integer_id'                  , ta.integer_id            ,
                    'start_at'                    , ta.start_at              ,
                    'end_at'                      , ta.end_at                ,
                    'distance_meters'             , ta.distance_meters       ,
                    'operator_id'                 , ta.operator_id
                ) AS properties
                FROM (${unionString}) ta
                WHERE
                ta.status = 'occupied'
                AND ta.start_at BETWEEN (to_timestamp(?) AT time zone 'utc')
                    AND (to_timestamp(?) AT time zone 'utc')
            `+ taxisDbQueriesUtils.dataQualityString("ta") + taxisDbQueriesUtils.getFilterString(parameters) +`
                ORDER BY ${parameters.sampleSize !== null ? `RANDOM() LIMIT ${parameters.sampleSize}`: `ta.integer_id LIMIT ${parameters.limit} OFFSET ${parameters.offset}`}
            ) inputs
            ) features;
        `, [startAtEpoch, endAtEpoch]).then(function(response) {
            const geojson = _get(response, 'rows[0].geojson');
            geojson ? resolve(geojson) : reject(new TrError(
            'cannot fetch taxi activities destination geojson collection because database did not return a valid geojson',
            'DBQTAXISACOC0005',
            "OdTripOriginGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        }).catch(function(error) {
            reject(new TrError(
            `cannot fetch taxi activities destination geojson collection because of a database error (knex error: ${error})`,
            'DBQTAXISACOC0006',
            "OdTripOriginGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        });

        });
    });

  };

const removeDuplicates = async () => {
    try {
        const tableNames = await getAllTablesName();
        const promises = tableNames.map((tableName) => {
            try {
                knex.raw(`
                    DELETE
                    FROM ${tableName} ta
                    USING ${tableName} tb
                    WHERE ta.id > tb.id
                    AND ta.taxi_id = tb.taxi_id
                    AND ta.start_at = tb.start_at
                `);
            } catch(error) {
                throw new TrError(
                    `Cannot delete duplicates from table ${tableName} (knex error: ${error})`,
                    'DBQTAXISACOC0007',
                    "ObjectsCannotDeleteBecauseDatabaseError"
                );
            }
        });
        await Promise.all(promises);
    } catch(error) {
        throw new TrError(
            `Cannot delete duplicates activities (knex error: ${error})`,
            'DBQTAXISACOC0008',
            "ObjectsCannotDeleteBecauseDatabaseError"
        );
    }
}

const deleteMonthTableById = function(parameters = {}) {
    /* parameters:
    - tableId,
    */
    return new Promise(function(resolve, reject) {
        return knex('tr_taxi_activities_master').where('id', parameters.tableId).then(function(tableInfo) {
            if (tableInfo && tableInfo.length > 0) {
                    Promise.all([
                        knex('tr_taxi_activities_master').where('id', parameters.tableId).del(),
                        knex.schema.dropTable(tableInfo[0]['table_name'])
                    ]).then(() => resolve()).catch(function(error) {
                        reject(new TrError(
                            `Cannot delete table with id ${parameters.tableId} (knex error: ${error})`,
                            'DBQTAXISACOC0007',
                            "ObjectsCannotDeleteBecauseDatabaseError"
                        ));
                    });
            } else {
                resolve()
            }
        });
    })
}

const createMonthTable = async (parameters = {}) => {
    /* parameters:
    - dataSourceId,
    - tableName,
    - tableId
    - table_start_date
    */

    try {
        await knex.transaction(async (trx) => {
            await trx.raw(`
                CREATE TABLE ${parameters.tableName}
                (
                    id uuid NOT NULL DEFAULT gen_random_uuid(),
                    data_source_id uuid,
                    taxi_id uuid,
                    origin_geography geography(Point,4326),
                    destination_geography geography(Point,4326),
                    distance_meters integer,
                    start_at timestamp without time zone,
                    end_at timestamp without time zone,
                    preliminary_start_at timestamp without time zone,
                    preliminary_end_at timestamp without time zone,
                    operator_id uuid,
                    shape_id uuid,
                    status tr_taxi_status,
                    data json,
                    CONSTRAINT ${parameters.tableName}_pkey PRIMARY KEY (id),
                    CONSTRAINT ${parameters.tableName}_id_unique UNIQUE (id),
                    CONSTRAINT t${parameters.tableName}_operator_id_foreign FOREIGN KEY (operator_id)
                        REFERENCES tr_taxi_operators (id) MATCH SIMPLE
                        ON UPDATE NO ACTION
                        ON DELETE CASCADE,
                    CONSTRAINT ${parameters.tableName}_taxi_id_foreign FOREIGN KEY (taxi_id)
                        REFERENCES tr_taxis (id) MATCH SIMPLE
                        ON UPDATE NO ACTION
                        ON DELETE CASCADE
                )
            `);
            await trx.raw(`
                CREATE INDEX ${parameters.tableName}_destination_geography_index
                    ON ${parameters.tableName} USING gist
                    (destination_geography);

                CREATE INDEX ${parameters.tableName}_distance_meters_index
                    ON ${parameters.tableName} USING btree
                    (distance_meters);

                CREATE INDEX ${parameters.tableName}_operator_id_index
                    ON ${parameters.tableName} USING btree
                    (operator_id);

                CREATE INDEX ${parameters.tableName}_origin_geography_index
                    ON ${parameters.tableName} USING gist
                    (origin_geography);

                CREATE INDEX ${parameters.tableName}_status_index
                    ON ${parameters.tableName} USING btree
                    (status);

                CREATE INDEX ${parameters.tableName}_taxi_id_index
                    ON ${parameters.tableName} USING btree
                    (taxi_id);

                CREATE INDEX ${parameters.tableName}_start_at_index
                    ON ${parameters.tableName} USING btree
                    (start_at);

                CREATE INDEX ${parameters.tableName}_end_at_index
                    ON ${parameters.tableName} USING btree
                    (end_at);
            `);
            await trx("tr_taxi_activities_master").insert({
                id              : parameters.tableId,
                table_name      : parameters.tableName,
                start_date      : parameters.table_start_date,
                data_source_id  : parameters.dataSourceId,
            });
        });
    } catch (error) {
        throw new TrError(
            `cannot create new taxi month activity table because of a database error (knex error: ${error}) with parameters ${JSON.stringify(parameters)}`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        );
    }
}

const selectLastActivityStartTimestampForMonthTableCreation = function(parameters = {}) {
    /* parameters:
    - dataSourceId,
    */
   return new Promise(function(resolve, reject) {
     return knex.raw(`
       SELECT
        max(ta.end_at)
        FROM tr_taxi_activities ta
       WHERE
            ta.data_source_id = '${parameters.dataSourceId}'
            AND ta.end_at IS NOT NULL
     `).then(function(response) {
        const lastTimestamp = _get(response, 'rows');
        resolve(lastTimestamp[0].max);
     }).catch(function(error) {
       reject(new TrError(
         `cannot fetch taxi activity because of a database error (knex error: ${error})`,
         'DBQSELECTTAXIACC0002',
         "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
       ));
     });
   });
  };

  const selectFirstActivityStartTimestampForMonthTableCreation = function(parameters = {}) {
    /* parameters:
    - dataSourceId,
    */
   return new Promise(function(resolve, reject) {
     return knex.raw(`
       SELECT
        min(ta.start_at)
        FROM tr_taxi_activities ta
       WHERE
            ta.data_source_id = '${parameters.dataSourceId}'
            AND ta.start_at IS NOT NULL
     `).then(function(response) {
        const lastTimestamp = _get(response, 'rows');
        resolve(lastTimestamp[0].min);
     }).catch(function(error) {
       reject(new TrError(
         `cannot fetch taxi activity because of a database error (knex error: ${error})`,
         'DBQSELECTTAXIACC0002',
         "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
       ));
     });
   });
  };



const exportMonthTripToTable = function(parameters = {}) {
    /* parameters:
    - dataSourceId,
    - tableName,
    - table_start_date
    */

    const table_end_date = new Date(parameters.table_start_date)
    table_end_date.setMonth(table_end_date.getMonth() + 1)

    return new Promise(function(resolve, reject) {
        return knex.raw(`
            INSERT INTO ${parameters.tableName} (id, data_source_id, taxi_id, origin_geography, destination_geography, distance_meters, start_at, end_at, preliminary_start_at, preliminary_end_at, operator_id, shape_id, status, data)
            (SELECT
                id, data_source_id, taxi_id, origin_geography, destination_geography, distance_meters, start_at, end_at, preliminary_start_at, preliminary_end_at, operator_id, shape_id, status, data
            FROM tr_taxi_activities
            WHERE
                data_source_id = '${parameters.dataSourceId}'
                AND start_at >= to_timestamp(${parameters.table_start_date.getTime() / 1000}) AT time zone 'utc'
                AND start_at < to_timestamp(${table_end_date.getTime() / 1000}) AT time zone 'utc');
        `).then(() => resolve()).catch(function(error) {
          reject(new TrError(
            `cannot export taxi activity to month table because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
          ));
        });
      });}


const exists = async(id) => {
    try {
        const tableName = await getTableNameForId(id, false);
        return tableName !== undefined;
    } catch(error) {
        throw new TrError(
            `cannot see if activity existd because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        );
    }
}

const read = async (id) => {
    try {
        const tableName = await getTableNameForId(id, false);
        if (tableName === undefined) {
            throw new TrError(
                `Cannot find taxi activity with id ${id}`,
                'DBQSELECTTAXIACC0011',
                'DatabaseCannotReadBecauseObjectDoesNotExist'
            );
        }
        return await readForTable(knex, tableName, null, '*', id);
    } catch (error) {
        throw new TrError(
            `cannot read taxi activity because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        );
    }
}

const create = function(newObject, dataSourceId, returning = 'id') {
    /*WARNING new object must have a start_at argument and a datasourceId
    */
    return new Promise (function(resolve, reject) {
        getTableNameForDateAndDataSource(newObject.start_at.valueOf() / 1000, newObject.data_source_id).then(function(tableName) {
            if (tableName) {
                createForTable(
                    knex,
                    tableName,
                    function(data) { return attributesCleaner(data.attributes ? data.attributes : data);},
                    newObject,
                    returning = 'id'
                ).then((resp) => resolve(resp))
            } else {
                // if no table found for date and data source we create one
                //make table info
                const start = new Date(newObject.start_at.valueOf());
                const start_month   = start.getUTCMonth()
                const start_year    = start.getUTCFullYear()
                const table_start_date = moment(Date.UTC(start_year, start_month, 1))

                const table_uuid = uuidv4()
                const _tableName = `tr_taxi_activities_${table_uuid.toString().replaceAll('-', '_')}`

                //table is build with select into SQL methode
                createMonthTable({
                    dataSourceId,
                    tableName: _tableName,
                    tableId: table_uuid,
                    table_start_date
                }).then(function() {
                    createForTable(
                        knex,
                        _tableName,
                        function(data) { return attributesCleaner(data.attributes ? data.attributes : data);},
                        newObject,
                        returning = 'id'
                    ).then((resp) => resolve(resp))
                })
            }
        }).catch(function(error) {
            reject(new TrError(
              `cannot create taxi activity because of a database error (knex error: ${error})`,
              'DBQSELECTTAXIACC0002',
              "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
            ));
        });
    });
}

const createMultiple = async (newObjects, dataSourceId, returning = ['id']) => {
    try {
        //we create month tables first if needed. Otherwise, it will create a table for each activity in a batch.
        // for each month between first date and last date, we look for month table and create it if needed.

        const minDateTime = minBy(newObjects, 'start_at')['start_at'];
        const minStart = new Date(minDateTime.valueOf());
        const minDate_start_month   = minStart.getUTCMonth()
        const minDate_start_year    = minStart.getUTCFullYear()
        const minDate = new Date (Date.UTC(minDate_start_year, minDate_start_month, 1));

        const maxDateTime = maxBy(newObjects, 'end_at')['end_at'];
        const maxStart = new Date(maxDateTime.valueOf());
        const maxDate_start_month   = maxStart.getUTCMonth()
        const maxDate_start_year    = maxStart.getUTCFullYear()
        const maxDate = new Date (Date.UTC(maxDate_start_year, maxDate_start_month, 1));

        if (minDate && maxDate) {
            let currentDate = minDate;
            do {
                // loopDate is needed for copy issue
                const loopDate = moment(new Date(currentDate));
                const tableName = await getTableNameForDateAndDataSource(loopDate.valueOf() / 1000, dataSourceId);
                if (!tableName) {
                    const table_uuid = uuidv4()
                    const _tableName = `tr_taxi_activities_${table_uuid.toString().replaceAll('-', '_')}`
                    //table is build with select into SQL methode
                    await createMonthTable({
                        dataSourceId,
                        tableName: _tableName,
                        tableId: table_uuid,
                        table_start_date: loopDate
                    });
                }
                currentDate = new Date(currentDate.setUTCMonth(currentDate.getUTCMonth()+1));
            } while(currentDate <= maxDate);
        }

        //creation of trips
        const tblPromises = newObjects.map(newObject => getTableNameForDateAndDataSource(newObject.start_at.valueOf() / 1000, newObject.data_source_id));
        const tables = await Promise.all(tblPromises);
        const tblToObject = {};
        tables.forEach((tbl, index) => {
            if (!tblToObject[tbl]) {
                tblToObject[tbl] = [];
            }
            tblToObject[tbl].push(newObjects[index]);
        });
        const createMultiplePromises = Object.keys(tblToObject).map(tbl =>
            createMultipleForTable(knex,
                tbl,
                function(data) { return attributesCleaner(data.attributes ? data.attributes : data);},
                tblToObject[tbl]
            )
        );
        return await Promise.all(createMultiplePromises);
    } catch (error) {
        throw new TrError(
            `cannot create multiple taxi activities because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        );
    }
}


const update = async (id, attributes, table_name = null, returning = 'id', trx = undefined) => {
    try {
        const tblName = table_name ? table_name : await getTableNameForId(id);
        if (tblName) {
            return await updateForTable(
                trx !== undefined ? trx : knex,
                tblName,
                (data) => attributesCleaner(data.attributes ? data.attributes : data),
                id,
                attributes,
                returning
            );
        }
        throw `Activity with ID does not exist`;
    } catch (error) {
        throw new TrError(
            `cannot update taxi activity because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiActivityCouldNotBeUpdatedBecauseDatabaseError"
        );
    }
}

const updateMultiple = async function(attributeCollection, table_names = null, returning = 'id') {
    try {
        const batchSize = 100;
        let index = 0;
        //next function is used not to overlaod memory and send promises in batch
        const next = async (trx) => {
            if (index*batchSize < attributeCollection.length) {
                const loopArray = attributeCollection.slice(index*batchSize, Math.min((index+1)*batchSize, attributeCollection.length));
                const looptableNames = table_names ? table_names.slice(index*batchSize, Math.min((index+1)*batchSize, attributeCollection.length)) : null;
                const updates = loopArray.map((attributes, idx) => update(attributes.id, attributes, table_names?looptableNames[idx]:null, returning, trx));
                await Promise.all(updates);
                index++
                await next(trx);
            }
        }
        return await knex.transaction(async trx => {
            // start first iteration
            await next(trx);
        });
    } catch(error) {
        throw new TrError(
            `cannot update multiple taxi activities because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        );
    }
}




const truncate = async() => {
    try {
        const response = await knex.raw(`
            SELECT id, table_name
            FROM tr_taxi_activities_master
        `);
        const rows = response.rows;
        for (let row of rows) {
            await knex.transaction(async trx => {
                await truncateForTable(trx, row['table_name']);
                await trx.raw(`DROP TABLE ${row.table_name}`);
                await trx.table('tr_taxi_activities_master').where('id', row['id']).del();
            });
        }
    } catch (error) {
        throw new TrError(
            `cannot truncate taxi activity table because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        );
    }
}

const _delete = async (idWithStartTime, dataSourceId = undefined) => {
    try {
        const idToDelete = idWithStartTime.id !== undefined ? idWithStartTime.id : idWithStartTime;
        const tableName = await (idWithStartTime.start_at !== undefined && dataSourceId !== undefined ? getTableNameForDateAndDataSource(idWithStartTime.start_at, dataSourceId) : getTableNameForId(idToDelete));
        if (!tableName) {
            throw `Activity with id ${idToDelete} does not exist`;
        }
        const id2 = await _deleteForTable(knex, tableName, idToDelete);
        return id2;
    } catch (error) {
        throw new TrError(
            `cannot destroy taxi activity because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        );
    }
}

/**
 * Delete multiple activities
 * @param {*} idsWithStartTime either the ID, or an object with { id: <id>, start_at: <timestamp in epoch } to speed up finding the table
 * @param {*} dataSourceId
 */
const deleteMultiple = async (idsWithStartTime, dataSourceId = undefined) => {
    try {
        //creation of trips
        const batchSize = 100;
        let index = 0;
        // Do inserts in batch. The create method needs to be called as all activities don't go in same table
        // TODO use knex.batchInsert by dividing activities in to target tables
        const next = async () => {
            const loopArray = idsWithStartTime.slice(index*batchSize, Math.min((index+1)*batchSize, idsWithStartTime.length));
            const deletions = loopArray.map((idWithStartTime) => _delete(idWithStartTime, dataSourceId));
            await Promise.all(deletions);
        };
        while (index * batchSize < idsWithStartTime.length) {
            await next();
            index++;
        }
    } catch (error) {
        throw new TrError(
            `cannot delete multiple taxi activities because of a database error (knex error: ${error})`,
            'DBQSELECTTAXIACC0002',
            "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
        );
    }
}

const deleteForDataSourceId = async (dataSourceId) => {
    const monthTables = await getAllTablesForDataSource({dataSourceId});
    await Promise.all(monthTables.map(table_info => deleteMonthTableById({tableId : table_info['id']})));
}



export default {
  getAllTablesForDataSource,
  getTablesNameForDateRangeAndDataSource,
  exists,
  read,
  create,
  createMultiple,
  update,
  updateMultiple,
  delete : _delete,
  deleteMultiple,
  truncate,
  destroy              : destroy.bind(null,        knex),
  deleteForDataSourceId,
  collection,
  originGeojsonCollection,
  destinationGeojsonCollection,
  selectActivity,
  selectLastTaxiActivityBeforeTimestamp,
  selectLastActivityTimestamp,
  selectFirsActivityTimestamp,
  selectNextTaxiActivitiesAfterTimestamp,
  originGeojsonCollectionForDataSourcesAndTimeRange,
  destinationGeojsonCollectionForDataSourcesAndTimeRange,
  removeDuplicates,
  deleteMonthTableById,
  selectLastActivityStartTimestampForMonthTableCreation,
  selectFirstActivityStartTimestampForMonthTableCreation,
  exportMonthTripToTable
};
