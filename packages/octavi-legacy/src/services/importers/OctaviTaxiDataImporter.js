import moment from 'moment';
import { point as turfPoint } from '@turf/turf';

import CollectionImporter      from './CollectionImporter';
import { _isBlank }            from 'chaire-lib-common/lib/utils/LodashExtensions';
import TaxiOperator            from '../taxis/TaxiOperator';
import TaxiActivity            from '../taxis/TaxiActivity';
import serviceLocator          from 'chaire-lib-common/lib/utils/ServiceLocator';
import { fileManager }         from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import taxiOperatorsDbQueries  from '../../models/db/taxiOperators.db.queries';

class OctaviTaxiDataImporter extends CollectionImporter {

  constructor(attributes) {

    super(attributes, false);

    this._taxiCollection      = serviceLocator.collectionManager.get('taxis');
    this._driversCollection   = serviceLocator.collectionManager.get('taxiDrivers');
    this._permitsCollection   = serviceLocator.collectionManager.get('taxiPermits');
    this._vehiclesCollection  = serviceLocator.collectionManager.get('taxiVehicles');
    this._operatorsCollection = serviceLocator.collectionManager.get('taxiOperators');

  }

  getEtag (objectsName) {
    return fileManager.readFile(`imports/etag_${objectsName}.txt`);
  }

  updateEtag(newEtag, objectsName) {
    fileManager.writeFile(`imports/etag_${objectsName}.txt`, newEtag);
  }

  async updateTaxiObjects(parameters = {}) {
    /*
    Parameters:

    objectsName,
    objectClass,
    dbQueries,
    parser,
    collection,
    btmServiceFunction
    dataSourceId,
    updateEtag

    */

    console.log(`updating ${parameters.objectsName}`);

    const currentEtag = this.getEtag(parameters.objectsName);
    const taxiObjectsResponse = await parameters.btmServiceFunction({etag: currentEtag});
    if (taxiObjectsResponse.status === 'NotModified') {
        console.log(`No changes since last check for '${parameters.objectsName}'`);
        return;
    }
    const taxiObjectsCount  = taxiObjectsResponse.length ? taxiObjectsResponse.length : 0;

    const updatedTaxiObjectsAttributes = [];
    const newTaxiObjectsAttributes     = [];

    for (let i = 0; i < taxiObjectsCount; i++)
    {
      const taxiObjectData       = taxiObjectsResponse[i];
      const taxiObjectInternalId = taxiObjectData.id.toString();

      const taxiObject = parameters.collection.getByInternalId(taxiObjectInternalId);

    //   const existingTaxiObject   = parameters.collection.getByInternalId(taxiObjectInternalId.toString());

      if (taxiObject !== undefined && taxiObject !== null)
      {

        const existingUpdatedAtRaw = taxiObject.get('last_updated_at');
        const existingUpdatedAt    = existingUpdatedAtRaw          ? moment(existingUpdatedAtRaw)          : moment(taxiObject.get('added_at'));
        const dataUpdatedAt        = taxiObjectData.last_update_at ? moment(taxiObjectData.last_update_at) : moment(taxiObjectData.added_at);

        if (dataUpdatedAt.diff(existingUpdatedAt) > 0) // response data is newer than existing data
        {
          // We need to update the existing data:
          //if object type is taxi, parser takes other collection (drivers, permits, vehicules) as arguement
          if (parameters.objectsName == "taxis") {
            taxiObject.mergeAttributes(parameters.parser(taxiObjectData, parameters.dataSourceId, this._driversCollection, this._permitsCollection, this._vehiclesCollection)); //ask what is data source
          }
          // for other types parser only takes data
          else {
            taxiObject.mergeAttributes(parameters.parser(taxiObjectData));
          }
          updatedTaxiObjectsAttributes.push(taxiObject.attributes);
        } // do nothing if no change
      }
      else // new taxiObject data
      {
        const newTaxiObject = new parameters.objectClass(parameters.parser(taxiObjectData, parameters.dataSourceId, this._driversCollection, this._permitsCollection, this._vehiclesCollection), true, serviceLocator.collectionManager);
        newTaxiObjectsAttributes.push(newTaxiObject.attributes);
      }

    }

    // save new taxiObjects and update existing taxiObjects in database:
    const createTaxiObjectsResponse = await parameters.dbQueries.createMultiple(newTaxiObjectsAttributes);
    console.log(`  ${newTaxiObjectsAttributes.length} created ${parameters.objectsName}`);
    const updateTaxiObjectsResponse = await parameters.dbQueries.updateMultiple(updatedTaxiObjectsAttributes);
    console.log(`  ${updatedTaxiObjectsAttributes.length} updated ${parameters.objectsName}`);

    // finaly once everything was ok update etag:
    if (parameters.updateEtag && taxiObjectsResponse.etag && taxiObjectsResponse.etag !== currentEtag)
    {
        this.updateEtag(taxiObjectsResponse.etag, parameters.objectsName);
        console.log(`   ${parameters.objectsName} etag updated`)
    }
  }

