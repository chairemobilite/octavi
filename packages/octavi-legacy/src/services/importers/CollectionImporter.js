
import { validate as uuidValidate } from 'uuid';
import _get          from 'lodash/get';

import { GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import jsonReadStreamPipeline    from './JsonReadStreamPipeline';
import { fileManager }           from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

class CollectionImporter extends GenericObject {

    constructor(attributes = {}) {

    super(attributes, false);

    this.attributes.errors  = [];
    this.attributes.isValid = true;

    this._objectClass                = null; // override in children class (example: Node)
    this._objectsToCache             = null; // override in children class
    this._dbQueries                  = null; // override in children class
    this._collectionClass            = null; // override in children class (example: NodeCollection)
    this._objectClassFactoryFunction = null; // must be a function, keep null to use constructor (new)
    this._readStreamPipeline         = jsonReadStreamPipeline;
    this._importCollectionSocketName = 'collection';

  }

  isValid() {
    return this.attributes.isValid;
  }

  errors() {
    return this.attributes.errors;
  }

  validateFeature(feature) {
    const object            = this._objectClassFactoryFunction ? this._objectClass[this._objectClassFactoryFunction](feature) : new this._objectClass(feature, false, null);
    this.attributes.isValid = object.validate(true);
    this.attributes.errors  = object.errors;
    return this.attributes.isValid;
  }

  validateDataAndId(feature) {

    const featureId = _get(feature, 'properties.id', null);
    if (!uuidValidate(featureId))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push('main:errors:AtLeastOneMissingOrInvalidUuid');
      return false;
    }

    if (!uuidValidate(featureId))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push('main:errors:AtLeastOneMissingOrInvalidUuid');
      return false;
    }

    return true;
  }

  validateFile(filePath) {

    //console.log('validating file');

    return new Promise(function(resolve, reject) {

      if (fileManager.fileExistsAbsolute(filePath))
      {
        const pipeline = this._readStreamPipeline(filePath);

        pipeline.on('data', function(data) {
          const feature = data.value;
          if (!this.validateDataAndId(feature) || !this.validateFeature(feature))
          {
            pipeline.streams[0].close();
            pipeline.streams[0].destroy();
            pipeline.destroy();
            pipeline.emit('end');
          }
        }.bind(this));

        pipeline.on('end', function() {
          return resolve();
        }.bind(this));

        pipeline.on('error', function() {
          this.attributes.isValid = false;
          this.attributes.errors.push('main:errors:JsonFileIsEmptyOrInvalid');
          return resolve();
        }.bind(this));

      }
      else
      {
        this.attributes.isValid = false;
        this.attributes.errors.push('main:errors:JsonFileIsRequired');
        return resolve();
      }

    }.bind(this));
  }

  import(filePath) { // must use validateFile before importing

    //console.log('importing file');

    return new Promise(function(resolve, reject) {

      const collection     = new this._collectionClass([]);
      const updatedObjects = [];
      const newObjects     = [];

      let i = 1;
      const pipeline = this._readStreamPipeline(filePath);
      this._dbQueries[this._importCollectionSocketName]().then(function(collectionData) {

        collection.loadFromCollection(collectionData.features ? collectionData.features : collectionData);

        pipeline.on('data', function(data) {

          const object = this._objectClassFactoryFunction ? this._objectClass[this._objectClassFactoryFunction](data.value) : new this._objectClass(data.value, false, null);

          if ('integer_id' in object.attributes)
          {
            delete object.attributes.integer_id; // remove integer id which will be set by db
          }
          if (collection.getById(object.get('id')))
          {
            // update existing object
            updatedObjects.push(object.attributes);
          }
          else
          {
            newObjects.push(object.attributes);
          }
          //console.log('object imported ' + i);
          //console.log(updatedObjects, newObjects);
          i++;
        }.bind(this));

        pipeline.on('end', function() {

          this._dbQueries.createMultiple(newObjects).then(function(response) {
            if (this._objectsToCache)
            {
              return this._objectsToCache(newObjects); // save new objects to cache if class has a cache file for each object (like nodes)
            }
            else
            {
              return new Promise(function(resolve, reject) { resolve() });
            }
          }.bind(this)).then(function(response) {

            if (this._objectsToCache)
            {
              return this._objectsToCache(updatedObjects); // save updated objects to cache if class has a cache file for each object (like nodes)
            }
            else
            {
              return new Promise(function(resolve, reject) { resolve() });
            }

          }.bind(this)).then(function(response) {
            this._dbQueries.updateMultiple(updatedObjects).then(function(commit) {
              commit().then(function(commitResponse) {
                //console.log('objects imported');
                return resolve();
              });
            }.bind(this));
          }.bind(this));

        }.bind(this));

        pipeline.on('error', function(error) {
          console.error(error);
        });

      }.bind(this));

    }.bind(this));
  }

}

export default CollectionImporter
