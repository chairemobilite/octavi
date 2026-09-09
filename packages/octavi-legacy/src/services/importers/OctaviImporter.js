import moment from 'moment';


import { point as turfPoint, distance as turfDistance } from '@turf/turf';

import { fileManager }         from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import CollectionImporter      from './CollectionImporter';
import loadAllTaxiCollections  from '../taxis/CollectionService';
import TaxiDataImporter        from './OctaviTaxiDataImporter';
import { _isBlank }            from 'chaire-lib-common/lib/utils/LodashExtensions';
import Taxi                    from '../taxis/Taxi';
import TaxiDriver              from '../taxis/TaxiDriver';
import TaxiPermit              from '../taxis/TaxiPermit';
import TaxiVehicle             from '../taxis/TaxiVehicle';
import taxiParser              from '../btm/BTMApiParsers/Taxi.parser';
import vehicleParser           from '../btm/BTMApiParsers/TaxiVehicle.parser';
import permitParser            from '../btm/BTMApiParsers/TaxiPermit.parser';
import driverParser            from '../btm/BTMApiParsers/TaxiDriver.parser';
import taxisDbQueries          from '../../models/db/taxis.db.queries';
import taxiActivitesDbQueries  from '../../models/db/taxiActivities.db.queries';
import driversDbQueries        from '../../models/db/taxiDrivers.db.queries';
import permitsDbQueries        from '../../models/db/taxiPermits.db.queries';
import vehiclesDbQueries       from '../../models/db/taxiVehicles.db.queries';
import serviceLocator          from 'chaire-lib-common/lib/utils/ServiceLocator';
import BTMService              from '../btm/BTMService';
import { email as emailRegex, timestampSeconds as timestampSecondsRegex } from '../../config/regexValidations.config';

const defaultCsvFilePath = fileManager.getAbsolutePath('/imports/import.csv');

const taxiActivitiesRequiredFields = [
  'taxi', // 7 characters [A-Za-z0-9]
  'o_lat', //
  'o_lon', //
  'd_lat', //
  'd_lon', //
  'o_timestamp', // Unix Epoch, should be UTC
  'd_timestamp', // Unix Epoch, should be UTC
  'operator', // email address
  'status'//, // none, free, occupied, unavailable, oncoming, answering, off, other, unknown
  //'distance_totale', // in meters, not required, can be empty for some status
];

const taxiPositionsRequiredFields = [
  'taxi', // 7 characters [A-Za-z0-9]
  'lat', //
  'lon', //
  'device', // none, phone, tablet, taximeter, otherdevice, other, unknown
  'operator', // email
  'timestamp', // Unix Epoch, should be UTC
  'status', // none, free, occupied, unavailable, oncoming, answering, off, other, unknown
  'speed', // km/h
  'azimuth' // 0 to 360, 0 = North
];

const deviceChoices = [
  'none',
  'phone',
  'tablet',
  'taximeter',
  'otherdevice',
  'other',
  'unknown'
];

const statusChoices = [
  'none',
  'free',
  'occupied',
  'unavailable',
  'oncoming',
  'answering',
  'off',
  'other',
  'unknown'
];

class OctaviImporter extends CollectionImporter {

  constructor(attributes) {

    super(attributes, false);

    if (_isBlank(this.attributes.csvFilePath))
    {
      this.attributes.csvFilePath = defaultCsvFilePath;
    }

    this._dataImporter = new TaxiDataImporter();

  }

