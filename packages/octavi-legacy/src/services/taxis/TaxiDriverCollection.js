import _get from 'lodash/get';

import TaxiDriver             from './TaxiDriver';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';

/**
 * A collection of taxi drivers
 */
class TaxiDriverCollection extends GenericObjectCollection {

  constructor(features, attributes, eventManager) {
    super(features, attributes, true, false);
  }

  forCsv() {
    return this.features.map(function(taxiDriver) {
      return {
        uuid          : taxiDriver.attributes.id,
        integer_id    : taxiDriver.attributes.integer_id,
        internal_id   : taxiDriver.attributes.internal_id,
        first_name    : taxiDriver.attributes.first_name,
        last_name     : taxiDriver.attributes.last_name,
        email         : taxiDriver.attributes.email,
        department    : taxiDriver.attributes.department
      }
    });
  }

  newObject(attribs, isNew = false, collectionManager) {
    return new TaxiDriver(attribs, isNew, collectionManager);
  }

  loadFromServer(socket, collectionManager) {
    return CollectionLoadable.loadFromServer.call(this, socket, collectionManager);
  }

  loadFromCollection(collection, collectionManager) {
    return CollectionLoadable.loadFromCollection.call(this, collection, collectionManager);
  }
}

TaxiDriverCollection.instanceClass = TaxiDriver;
TaxiDriverCollection.socketPrefix  = 'taxiDrivers';
TaxiDriverCollection.displayName   = 'TaxiDriverCollection';

export default TaxiDriverCollection
