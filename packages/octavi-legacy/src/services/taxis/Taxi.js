import _cloneDeep from 'lodash/cloneDeep';

import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';

class Taxi extends ObjectWithHistory {

  constructor(attributes = {}, isNew, collectionManager) {

    super(attributes, isNew, collectionManager);

    this.driver  = this._collectionManager && this._collectionManager.get('taxiDrivers')  ? this._collectionManager.get('taxiDrivers').getById(this.get('driver_id'))   : null;
    this.permit  = this._collectionManager && this._collectionManager.get('taxiPermits')  ? this._collectionManager.get('taxiPermits').getById(this.get('permit_id'))   : null;
    this.vehicle = this._collectionManager && this._collectionManager.get('taxiVehicles') ? this._collectionManager.get('taxiVehicles').getById(this.get('vehicle_id')) : null;

  }

  toString(showId = true) {
    if (showId)
    {
      return this.id;
    }
    const internalId = this.get('internal_id');
    if (internalId)
    {
      return `${internalId}`;
    }
    else
    {
      return this.id;
    }
  }

  static symbol() {
    return 'TAXI';
  }

  symbol() {
    return this.constructor.symbol();
  }

  delete(socket) {
    return SaveUtils.delete(this, socket, 'taxi', this._collectionManager.get('taxis'));
  }

  save(socket) {
    return SaveUtils.save(this, socket, 'taxi', this._collectionManager.get('taxis'));
  }

  saveInMemory() {
    SaveUtils.saveInMemory(this, this._collectionManager.get('taxis'));
  }

  deleteInMemory() {
    SaveUtils.deleteInMemory(this, this._collectionManager.get('taxis'));
  }

  getPluralName() {
    return this.constructor.getPluralName();
  }

  getCapitalizedPluralName() {
    return this.constructor.getCapitalizedPluralName();
  }

  static getPluralName() {
    return 'taxis';
  }

  static getCapitalizedPluralName() {
    return 'Taxis';
  }

}

Taxi.displayName = 'Taxi';

export default Taxi
