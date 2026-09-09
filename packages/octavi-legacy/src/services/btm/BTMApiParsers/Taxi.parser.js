import moment from 'moment';

export default function(data, dataSourceId, taxiDriversCollection, taxiPermitsCollection, taxiVehiclesCollection) {

  const driver  = taxiDriversCollection.getByInternalId(data.driver_id);
  const permit  = taxiPermitsCollection.getByInternalId(data.ads_id);
  const vehicle = taxiVehiclesCollection.getByInternalId(data.vehicle_id);

  if (!driver)
  {
    console.error(`cannot find taxi driver in database (driver internal_id = ${data.driver_id}) for taxi internal_id ${data.id}`);
  }
  if (!permit)
  {
    console.error(`cannot find taxi permit in database (permit internal_id = ${data.ads_id}) for taxi internal_id ${data.id}`);
  }
  if (!vehicle)
  {
    console.error(`cannot find taxi vehicle in database (vehicle internal_id = ${data.vehicle_id}) for taxi internal_id ${data.id}`);
  }

  return {   
    internal_id    : data.id,
    driver_id      : driver ? driver.id : null,
    permit_id      : permit ? permit.id : null,
    vehicle_id     : vehicle ? vehicle.id : null,
    data_source_id : dataSourceId,
    added_at       : moment(data.added_at), // never null
    last_updated_at: data.last_update_at ? moment(data.last_update_at) : moment(data.added_at), // can be null, replace by added_at
    rating         : data.rating,
    data: {
      ban_begin    : data.ban_begin ? moment(data.ban_begin) : null,
      ban_end      : data.ban_end   ? moment(data.ban_end)   : null,
      added_by_name: data.added_by_name,
      source       : data.source
    }
  
  };

}
