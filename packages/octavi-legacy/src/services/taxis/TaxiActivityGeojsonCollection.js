import KDBush    from 'kdbush';

import ProgressableMapObjectCollection from '../ProgressableMapObjectCollection';
import TaxiActivity                  from './TaxiActivity';
import CollectionCacheable             from '../CollectionCacheable';
import CollectionLoadable              from '../CollectionLoadable';

class TaxiActivityGeojsonCollection extends ProgressableMapObjectCollection {

  constructor(features, attributes, eventManager) {
    super(features, attributes, eventManager);
    this.updateSpatialIndex();
  }

  setFeatures(features) {
    this.features = features;
    this.updateIndexById();
    this.updateSpatialIndex();
  }

  updateSpatialIndex() {

    const features = this.features;
    const points   = [];
    for (let i = 0, countI = features.length; i < countI; i++)
    {
      const feature   = features[i];
      const lastIndex = feature.geometry.coordinates.length - 1;
      points.push({
        id   : feature.properties.id,
        index: 0,
        x    : feature.geometry.coordinates[0][0],
        y    : feature.geometry.coordinates[0][1]
      });
      points.push({
        id   : feature.properties.id,
        index: 1,
        x    : feature.geometry.coordinates[lastIndex][0],
        y    : feature.geometry.coordinates[lastIndex][1]
      });
    }

    this.spatialIndex = new KDBush(points, (point) => point.x, (point) => point.y);
  }

  saveCache(socket, customCollection) {
    return CollectionCacheable.saveCache.call(this, socket, customCollection);
  }

  loadCache(socket, customCollection) {
    return CollectionCacheable.loadCache.call(this, socket, customCollection);
  }

  loadFromServer(socket, dataSourceId) {
    return CollectionLoadable.loadGeojsonFromServer.call(this, socket, dataSourceId);
  }

  loadFromCollection(collection) {
    return CollectionLoadable.loadGeojsonFromCollection.call(this, collection);
  }

}

TaxiActivityGeojsonCollection.instanceClass = TaxiActivity;
TaxiActivityGeojsonCollection.socketPrefix  = 'taxiActivities';
TaxiActivityGeojsonCollection.displayName   = 'TaxiActivityGeojsonCollection';

export default TaxiActivityGeojsonCollection
