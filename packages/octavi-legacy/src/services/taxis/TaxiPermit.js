import _cloneDeep from 'lodash/cloneDeep';

import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';

class TaxiPermit extends ObjectWithHistory {

  constructor(attributes = {}, isNew, collectionManager) {

    super(attributes, isNew, collectionManager);

    if (this.attributes.taxi_ids && this.attributes.taxi_ids.length > 0)
    {
      this.refreshTaxis();
    }
    else
    {
      this.attributes.taxi_ids = [];
      this.taxis               = [];
    }

  }

  refreshTaxis() {
    this.taxis = [];
    if (this._collectionManager && this._collectionManager.get('taxis') && this.attributes.taxi_ids)
    {
      for (let i = 0, count = this.attributes.taxi_ids.length; i < count; i++)
      {
        const taxi = this._collectionManager.get('taxis').getById(this.attributes.taxi_ids[i]);
        if (taxi) // when saving cache on backend, the agency collection will be empty
        {
          this.taxis.push(taxi);
        }
      }
    }
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
    return 'TAXIPE';
  }

  symbol() {
    return this.constructor.symbol();
  }

  delete(socket) {
    return SaveUtils.delete(this, socket, 'taxiPermit', this._collectionManager.get('taxiPermits'));
  }

  save(socket) {
    return SaveUtils.save(this, socket, 'taxiPermit', this._collectionManager.get('taxiPermits'));
  }

  saveInMemory() {
    SaveUtils.saveInMemory(this, this._collectionManager.get('taxiPermits'));
  }

  deleteInMemory() {
    SaveUtils.deleteInMemory(this, this._collectionManager.get('taxiPermits'));
  }

  getPluralName() {
    return this.constructor.getPluralName();
  }

  getCapitalizedPluralName() {
    return this.constructor.getCapitalizedPluralName();
  }

  static getPluralName() {
    return 'taxiPermits';
  }

  static getCapitalizedPluralName() {
    return 'TaxiPermits';
  }

}

TaxiPermit.displayName = 'TaxiPermit';

export default TaxiPermit
