import moment from 'moment';

export default function(data) {

  return {   
    internal_id         : data.id,
    added_at            : moment(data.added_at), // never null
    last_updated_at     : data.last_update_at ? moment(data.last_update_at) : moment(data.added_at), // can be null, replace by added_at
    department          : data.department_id,
    first_name          : data.first_name,
    last_name           : data.last_name,
    professional_license: data.professional_licence,
    birth_date          : data.birth_date  ? moment(data.birth_date): null,
    data: {
      source       : data.source,
      added_via    : data.added_via,
      added_by     : data.added_by,
      added_by_name: data.added_by_name
    }
  
  };

}
