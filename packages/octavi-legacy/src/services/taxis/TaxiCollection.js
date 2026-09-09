import _get from 'lodash/get';

import Taxi                   from './Taxi';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';

/**
 * A collection of transit taxis
 */
class TaxiCollection extends GenericObjectCollection {

  constructor(features, attributes, eventManager) {
    super(features, attributes, true, false);

  }

  forCsv() {
    return this.features.map(function(taxi) {
      return {
        uuid           : taxi.attributes.id,
        data_source_id : taxi.attributes.data_source_id,
        integer_id     : taxi.attributes.integer_id,
        internal_id    : taxi.attributes.internal_id,
        rating         : taxi.attributes.rating,
        driver_id      : taxi.attributes.driver_id,
        permit_id      : taxi.attributes.permit_id,
        vehicle_id     : taxi.attributes.vehicle_id
      }
    });
  }

  newObject(attribs, isNew = false, collectionManager) {
    return new Taxi(attribs, isNew, collectionManager);
  }

  loadFromServer(socket, collectionManager) {
    return CollectionLoadable.loadFromServer(this, socket, collectionManager);
  }

  loadFromCollection(collection, collectionManager) {
    return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
  }
}

TaxiCollection.instanceClass = Taxi;
TaxiCollection.socketPrefix  = 'taxis';
TaxiCollection.displayName   = 'TaxiCollection';

export default TaxiCollection
