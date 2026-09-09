import serviceLocator from "chaire-lib-common/lib/utils/ServiceLocator";

const generateGraphOptions = function(props) {
  const { filter, generateOptions, t, fileName } = props;

  if (props.data) {
      const data = new Promise((resolve, _) => resolve(props.data))
      return data.then((result) => generateOptions(result, filter, t, fileName))
  }

  const data = generateAggregatedData(props)
  return data.then((arr) =>
    arr.length == 0
      ? new Promise((resolve, _) => resolve({}))
      : data.then((result) => generateOptions(result, filter, t, fileName))
  );
};


const generateAggregatedData = function(props, isSaveEnabled = true) {
  const { filter, name, dataAggregator, dataLoader } = props;

  if (typeof(dataLoader) == 'undefined') {
    return new Promise((resolve, _) =>  resolve([props.id]))
  }
  else {
    let rawData, names
    switch(filter.mode) {
      case 'simple':
        rawData = getRawData(name, props)
        return rawData.then((result) => aggregateData(result, filter, dataAggregator, isSaveEnabled));

      case 'compare':
        names = ExtractNamesFromKeyNameInCompareMode(name)
        rawData = names.map( (name, index) => getRawData(name, props, index))
        return Promise.all(rawData).then(result => aggregateData(result, filter, dataAggregator, isSaveEnabled))
    }
  }
};


const getRawData = function(name, props, i=0) {
  return serviceLocator.collectionManager.has(name)
    ? new Promise((resolve, _) =>  resolve(serviceLocator.collectionManager.get(name).features))
    : loadDataByFilter(props, i);
}

const loadDataByFilter = function(props, i) {
  const { filter, dataLoader, name } = props;
  const collection = new dataLoader([], {}, serviceLocator.eventManager);
  let tempFilter = {...filter}
  tempFilter.period = filter.period[i]
  return load(collection, name, tempFilter)
}

const load = function(collection, name, filter) {
  return collection
  .loadFromServerByFilter(
    serviceLocator.socketEventManager,
    serviceLocator.collectionManager,
    filter
  )
  .then(function (response) {
    serviceLocator.collectionManager.add(name, collection);
    return collection;
  })
  .then((result) => {
    return result.features.map( x => x.attributes)
  });
}

const aggregateData = function (response, filter, dataAggregator, isSaveEnabled) {
  if (response.length > 0) {
    return dataAggregator(response, filter, isSaveEnabled);
  } else {
    return [];
  }
};

const ExtractNamesFromKeyNameInCompareMode = function(keyName) {
  const object = JSON.parse(keyName)
  const { segments, period } = object
  const names = []
  period.start.forEach(function (value, i) {
    const name =  {
      'segments':segments,
      'period'  : {
        'start': period.start[i],
        'end'  : period.end[i]
        }
      }
    names.push(JSON.stringify(name))
  })
  return names
}


export {
  generateGraphOptions,
  generateAggregatedData
};
