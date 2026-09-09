import moment from 'moment';

export default function(data) {

  return {   
    internal_id                      : data.id,
    license_plate                    : data.licence_plate,
    added_at                         : moment(data.added_at), // never null
    last_updated_at                  : data.last_update_at ? moment(data.last_update_at) : moment(data.added_at), // can be null, replace by added_at
    model_year                       : data.model_year > 1000 ? data.model_year : null,
    model                            : data.modelname,       // we confirm there are no underscore in this attribute
    constructor                      : data.constructorname, // we confirm there are no underscore in this attribute
    color                            : data.color,
    number_of_seats                  : data.nb_seats >= 1 ? data.nb_seats : null,
    vehicle_type                     : data['type_'], // yes there is an underscore at the end of the attribute...
    is_temporary_replacement         : (data.relais === true),
    technical_control_last_date      : data.date_dernier_ct  ? moment(data.date_dernier_ct)  : null,
    technical_control_expiration_date: data.date_validite_ct ? moment(data.date_validite_ct) : null,
    is_special_need_vehicle          : (data.special_need_vehicle === true),
    is_luxury                        : (data.luxury === true),
    accepts_credit_card              : (data.credit_card_accepted === true),
    accepts_paypass                  : (data.nfc_cc_accepted === true),
    accepts_amex                     : (data.amex_accepted === true),
    accepts_bank_checks              : (data.bank_check_accepted === true),
    offers_fresh_drinks              : (data.fresh_drink === true),
    has_dvd_player                   : (data.dvd_player === true),
    has_tablet                       : (data.tablet === true),
    has_wifi                         : (data.wifi === true),
    has_baby_seat                    : (data.baby_seat === true),
    accepts_bikes                    : (data.bike_accepted === true),
    accepts_pets                     : (data.pet_accepted === true),
    has_aircon                       : (data.air_con === true),
    can_use_electronic_tolls         : (data.electronic_toll === true),
    has_gps                          : (data.gps === true),
    is_private                       : (data.private === true),
    is_special_need_vehicle          : (data.special_need_vehicle === true),
    data: {
      model_id                : data.model_id,      // As of 2020/09/25, we do not have the lookup for the model and constructor ids, so we keep them in the data object:
      constructor_id          : data.constructor_id,
      engine                  : data.engine,        // no idea what this means...
      horse_power             : data.horse_power,   // can be 0, we do not know if this data is provided for some vehicles
      horodateur              : data.horodateur,
      taximetre               : data.taximetre,
      added_by_name           : data.added_by_name,
      status                  : data.status,
      last_nonStatus_update_at: data.last_nonStatus_update_at ? moment(data.last_nonStatus_update_at): null,
    }
  
  };

}
