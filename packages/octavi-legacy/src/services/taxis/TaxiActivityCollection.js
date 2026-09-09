import _get from 'lodash/get';

import TaxiActivity             from './TaxiActivity';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';

/**
 * A collection of taxi activities
 */
class TaxiActivityCollection extends GenericObjectCollection {

  constructor(features, attributes, eventManager) {
    super(features, attributes);
  }

  newObject(attribs, isNew = false, collectionManager) {
    return new TaxiActivity(attribs, isNew, collectionManager);
  }

  loadFromServer(socket, collectionManager) {
    return CollectionLoadable.loadFromServer(this, socket, collectionManager);
  }

  loadFromServerByFilter(socket, collectionManager, filter) {
    return CollectionLoadable.loadFromServerByFilter(this, socket, collectionManager, null, null, filter);
  }

  loadFromCollection(collection, collectionManager) {
    return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
  }
}

TaxiActivityCollection.instanceClass = TaxiActivity;
TaxiActivityCollection.socketPrefix  = 'taxiActivities';
TaxiActivityCollection.displayName   = 'TaxiActivityCollection';

export default TaxiActivityCollection