  validateTaxiActivityFeature(feature) {

    //console.log(feature);

    if (_isBlank(this.attributes.errors))
    {
      this.attributes.errors = [];
    }

    for (let i = 0; i < taxiActivitiesRequiredFields.length; i++)
    {
      if (_isBlank(feature[taxiActivitiesRequiredFields[i]]))
      {
        this.attributes.isValid = false;
        this.attributes.errors.push(`The "${taxiActivitiesRequiredFields[i]}" column is empty.`);
      }
    }
    if (!RegExp('^[0-9A-Za-z\-\_]').test(feature.taxi))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "taxi" column is not valid (does not match Regex ^[0-9A-Za-z\-\_]).`);
    }
    if (!(emailRegex.test(feature.operator)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "operator" column is not a valid email.`);
    }
    if (isNaN(parseFloat(feature.o_lat)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "o_lat" (origin latitude) column is not a valid float number.`);
    }
    if (isNaN(parseFloat(feature.o_lon)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "o_lon" (origin longitude) column is not a valid float number.`);
    }
    if (isNaN(parseFloat(feature.d_lat)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "d_lat" (destination latitude) column is not a valid float number.`);
    }
    if (isNaN(parseFloat(feature.d_lon)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "d_lon" (destination longitude) column is not a valid float number.`);
    }
    if (!(timestampSecondsRegex.test(feature.o_timestamp)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "o_timestamp" (unix epoch in seconds) column is not a valid unix epoch.`);
    }
    if (!(timestampSecondsRegex.test(feature.d_timestamp)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "d_timestamp" (unix epoch in seconds) column is not a valid unix epoch.`);
    }
    if (!(statusChoices.includes(feature.status)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "status" column is not a valid choice [none, free, occupied, unavailable, oncoming, answering, off, other, unknown].`);
    }
    if (!_isBlank(feature.distance_totale) && isNaN(parseInt(feature.distance_totale)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "distance_totale" column is not valid (must be an integer greater than or equal to 0).`);
    }

  }

  validateTaxiPositionFeature(feature) {
    this.attributes.isValid = true;
    if (_isBlank(this.attributes.errors))
    {
      this.attributes.errors = [];
    }

    for (let i = 0; i < taxiPositionsRequiredFields.length; i++)
    {
      if (_isBlank(feature[taxiPositionsRequiredFields[i]]))
      {
        this.attributes.isValid = false;
        this.attributes.errors.push(`The "${taxiPositionsRequiredFields[i]}" column is empty.`);
      }
    }
    if (!RegExp('^[0-9A-Za-z\-\_]').test(feature.taxi))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "taxi" column is not valid (does not match Regex ^[0-9A-Za-z\-\_]).`);
    }
    if (!(emailRegex.test(feature.operator)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "operator" column is not a valid email.`);
    }
    if (isNaN(parseFloat(feature.lat)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "lat" (latitude) column is not a valid float number.`);
    }
    if (isNaN(parseFloat(feature.lon)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "lon" (longitude) column is not a valid float number.`);
    }
    if (!(timestampSecondsRegex.test(feature.timestamp)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "timestamp" (unix epoch in seconds) column is not a valid unix epoch.`);
    }
    if (!(deviceChoices.includes(feature.device)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "device" column is not a valid choice [none, phone, tablet, taximeter, otherdevice, other, unknown].`);
    }

    if (!(statusChoices.includes(feature.status)))
    {
      this.attributes.isValid = false;
      this.attributes.errors.push(`The "status" column is not a valid choice [none, free, occupied, unavailable, oncoming, answering, off, other, unknown].`);
    }

  }

  importTaxiObjects(dataSourceId) {
    return new Promise(function(resolve, reject) {

      const updateTaxiObjectsPromises = [];
      console.log("Importation of taxi objects")



      // update tables:
      updateTaxiObjectsPromises.push(this._dataImporter.updateTaxiObjects({
        objectsName       : 'drivers',
        objectClass       : TaxiDriver,
        dbQueries         : driversDbQueries,
        parser            : driverParser,
        collection        : serviceLocator.collectionManager.get('taxiDrivers'),
        btmServiceFunction: BTMService.drivers.bind(BTMService),
        dataSourceId      : dataSourceId,
        updateEtag        : true
        })
      );
      updateTaxiObjectsPromises.push(this._dataImporter.updateTaxiObjects({
        objectsName       : 'permits',
        objectClass       : TaxiPermit,
        dbQueries         : permitsDbQueries,
        parser            : permitParser,
        collection        : serviceLocator.collectionManager.get('taxiPermits'),
        btmServiceFunction: BTMService.permits.bind(BTMService),
        dataSourceId      : dataSourceId,
        updateEtag        : true
        })
      );
      updateTaxiObjectsPromises.push(this._dataImporter.updateTaxiObjects({
        objectsName       : 'vehicles',
        objectClass       : TaxiVehicle,
        dbQueries         : vehiclesDbQueries,
        parser            : vehicleParser,
        collection        : serviceLocator.collectionManager.get('taxiVehicles'),
        btmServiceFunction: BTMService.vehicles.bind(BTMService),
        dataSourceId      : dataSourceId,
        updateEtag        : true
        })
      );

      Promise.all(updateTaxiObjectsPromises).then(function(updateTaxiObjectsResponse) {
        //since updating taxi collection calls other taxi object collection, we need to relaod collection then update taxi
        loadAllTaxiCollections(serviceLocator.collectionManager, serviceLocator.eventManager).then(function() {
            this._dataImporter.updateTaxiObjects({
                objectsName       : 'taxis',
                objectClass       : Taxi,
                dbQueries         : taxisDbQueries,
                parser            : taxiParser,
                collection        : serviceLocator.collectionManager.get('taxis'),
                btmServiceFunction: BTMService.taxis.bind(BTMService),
                dataSourceId      : dataSourceId,
                updateEtag        : true
              }).then(function() {
                //and finaly we reload collection one last time after updating all taxi objects
                loadAllTaxiCollections(serviceLocator.collectionManager, serviceLocator.eventManager).then(function() {
                    resolve();
                })
              }.bind(this))
        }.bind(this))
      }.bind(this));
    }.bind(this));
  }

  /**
   * Create the activity
   * @param {*} dataPointList Array of data points, this points should have been validated first
   * @param {string} dataSourceId ID of the data source toimport to
   * @param {boolean} noTaxiImport If false, will fetch and import taxi objects
   * (vehicles, drivers, etc)
   * @param {*} endTime End time of the period as Moment object, to identify the
   * import range boundary
   */
  async createActivitiesFromPositions(dataPointList, dataSourceId, noTaxiImport = false, endTime = undefined) {// the data point object must match the required fields (must be valid too), validation must be done before loading data here
    //starting by importing taxi objects
    if (!noTaxiImport) {
        const updatedObject = await this.importTaxiObjects()
    }

    //first we order points by timpestamp and group them by driver
    console.log('ordering position points')
    const pointsByOperatorAndDriver = {}
    let totalTaxiDrivers = 0;
    for (let point of dataPointList) {

        // add operator if not in object
        if (pointsByOperatorAndDriver[point['operator']] === undefined) {
            pointsByOperatorAndDriver[point['operator']] = {}
        }
        //add point to driver list
        if (pointsByOperatorAndDriver[point['operator']][point['taxi']] === undefined) {
            pointsByOperatorAndDriver[point['operator']][point['taxi']] = [point]
        } else {
            pointsByOperatorAndDriver[point['operator']][point['taxi']].push(point)
        }
    }
    //now we order points by time
    let latestTime = 0;
    for (let operator of Object.keys(pointsByOperatorAndDriver)) {
        for (let taxi of Object.keys(pointsByOperatorAndDriver[operator])) {
            pointsByOperatorAndDriver[operator][taxi].sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
            totalTaxiDrivers = totalTaxiDrivers + 1;
            const currentTaxiLatest = pointsByOperatorAndDriver[operator][taxi][pointsByOperatorAndDriver[operator][taxi].length - 1].timestamp;
            if (currentTaxiLatest > latestTime) {
                latestTime = currentTaxiLatest;
            }
        }
    }
    const taxiCollection = serviceLocator.collectionManager.get('taxis');
    const periodLatestTime = endTime === undefined ? moment.unix(latestTime) : endTime;
    // For the next activities, do not fetch those that start one hour after the end period, they are not relevant
    const nextActivitiesEndTimeTs = moment(periodLatestTime).add(1, 'hour').valueOf() / 1000;

    //for each taxi we build each activity
    console.log('building activities')
    const activitiesAttributesForImport = {};
    const activityIdsToDelete = []
    for (let operator of Object.keys(pointsByOperatorAndDriver)) {
        for (let taxi of Object.keys(pointsByOperatorAndDriver[operator])) {
            const currentTaxiActivitiesToImport = [];
            const taxiObject = taxiCollection.getByInternalId(taxi);
            const taxiId = taxiObject.attributes.id;
            const taxiPoints = pointsByOperatorAndDriver[operator][taxi];
            const minTimestamp = taxiPoints[0].timestamp;
            // fetch previous taxi trip with the same taxi_id
            // can be empty --> in this case first point will be start of a new trip
            const lastTripReq = taxiActivitesDbQueries.selectLastTaxiActivityBeforeTimestamp({
                dataSourceId: dataSourceId,
                taxiId: taxiId,
                timestamp: minTimestamp,
                timezone: 'utc'
            });
            // fetch next taxi trips with the same taxi_id and (next trip here are every trip ending after import start date)
            // can be empty --> in this case we have no trips starting after start import date
            const nextTripsReq = taxiActivitesDbQueries.selectNextTaxiActivitiesAfterTimestamp({
                dataSourceId: dataSourceId,
                taxiId: taxiId,
                timestamp: minTimestamp,
                timezone: 'utc',
                latestStart: nextActivitiesEndTimeTs
            });
            const lastTrip = await lastTripReq;
            const nextTrips = await nextTripsReq;

            let previousPoint = taxiPoints.shift();
            let startOfCurrentTrip;
            let tripDistance;
            let needsGroupVerification = false

            //in case of previous trip, if last point of previous trip and first point of new points are from same trip, we modify previous trip
            if (lastTrip) {
                  // we get last point of last trip
                  const lastTripDestination = {
                    operator: operator,
                    taxi: taxi,
                    status: lastTrip.status,
                    lat: lastTrip.destination_geography.coordinates[1],
                    lon: lastTrip.destination_geography.coordinates[0],
                    timestamp: lastTrip.end_at.valueOf()/1000,
                  }
                  //and see if our first point is from same trip
                  const functionResult = this.arePointsFromSameTrip(lastTripDestination, previousPoint)
                  const isContinuationOfLastTrip = functionResult[0]
                  //if a group analysis is needed we store this info
                  if (functionResult[1]) {
                    needsGroupVerification = true
                  }

                  //if points are the same we init start of trip as start of previous trip
                  if (isContinuationOfLastTrip) {
                      startOfCurrentTrip = {
                        operator: operator,
                        taxi: taxi,
                        status: lastTrip.status,
                        lat: lastTrip.origin_geography.coordinates[1],
                        lon: lastTrip.origin_geography.coordinates[0],
                        timestamp: lastTrip.start_at.valueOf()/1000,
                      }
                      tripDistance = lastTrip.distance_meters + this.getPointsDistanceMeters({ lon: lastTrip.destination_geography.coordinates[0], lat: lastTrip.destination_geography.coordinates[1]}, previousPoint)
                      //we add last trip to trip to delete list since it will be replace with the trip underconstruction
                      activityIdsToDelete.push({ id: lastTrip.id, start_at: lastTrip.start_at.valueOf()/1000 })
                  } else {
                    startOfCurrentTrip = previousPoint
                    tripDistance = 0;
                    // if the activity would have been filtered, delete since it is not continued. If group verification is required and passes, it will be added again
                    if (!this._dataImporter.shouldKeepActivity(lastTrip)) {
                      activityIdsToDelete.push({ id: lastTrip.id, start_at: lastTrip.start_at.valueOf()/1000 })
                    }
                  }
            } else {
                startOfCurrentTrip = previousPoint
                tripDistance = 0
            }

            //we loop throught all points to see were each trip start and stop
            for (let nextPoint of taxiPoints) {

                const functionResult = this.arePointsFromSameTrip(previousPoint, nextPoint)
                const pointsAreSameTrip = functionResult[0]

                // if not the same trip, we create a new trip
                // in this case previousPoint is last point of activity and next point the first point of next activity
                if (pointsAreSameTrip === false) {

                    const ativitiyAttributes = {
                        taxi: previousPoint.taxi,
                        o_lat: startOfCurrentTrip.lat,
                        o_lon: startOfCurrentTrip.lon,
                        d_lat: previousPoint.lat,
                        d_lon: previousPoint.lon,
                        o_timestamp: startOfCurrentTrip.timestamp,
                        d_timestamp: previousPoint.timestamp,
                        operator: previousPoint.operator,
                        status: previousPoint.status,
                        distance_totale: parseInt(tripDistance),
                    }

                    // if this trip was submited to a group analysis we make it before
                    if (needsGroupVerification) {
                        //state variable reinitalisation
                        needsGroupVerification = false;
                        const lastTaxiActivity = currentTaxiActivitiesToImport.length > 0 ? currentTaxiActivitiesToImport[currentTaxiActivitiesToImport.length - 1] : undefined;
                        const previousGroup = lastTaxiActivity !== undefined ? lastTaxiActivity : {
                            o_timestamp: lastTrip.start_at.valueOf() / 1000,
                            d_timestamp: lastTrip.end_at.valueOf() / 1000,
                            o_lat: lastTrip.origin_geography.coordinates[1],
                            o_lon: lastTrip.origin_geography.coordinates[0],
                            d_lat: lastTrip.destination_geography.coordinates[1],
                            d_lon: lastTrip.destination_geography.coordinates[0],
                            distance_totale: lastTrip.distance_meters,
                        }
                        const groupsAreSameTrip = this.areGroupesSameTrip(previousGroup, ativitiyAttributes)
                        //if two groups are same trip we mege them
                        if (groupsAreSameTrip) {
                            // This activity is already on the list, pop it, otherwise, delete the last trip
                            if (lastTaxiActivity !== undefined) {
                                currentTaxiActivitiesToImport.pop();
                            } else {
                                activityIdsToDelete.push({ id: lastTrip.id, start_at: lastTrip.start_at.valueOf()/1000 })
                            }

                            // Add the distance between both groups
                            ativitiyAttributes['distance_totale']   = ativitiyAttributes['distance_totale'] +
                                previousGroup['distance_totale'] +
                                parseInt(this.getPointsDistanceMeters({ lon: ativitiyAttributes.o_lon, lat: ativitiyAttributes.o_lat}, { lon: previousGroup.d_lon, lat: previousGroup.d_lat}))
                            ativitiyAttributes['o_lat']             = previousGroup['o_lat']
                            ativitiyAttributes['o_lon']             = previousGroup['o_lon']
                            ativitiyAttributes['o_timestamp']       = previousGroup['o_timestamp']

                        }
                    }

                    currentTaxiActivitiesToImport.push(ativitiyAttributes)

                    //if this new trip needs to be submit to a group analysis we store this info
                    if (functionResult[1]) {
                        needsGroupVerification = true
                    }
                    startOfCurrentTrip = nextPoint
                    tripDistance = 0

                //we add distance between points to current distance if points are same trip
                } else {
                    tripDistance += this.getPointsDistanceMeters(previousPoint, nextPoint)
                }
                previousPoint = nextPoint
            }
            //we finish the last trip with last point
            const ativitiyAttributes = {
                taxi: previousPoint.taxi,
                o_lat: startOfCurrentTrip.lat,
                o_lon: startOfCurrentTrip.lon,
                d_lat: previousPoint.lat,
                d_lon: previousPoint.lon,
                o_timestamp: startOfCurrentTrip.timestamp,
                d_timestamp: previousPoint.timestamp,
                operator: previousPoint.operator,
                status: previousPoint.status,
                distance_totale: parseInt(tripDistance),
            }
            currentTaxiActivitiesToImport.push(ativitiyAttributes)

            //in case of a next trip, we delete only trips that starts before the end of our last trip
            if (nextTrips) {
                const lastTripTimestamp = parseFloat(currentTaxiActivitiesToImport[currentTaxiActivitiesToImport.length - 1].d_timestamp)
                const firstTripTimestamp = parseFloat(currentTaxiActivitiesToImport[0].o_timestamp)
                for (let nextTrip of nextTrips) {
                    if (
                           ((nextTrip.start_at.valueOf()/1000 >= firstTripTimestamp) && (nextTrip.end_at.valueOf()/1000 <= lastTripTimestamp)) // if next trips starts and ends between start and end of importation
                        || ((nextTrip.start_at.valueOf()/1000 <= firstTripTimestamp) && (nextTrip.end_at.valueOf()/1000 >= firstTripTimestamp)) // if next trips starts before start of importation and ends after start of importation
                        || ((nextTrip.start_at.valueOf()/1000 <= lastTripTimestamp)  && (nextTrip.end_at.valueOf()/1000 >= lastTripTimestamp)) // if next trips starts before start of importation and ends after start of importation
                        || ((nextTrip.start_at.valueOf()/1000 <= firstTripTimestamp) && (nextTrip.end_at.valueOf()/1000 >= lastTripTimestamp)) // if next trips starts before start of importation and ends after end of importation
                    ) {
                        activityIdsToDelete.push({ id: nextTrip.id, start_at: nextTrip.start_at.valueOf()/1000 })
                    }
                }
            }
            // Merge unoccupied activities of less than 30 seconds that are 60 seconds apart from other unoccupied activities
            activitiesAttributesForImport[taxiId] = this.mergeActivityGlitches(currentTaxiActivitiesToImport, 30, 60);
        }
    }

    //once all new trips are created for one taxie, we import them
    const countAllTaxiActivities = Object.keys(activitiesAttributesForImport).reduce((count, taxiId) => count + activitiesAttributesForImport[taxiId].length, 0);
    console.log(`importing ${countAllTaxiActivities} new activities`)
    const activitiesAttributesForDatabase = []
    for (let taxiId in activitiesAttributesForImport) {
        const currentTaxiActivityCount =  activitiesAttributesForImport[taxiId].length;
        for (let i = 0; i < currentTaxiActivityCount; i++) {
            const taxiActivityAttributes = activitiesAttributesForImport[taxiId][i];
            await this._dataImporter.filterTaxiActivity(taxiActivityAttributes, dataSourceId, activitiesAttributesForDatabase, periodLatestTime, i === currentTaxiActivityCount - 1)
        }
    }
    console.log(`\t${activitiesAttributesForDatabase.length} new activities created`)
    console.log(`\t${countAllTaxiActivities - activitiesAttributesForDatabase.length} new activities filterd`)
    console.log(`\t${activityIdsToDelete.length} old activities deleted`)
    if (activitiesAttributesForDatabase.length > 0) {
        await taxiActivitesDbQueries.createMultiple(activitiesAttributesForDatabase, dataSourceId);
    }
    if (activityIdsToDelete.length > 0) {
        await taxiActivitesDbQueries.deleteMultiple(activityIdsToDelete, dataSourceId);
    }
  }

  getPointsDistanceMeters(pointA, pointB) {
    const geomA = turfPoint([parseFloat(pointA.lon), parseFloat(pointA.lat)]);
    const geomB = turfPoint([parseFloat(pointB.lon), parseFloat(pointB.lat)]);
    return turfDistance(geomA, geomB)*1000 //turfDistance is in km is in kilometers
  }


  arePointsFromSameTrip(pointA, pointB) {
        //returns a list where first part tels if two points are from same trip and second variables tells if a group analysis is needed
        //this methodology is based on Anjeli Narrainen master thesis (cf fig 4.20 p.130)
        if (pointA.status !== pointB.status) {
            // points a and b have differents statuses, not the same trip
            return [false, false]
            // since we don't register offline status, we don't need to distinct cases if time between points is less or more than 60 secs
        } else if (pointA.status !== 'occupied') {
            // if status is not occupied
            if ((parseInt(pointB.timestamp) - parseInt(pointA.timestamp)) < 60) {
                //duration between a and b is less than 60 sec
                return [true, false]
            } else {
                //duration between a and b is greater than 60 sec
                return [false, false]
            }
        } else if ((parseInt(pointB.timestamp) - parseInt(pointA.timestamp)) < 60) {
            // status is occupied and duration between a and b is less than 60 sec
            return [true, false]
        } else if ((parseInt(pointB.timestamp) - parseInt(pointA.timestamp)) < 600) {
            // duration between a and b is greater than 60sec and less than 600 sec
            return [false, true]
        } else {
            // duration between a and b is greater than 600 sec
            return [false, false];
        }
    }

  areGroupesSameTrip(groupA, groupB) {
    // this focntion is used to illustrate Anjeli Narrainen master thesis fig 4.12 (cf fig 4.12 p.116)
    const timeLowerBound = 372 // in seconds. value is based on Anjeli Narrainen master thesis and calculated on 2019 data (cf p.110)
    const timeHigherBound = 1458 // in seconds. value is based on Anjeli Narrainen master thesis and calculated on 2019 data (cf p.110)
    const distLowerBound = 1730 // in meters. value is based on Anjeli Narrainen master thesis and calculated on 2019 data (cf p.110)
    const distHigherBound = 8744 // in meters. value is based on Anjeli Narrainen master thesis and calculated on 2019 data (cf p.110)

    const durationA = groupA.d_timestamp - groupA.o_timestamp;
    const durationB = groupB.d_timestamp - groupB.o_timestamp;

    const bothGroupCanBeTrip = (groupA.distance_totale >= distLowerBound && groupB.distance_totale >= distLowerBound) || (durationA >= timeLowerBound && durationB >= timeLowerBound)

    const oneGroupCanBeTrip = (groupA.distance_totale + groupB.distance_totale >= distHigherBound) || (durationA + durationB >= timeHigherBound)

    return bothGroupCanBeTrip || oneGroupCanBeTrip

  }

  // If a non occupied activity of less than 30
  // seconds is between 2 non-occupied activities of the same status less than 30
  // seconds apart, it is considered an error and it is merged with previous
  // activity.
  mergeActivityGlitches(activities, mergeDuration = 30, timeBetweenActivities = 60) {
    if (activities.length < 3) {
        return activities;
    }
    const newActivities = [activities[0]];
    let currentIdx = 1;
    while (currentIdx < activities.length - 1) {
        let keepCurrent = true;
        const currentActivity = activities[currentIdx];
        const previousActivity = newActivities[newActivities.length - 1];
        // Quickly ignore occupied activities
        if (currentActivity.status !== 'occupied' && previousActivity.status !== 'occupied') {
            const currentStart = moment.unix(currentActivity.o_timestamp);
            const currentEnd = moment.unix(currentActivity.d_timestamp);
            const duration = (currentEnd - currentStart) / 1000;
            if (duration <= mergeDuration && activities[currentIdx + 1].status === previousActivity.status) {
                const nextActivity = activities[currentIdx + 1];
                // Time between activities should be less than 30 seconds
                const previousEnd = moment.unix(previousActivity.d_timestamp);
                const nextStart = moment.unix(nextActivity.o_timestamp);
                if ((currentStart - previousEnd) / 1000 <= timeBetweenActivities && (nextStart - currentEnd) / 1000 <= timeBetweenActivities) {
                    // Merge the 3 activities, calculation distances before changing coordinates
                    previousActivity.distance_totale += currentActivity.distance_totale + nextActivity.distance_totale;
                    // Add distances between activities
                    previousActivity.distance_totale += parseInt(this.getPointsDistanceMeters({lon: previousActivity.d_lon, lat: previousActivity.d_lat}, {lon: currentActivity.o_lon, lat: currentActivity.o_lat}));
                    previousActivity.distance_totale += parseInt(this.getPointsDistanceMeters({lon: currentActivity.d_lon, lat: currentActivity.d_lat}, {lon: nextActivity.o_lon, lat: nextActivity.o_lat}));

                    previousActivity.d_timestamp = nextActivity.d_timestamp;
                    previousActivity.d_lat = nextActivity.d_lat;
                    previousActivity.d_lon = nextActivity.d_lon;
                    // Go to activity after next
                    keepCurrent = false;
                    currentIdx = currentIdx + 2;
                }
            }
        }
        if (keepCurrent) {
            // Activity is kept as is
            newActivities.push(currentActivity);
            currentIdx++;
        }
    }
    if (currentIdx === activities.length - 1) {
        newActivities.push(activities[activities.length - 1]);
    }
    return newActivities;
  }

}

export default OctaviImporter
