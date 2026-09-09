import _get from 'lodash/get';

import TaxiVehicle            from './TaxiVehicle';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';


/**
 * A collection of taxi vehicles
 */
class TaxiVehicleCollection extends GenericObjectCollection {

  constructor(features, attributes) {
    super(features, attributes, true, false);
  }

  forCsv() {
    return this.features.map(function(taxiVehicle) {
      return {
        uuid                             : taxiVehicle.attributes.id,
        integer_id                       : taxiVehicle.attributes.integer_id,
        internal_id                      : taxiVehicle.attributes.internal_id,
        license_plate                    : taxiVehicle.attributes.license_plate,
        model                            : taxiVehicle.attributes.model,
        constructor                      : taxiVehicle.attributes.constructor,
        model_year                       : taxiVehicle.attributes.model_year,
        number_of_seats                  : taxiVehicle.attributes.number_of_seats,
        vehicle_type                     : taxiVehicle.attributes.vehicle_type,
        color                            : taxiVehicle.attributes.color,
        is_private                       : taxiVehicle.attributes.is_private,
        is_temporary_replacement         : taxiVehicle.attributes.is_temporary_replacement,
        is_special_need_vehicle          : taxiVehicle.attributes.is_special_need_vehicle,
        is_luxury                        : taxiVehicle.attributes.is_luxury,
        accepts_credit_card              : taxiVehicle.attributes.accepts_credit_card,
        accepts_paypass                  : taxiVehicle.attributes.accepts_paypass,
        accepts_amex                     : taxiVehicle.attributes.accepts_amex,
        accepts_bank_checks              : taxiVehicle.attributes.accepts_bank_checks,
        offers_fresh_drinks              : taxiVehicle.attributes.offers_fresh_drinks,
        accepts_bikes                    : taxiVehicle.attributes.accepts_bikes,
        has_dvd_player                   : taxiVehicle.attributes.has_dvd_player,
        has_tablet                       : taxiVehicle.attributes.has_tablet,
        has_wifi                         : taxiVehicle.attributes.has_wifi,
        has_baby_seat                    : taxiVehicle.attributes.has_baby_seat,
        accepts_pets                     : taxiVehicle.attributes.accepts_pets,
        has_aircon                       : taxiVehicle.attributes.has_aircon,
        can_use_electronic_tolls         : taxiVehicle.attributes.can_use_electronic_tolls,
        has_gps                          : taxiVehicle.attributes.has_gps,
        technical_control_last_date      : taxiVehicle.attributes.technical_control_last_date,
        technical_control_expiration_date: taxiVehicle.attributes.technical_control_expiration_date
      }
    });
  }

  newObject(attribs, isNew = false, collectionManager) {
    return new TaxiVehicle(attribs, isNew, collectionManager);
  }

  loadFromServer(socket, collectionManager) {
    return CollectionLoadable.loadFromServer(this, socket, collectionManager);
  }

  loadFromCollection(collection, collectionManager) {
    return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
  }
}

TaxiVehicleCollection.instanceClass = TaxiVehicle;
TaxiVehicleCollection.socketPrefix  = 'taxiVehicles';
TaxiVehicleCollection.displayName   = 'TaxiVehicleCollection';

export default TaxiVehicleCollection
