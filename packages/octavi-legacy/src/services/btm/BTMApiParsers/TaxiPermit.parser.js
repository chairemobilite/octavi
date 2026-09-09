import moment from 'moment';

export default function(data) {

  return {   
    internal_id     : data.id,
    added_at        : moment(data.added_at), // never null
    last_updated_at : data.last_update_at ? moment(data.last_update_at) : moment(data.added_at), // can be null, replace by added_at
    permit_id       : data.numero,
    btm_vignette_id : data.vdm_vignette,
    owner_name      : data.owner_name,
    permit_zone_id  : data.zupc_id,
    permit_zone_name: data.nom_zupc,
    owner_type      : data.owner_type,
    data: {
      added_via    : data.added_via,
      added_by     : data.added_by,
      added_by_name: data.added_by_name,
      insee        : data.insee,
      category     : data.category,
      vehicle_id   : data.vehicle_id // should not be there, it should be in the tr_taxis table... We need to check if this key is always the same in the taxis table, otherwise, we are doomed!
    }
  
  };

}
