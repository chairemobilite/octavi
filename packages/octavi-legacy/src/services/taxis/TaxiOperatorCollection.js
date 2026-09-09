import _get from 'lodash/get';

import TaxiOperator           from './TaxiOperator';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';

/**
 * A collection of taxi operators
 */
class TaxiOperatorCollection extends GenericObjectCollection {

  constructor(features, attributes, eventManager) {
    super(features, attributes, true, false);
  }

  forCsv() {
    return this.features.map(function(taxiOperator) {
      return {
        uuid          : taxiOperator.attributes.id,
        integer_id    : taxiOperator.attributes.integer_id,
        internal_id   : taxiOperator.attributes.internal_id,
        shortname     : taxiOperator.attributes.shortname,
        name          : taxiOperator.attributes.name,
        email         : taxiOperator.attributes.email
      }
    });
  }

  newObject(attribs, isNew = false, collectionManager) {
    return new TaxiOperator(attribs, isNew, collectionManager);
  }

  loadFromServer(socket, collectionManager) {
    return CollectionLoadable.loadFromServer.call(this, socket, collectionManager);
  }

  loadFromCollection(collection, collectionManager) {
    return CollectionLoadable.loadFromCollection.call(this, collection, collectionManager);
  }
}

TaxiOperatorCollection.instanceClass = TaxiOperator;
TaxiOperatorCollection.socketPrefix  = 'taxiOperators';
TaxiOperatorCollection.displayName   = 'TaxiOperatorCollection';

export default TaxiOperatorCollection
