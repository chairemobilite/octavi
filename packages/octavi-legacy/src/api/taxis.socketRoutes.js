import _get   from 'lodash/get';
import geobuf from 'geobuf';
import Pbf    from 'pbf';

import * as Status from 'chaire-lib-common/lib/utils/Status';

import TaxiDriverCollection    from '../services/taxis/TaxiDriverCollection';
import TaxiPermitCollection    from '../services/taxis/TaxiPermitCollection';
import TaxiVehicleCollection   from '../services/taxis/TaxiVehicleCollection';
import TaxiCollection          from '../services/taxis/TaxiCollection';
import taxiDriversDbQueries    from '../models/db/taxiDrivers.db.queries';
import taxiPermitsDbQueries    from '../models/db/taxiPermits.db.queries';
import taxiVehiclesDbQueries   from '../models/db/taxiVehicles.db.queries';
import taxiActivitiesDbQueries from '../models/db/taxiActivities.db.queries';
import taxisDbQueries          from '../models/db/taxis.db.queries';
import taxisDbQueriesUtils     from '../models/db/taxiUtils.db.queries';

// FIXME Do we need those object routes in Octavi? Data is never imported/edited from the UI
const transitClassesConfig = {
  taxiDrivers: {
    lowerCaseName      : 'taxiDriver',
    lowerCaseNamePlural: 'taxiDrivers',
    className          : 'TaxiDriver',
    classNamePlural    : 'TaxiDrivers',
    dbQueries          : taxiDriversDbQueries,
    cacheQueries       : null,
    collection         : new TaxiDriverCollection([])
  },
  taxiPermits: {
    lowerCaseName      : 'taxiPermit',
    lowerCaseNamePlural: 'taxiPermits',
    className          : 'TaxiPermit',
    classNamePlural    : 'TaxiPermits',
    hasIntegerId       : true,
    dbQueries          : taxiPermitsDbQueries,
    cacheQueries       : null,
    collection         : new TaxiPermitCollection([])
  },
  taxiVehicles: {
    lowerCaseName      : 'taxiVehicle',
    lowerCaseNamePlural: 'taxiVehicles',
    className          : 'TaxiVehicle',
    classNamePlural    : 'TaxiVehicles',
    dbQueries          : taxiVehiclesDbQueries,
    cacheQueries       : null,
    collection         : new TaxiVehicleCollection([])
  },
  taxis: {
    lowerCaseName      : 'taxi',
    lowerCaseNamePlural: 'taxis',
    className          : 'Taxi',
    classNamePlural    : 'Taxis',
    hasIntegerId       : true,
    dbQueries          : taxisDbQueries,
    cacheQueries       : null,
    collection         : new TaxiCollection([])
  }
};