  // async updateTaxiOperators()

  shouldKeepActivity(activity) {
    //  filter data
    const distance_meters = activity.distance_meters;
    const startAt         = activity.start_at;
    const endAt           = activity.end_at;
    const duration_min = (endAt - startAt) / 60000
    const speed_kph    = (distance_meters / 1000 ) / (duration_min / 60)

    const filterDuration_min = (1.5 < duration_min)    && (duration_min < 180)
    const filterDistance_m   = activity.status === 'occupied' ? (400 < distance_meters) && (distance_meters < 250000) : true
    const filterSpeed_kph    = activity.status === 'occupied' ? (4 < speed_kph)         && (speed_kph < 120) : true
    return filterDuration_min && filterDistance_m && filterSpeed_kph;
  }

  async filterTaxiActivity(dataActivity, dataSourceId, activitiesAttributesForDatabase, endTime = undefined, isLastActivity = false) {
    const taxiInternalId   = dataActivity.taxi;

    //  filter data
    const activityPre = {
        status               : dataActivity.status,
        start_at             : moment.unix(dataActivity.o_timestamp),
        end_at               : moment.unix(dataActivity.d_timestamp),
        distance_meters      : !_isBlank(dataActivity.distance_totale) ? dataActivity.distance_totale : null,
    }
    const shouldKeepActivity = this.shouldKeepActivity(activityPre);
    // If the activity is the last of the period and it ends less than one minute before the end, accept it
    const isAtPeriodEnd = isLastActivity && endTime !== undefined ? ((endTime - activityPre.end_at) / 1000) < 60 : false;
    if (isAtPeriodEnd || shouldKeepActivity) {
        // get or create operator
        let operator = this._operatorsCollection.getByInternalId(dataActivity.operator);

        if (!operator) {
            operator = new TaxiOperator({
                email      : dataActivity.operator,
                internal_id: dataActivity.operator
            });
            await taxiOperatorsDbQueries.create(operator);
            await this._operatorsCollection.add(operator);
        }

        // check if taxi exists in db
        const taxi = this._taxiCollection.getByInternalId(taxiInternalId);
        if (!taxi) {
            console.error(`taxi with internal id ${taxiInternalId} was not found in database.`);
            return;
        }
        const originGeography      = turfPoint([parseFloat(dataActivity.o_lon), parseFloat(dataActivity.o_lat)]).geometry;
        const destinationGeography = turfPoint([parseFloat(dataActivity.d_lon), parseFloat(dataActivity.d_lat)]).geometry;

        const taxiActivity = new TaxiActivity({
            data_source_id       : dataSourceId,
            taxi_id              : taxi.getId(),
            origin_geography     : originGeography,
            destination_geography: destinationGeography,
            operator_id          : operator.id,
            ...activityPre
        });
        activitiesAttributesForDatabase.push(taxiActivity.attributes);
    }
  }

  async fetchTaxiPositions(parameters = {}) {
        /*
    Parameters:

    date,
    btmServiceFunction

    */
    const taxiPostionsResponse = await parameters.btmServiceFunction({
      year: parameters.date.getUTCFullYear(),
      month: parameters.date.getUTCMonth() + 1,
      day: parameters.date.getUTCDate(),
      hour: parameters.date.getUTCHours(),
      minute: parameters.date.getUTCMinutes()
    });
    return taxiPostionsResponse
  }

}

export default OctaviTaxiDataImporter
