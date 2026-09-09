import DataSourceCollection   from 'chaire-lib-common/lib/services/dataSource/DataSourceCollection';
import TaxiCollection         from './TaxiCollection';
import TaxiDriverCollection   from './TaxiDriverCollection';
import TaxiPermitCollection   from './TaxiPermitCollection';
import TaxiVehicleCollection  from './TaxiVehicleCollection';
import TaxiOperatorCollection from './TaxiOperatorCollection';

import dataSourcesDbQueries    from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import taxisDbQueries          from '../../models/db/taxis.db.queries';
import taxiDriversDbQueries    from '../../models/db/taxiDrivers.db.queries';
import taxiPermitsDbQueries    from '../../models/db/taxiPermits.db.queries';
import taxiVehiclesDbQueries   from '../../models/db/taxiVehicles.db.queries';
import taxiOperatorsDbQueries  from '../../models/db/taxiOperators.db.queries';

export default async function(collectionManager, eventManager) {

  console.log(`loading all taxi collections`);

  const dataSourceCollection   = collectionManager.get('dataSources') || new DataSourceCollection([], {}, eventManager);
  const taxiCollection         = collectionManager.get('taxis') || new TaxiCollection([], {}, eventManager);
//   const taxiActivityCollection = new TaxiActivityCollection([], {}, eventManager);
  const taxiDriverCollection   = collectionManager.get('taxiDrivers') || new TaxiDriverCollection([], {}, eventManager);
  const taxiPermitCollection   = collectionManager.get('taxiPermits') || new TaxiPermitCollection([], {}, eventManager);
  const taxiVehicleCollection  = collectionManager.get('taxiVehicles') || new TaxiVehicleCollection([], {}, eventManager);
  const taxiOperatorCollection = collectionManager.get('taxiOperators') || new TaxiOperatorCollection([], {}, eventManager);

  const [
    dataSources,
    taxis,
    // taxiActivities,
    taxiDrivers,
    taxiPermits,
    taxiVehicles,
    taxiOperators
  ] = await Promise.all([
    dataSourcesDbQueries.collection(),
    taxisDbQueries.collection(),
    // taxiActivitiesDbQueries.collection(),
    taxiDriversDbQueries.collection(),
    taxiPermitsDbQueries.collection(),
    taxiVehiclesDbQueries.collection(),
    taxiOperatorsDbQueries.collection()
  ]);

  dataSourceCollection.loadFromCollection(dataSources);
  collectionManager.add('dataSources', dataSourceCollection);
  console.log('loaded dataSources');

  taxiCollection.loadFromCollection(taxis);
  collectionManager.add('taxis', taxiCollection);
  console.log('loaded taxis');

//   taxiActivityCollection.loadFromCollection(taxiActivities);
//   collectionManager.add('taxiActivities', taxiActivityCollection);
//   console.log('loaded taxi activities')

  taxiDriverCollection.loadFromCollection(taxiDrivers);
  collectionManager.add('taxiDrivers', taxiDriverCollection);
  console.log('loaded taxi drivers');

  taxiPermitCollection.loadFromCollection(taxiPermits);
  collectionManager.add('taxiPermits', taxiPermitCollection);
  console.log('loaded taxi permits');

  taxiVehicleCollection.loadFromCollection(taxiVehicles);
  collectionManager.add('taxiVehicles', taxiVehicleCollection);
  console.log('loaded taxi vehicles');

  taxiOperatorCollection.loadFromCollection(taxiOperators);
  collectionManager.add('taxiOperators', taxiOperatorCollection);
  console.log('loaded taxi operators');

  return collectionManager;
}
