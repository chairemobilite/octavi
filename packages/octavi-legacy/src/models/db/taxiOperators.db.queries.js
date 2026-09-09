import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import _get        from 'lodash/get';
import _set        from 'lodash/set';
import _cloneDeep  from 'lodash/cloneDeep';

import { exists, read, create, createMultiple, update, updateMultiple, deleteRecord, deleteMultiple, deleteForDataSourceId, truncate, destroy, stringifyDataSourceIds } from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

const tableName = 'tr_taxi_operators';

const attributesCleaner = function(attributes) {
    const _attributes = _cloneDeep(attributes);
    delete _attributes.is_frozen;
    return _attributes;
};

const collection = function(dataSourceIds, sampleSize = null) {
  const dataSourceIdsStr = stringifyDataSourceIds(dataSourceIds);
  return new Promise(function(resolve, reject) {
    // cannot us "to" as the table alias, since it is a reserved word in postgresql
    return knex.raw(`
      SELECT
        top.*
      FROM ${tableName} top
      ${dataSourceIdsStr.length > 0 ? `WHERE top.data_source_id IN (${dataSourceIdsStr.join(',')})`: ''}
      ORDER BY ${sampleSize !== null ? `RANDOM() LIMIT ${sampleSize}`: 'top.integer_id'};
    `).then(function(response) {
      const collection = _get(response, 'rows');
      collection ? resolve(collection) : reject(new TrError(
        'cannot fetch taxi operators collection because database did not return a valid array',
        'DBQTAXIOPC0001',
        "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
      ));
    }).catch(function(error) {
      reject(new TrError(
        `cannot fetch taxi operators collection because of a database error (knex error: ${error})`,
        'DBQTAXIOPC0002',
        "TaxiCollectionCouldNotBeFetchedBecauseDatabaseError"
      ));
    });
  });
};

export default {
  exists               : exists.bind(null,   knex, tableName),
  read                 : read.bind(null,     knex, tableName, null, `*`),
  create               : create.bind(null,   knex, tableName, function(data) {
    return attributesCleaner(data.attributes ? data.attributes : data);
  }),
  createMultiple       : createMultiple.bind(null, knex, tableName, function(data) {
    return attributesCleaner(data.attributes ? data.attributes : data);
  }),
  update               : update.bind(null,   knex, tableName, function(data) {
    return attributesCleaner(data.attributes ? data.attributes : data);
  }),
  updateMultiple : updateMultiple.bind(null, knex, tableName, function(data) {
    return attributesCleaner(data.attributes ? data.attributes : data);
  }),
  delete               : deleteRecord.bind(null,        knex, tableName),
  deleteMultiple       : deleteMultiple.bind(null, knex, tableName),
  truncate             : truncate.bind(null,       knex, tableName),
  destroy              : destroy.bind(null,        knex),
  deleteForDataSourceId: deleteForDataSourceId.bind(null, knex, tableName),
  collection,
};
