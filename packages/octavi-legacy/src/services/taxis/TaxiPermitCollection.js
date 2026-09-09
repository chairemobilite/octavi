import _get from 'lodash/get';

import TaxiPermit             from './TaxiPermit';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';


/**
 * A collection of taxi permits
 */
class TaxiPermitCollection extends GenericObjectCollection {

  constructor(features, attributes, eventManager) {
    super(features, attributes, true, false);
  }

  forCsv() {
    return this.features.map(function(taxiPermit) {
      return {
        uuid            : taxiPermit.attributes.id,
        integer_id      : taxiPermit.attributes.integer_id,
        internal_id     : taxiPermit.attributes.internal_id,
        permit_id       : taxiPermit.attributes.permit_id,
        permit_zone_id  : taxiPermit.attributes.permit_zone_id,
        permit_zone_name: taxiPermit.attributes.permit_zone_name,
        btm_vignette_id : taxiPermit.attributes.btm_vignette_id,
        owner_name      : taxiPermit.attributes.owner_name,
        owner_type      : taxiPermit.attributes.owner_type
      }
    });
  }

  newObject(attribs, isNew = false, collectionManager) {
    return new TaxiPermit(attribs, isNew, collectionManager);
  }

  loadFromServer(socket, collectionManager) {
    return CollectionLoadable.loadFromServer(this, socket, collectionManager);
  }

  loadFromCollection(collection, collectionManager) {
    return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
  }
}

TaxiPermitCollection.instanceClass = TaxiPermit;
TaxiPermitCollection.socketPrefix  = 'taxiPermits';
TaxiPermitCollection.displayName   = 'TaxiPermitCollection';

export default TaxiPermitCollection
