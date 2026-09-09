import _cloneDeep from 'lodash/cloneDeep';

import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';

class TaxiOperator extends ObjectWithHistory {

  constructor(attributes = {}, isNew, collectionManager) {

    super(attributes, isNew, collectionManager);

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
    return 'TAXIOP';
  }

  symbol() {
    return this.constructor.symbol();
  }

  delete(socket) {
    return SaveUtils.delete(this, socket, 'taxiOperator', this._collectionManager.get('taxiOperators'));
  }

  save(socket) {
    return SaveUtils.save(this, socket, 'taxiOperator', this._collectionManager.get('taxiOperators'));
  }

  saveInMemory() {
    SaveUtils.saveInMemory(this, this._collectionManager.get('taxiOperators'));
  }

  deleteInMemory() {
    SaveUtils.deleteInMemory(this, this._collectionManager.get('taxiOperators'));
  }

  getPluralName() {
    return this.constructor.getPluralName();
  }

  getCapitalizedPluralName() {
    return this.constructor.getCapitalizedPluralName();
  }

  static getPluralName() {
    return 'taxiOperators';
  }

  static getCapitalizedPluralName() {
    return 'TaxiOperators';
  }

}

TaxiOperator.displayName = 'TaxiOperator';

export default TaxiOperator
