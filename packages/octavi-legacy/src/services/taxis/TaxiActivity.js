import _cloneDeep from 'lodash/cloneDeep';

import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';

class TaxiActivity extends ObjectWithHistory {

  constructor(attributes = {}, isNew, collectionManager) {

    super(attributes, isNew, collectionManager);

  }

  static symbol() {
    return 'TAXIAC';
  }

  symbol() {
    return this.constructor.symbol();
  }

  delete(socket) {
    return SaveUtils.delete(this, socket, 'taxiActivity', this._collectionManager.get('taxiActivities'));
  }

  save(socket) {
    return SaveUtils.save(this, socket, 'taxiActivity', this._collectionManager.get('taxiActivities'));
  }

  saveInMemory() {
    SaveUtils.saveInMemory(this, this._collectionManager.get('taxiActivities'));
  }

  deleteInMemory() {
    SaveUtils.deleteInMemory(this, this._collectionManager.get('taxiActivities'));
  }

  getPluralName() {
    return this.constructor.getPluralName();
  }

  getCapitalizedPluralName() {
    return this.constructor.getCapitalizedPluralName();
  }

  static getPluralName() {
    return 'taxiActivities';
  }

  static getCapitalizedPluralName() {
    return 'TaxiActivities';
  }

}

TaxiActivity.displayName = 'TaxiActivity';

export default TaxiActivity