export default function (socket) {

  for(const lowerCasePlural in transitClassesConfig)
  {
    const taxiClassConfig = transitClassesConfig[lowerCasePlural];

    socket.on(`${taxiClassConfig.lowerCaseName}.create`, function(attributes, callback) {
      const returningArray = taxiClassConfig.hasIntegerId ? ['id', 'integer_id'] : ['id'];
      taxiClassConfig.dbQueries.create(attributes, returningArray).then(function(returning) {
        callback({
          ...returning,
          error: null
        });
      }).catch(function(error){
        console.error(error);
        callback(error.export());
      });
    });

    socket.on(`${taxiClassConfig.lowerCaseName}.read`, function(id, customCachePath, callback) {
      taxiClassConfig.dbQueries.read(id).then(function(object) {
        callback({
          [taxiClassConfig.lowerCaseName]: object.attributes ? object.attributes: object,
          error  : null
        });
      }).catch(function(error){
        console.error(error);
        callback(error.export());
      });
    });

    socket.on(`${taxiClassConfig.lowerCaseName}.update`, function(id, attributes, callback) {
      taxiClassConfig.dbQueries.update(id, attributes).then(function(updatedId) {
        callback({
          id     : updatedId,
          error  : null
        });
      }).catch(function(error){
        console.error(error);
        callback(error.export());
      });
    });

    socket.on(`${taxiClassConfig.lowerCaseName}.delete`, function(id, customCachePath, callback) {
      taxiClassConfig.dbQueries.delete(id).then(function(deletedId) {
        callback({
          id     : deletedId,
          error  : null
        });
      }).catch(function(error){
        console.error(error);
        callback(error.export());
      });
    });

    if (taxiClassConfig.dbQueries.geojsonCollection)
    {
      socket.on(`${taxiClassConfig.classNamePlural}.geojsonCollection`, function(params = { format: 'geojson' }, callback) {

        taxiClassConfig.dbQueries.geojsonCollection().then(function(geojson) {
          if (params.format === 'geobuf')
          {
            const geobufjson = Buffer.from(geobuf.encode(geojson, new Pbf()));
            callback({
              geobuf: geobufjson,
              error  : null
            });
          }
          else
          {
            callback({
              geojson,
              error  : null
            });
          }
        }).catch(function(error){
          console.error(error);
          callback(error.export());
        });
      });
    }

    if (taxiClassConfig.dbQueries.collection)
    {

      socket.on(`${taxiClassConfig.lowerCaseNamePlural}.collection`, function(dataSourceId, callback) {
        taxiClassConfig.dbQueries.collection(dataSourceId).then(function(collection) {
          callback({
            collection,
            error  : null
          });
        }).catch(function(error){
          console.error(error);
          callback(error.export());
        });
      });
    }

  }

  socket.on(`taxi.totalCount.timeRange`, async function(parameters, callback) {
    let statType;
    switch (parameters.type) {
        case ('discrete'):
            statType = 'count'
            break
        case ('continuous'):
            statType = 'sum'
            break
        default:
            statType = 'count'
            break
    }
    const paramWithStatType = {
        ...parameters,
        statType: statType
    }
    try {
        const response = await taxisDbQueriesUtils.getActiveObjectStatForDataSourcesAndTimeRange(paramWithStatType);
        callback(Status.createOk({
            ...response
        }));
    } catch(error){
        console.error(error);
        callback(Status.createError(typeof error.export === 'function' ? error.export() : { error: 'UnknownErrorInTaxiQuery'}));
    };
  });

  socket.on(`taxi.totalCount.byPeriod.timeRange`, async function(parameters, callback) {
    let statType;
    switch (parameters.type) {
        case ('discrete'):
            statType = 'count'
            break
        case ('continuous'):
            statType = 'sum'
            break
        default:
            statType = 'count'
            break
    }
    const paramWithStatType = {
        ...parameters,
        statType: statType
    }
    try {
        const response = await taxisDbQueriesUtils.getActiveObjectStatDistributionByTimePeriodDataSourcesAndTimeRange(paramWithStatType);
        callback(Status.createOk({
            ...response
        }));
    } catch(error){
        console.error(error);
        callback(Status.createError(typeof error.export === 'function' ? error.export() : { error: 'UnknownErrorInTaxiQuery'}));
    };
  });

  socket.on(`taxi.totalCount.byZone.timeRange`, async function(parameters, callback) {
    let statType;
    switch (parameters.type) {
        case ('discrete'):
            statType = 'count'
            break
        case ('continuous'):
            statType = 'sum'
            break
        default:
            statType = 'count'
            break
    }
    const paramWithStatType = {
        ...parameters,
        statType: statType
    }
    try {
        const response = await taxisDbQueriesUtils.getActiveObjectStatDistributionBySpatialZoneDataSourcesAndTimeRange(paramWithStatType);
        callback(Status.createOk({
            ...response
        }));
    } catch(error){
        console.error(error);
        callback(Status.createError(typeof error.export === 'function' ? error.export() : { error: 'UnknownErrorInTaxiQuery'}));
    };
  });

  socket.on(`taxi.totalCount.byObject.timeRange`, async function(parameters, callback) {
    let statType;
    switch (parameters.type) {
        case ('discrete'):
            statType = 'count'
            break
        case ('continuous'):
            statType = 'sum'
            break
        default:
            statType = 'count'
            break
    }
    const paramWithStatType = {
        ...parameters,
        statType: statType
    }
    try {
        const response = await taxisDbQueriesUtils.getActiveObjectStatDistributionByObjectDataSourcesAndTimeRange(paramWithStatType);
        callback(Status.createOk({
            ...response
        }));
    } catch(error){
        console.error(error);
        callback(Status.createError(typeof error.export === 'function' ? error.export() : { error: 'UnknownErrorInTaxiQuery'}));
    };
  });

  socket.on(`taxi.count.byWeekday.timeRange`, async function(parameters, callback) {
    let statType;
    switch (parameters.type) {
        case ('discrete'):
            statType = 'count'
            break
        case ('continuous'):
            statType = 'sum'
            break
        default:
            statType = 'count'
            break
    }
    const paramWithStatType = {
        ...parameters,
        statType: statType
    }
    try {
        const response = await taxisDbQueriesUtils.getActiveObjectStatDistributionByPeriodDataSourcesAndTimeRange(paramWithStatType, 'ISODOW');
        callback(Status.createOk({
            ...response
        }));
    } catch(error){
        console.error(error);
        callback(Status.createError(typeof error.export === 'function' ? error.export() : { error: 'UnknownErrorInTaxiQuery'}));
    };
  });

  socket.on(`taxi.count.byHour.timeRange`, async function(parameters, callback) {
    let statType;
    switch (parameters.type) {
        case ('discrete'):
            statType = 'count'
            break
        case ('continuous'):
            statType = 'sum'
            break
        default:
            statType = 'count'
            break
    }
    const paramWithStatType = {
        ...parameters,
        statType: statType
    }
    try {
        const response = await taxisDbQueriesUtils.getActiveObjectStatDistributionByPeriodDataSourcesAndTimeRange(paramWithStatType, 'HOUR');
        callback(Status.createOk({
            ...response
        }));
    } catch(error){
        console.error(error);
        callback(Status.createError(typeof error.export === 'function' ? error.export() : { error: 'UnknownErrorInTaxiQuery'}));
    };
  });


  socket.on(`taxiTrips.originGeojsonCollection.timeRange`, function(parameters, callback) {
    taxiActivitiesDbQueries.originGeojsonCollectionForDataSourcesAndTimeRange(parameters).then(function(geojson) {
      if (parameters.format === 'geobuf')
      {
        const geobufjson = Buffer.from(geobuf.encode(geojson, new Pbf()));
        callback({
          geobuf: geobufjson,
          error  : null
        });
      }
      else
      {
        callback({
          geojson,
          error  : null
        });
      }
    }).catch(function(error){
      console.error(error);
      callback(error.export());
    });
  });


  socket.on(`taxiTrips.destinationGeojsonCollection.timeRange`, function(parameters, callback) {
    taxiActivitiesDbQueries.destinationGeojsonCollectionForDataSourcesAndTimeRange(parameters).then(function(geojson) {
      if (parameters.format === 'geobuf')
      {
        const geobufjson = Buffer.from(geobuf.encode(geojson, new Pbf()));
        callback({
          geobuf: geobufjson,
          error  : null
        });
      }
      else
      {
        callback({
          geojson,
          error  : null
        });
      }
    }).catch(function(error){
      console.error(error);
      callback(error.export());
    });
  });

}
