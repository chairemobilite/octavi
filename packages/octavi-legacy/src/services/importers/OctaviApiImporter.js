
import OctaviImporter          from './OctaviImporter';
import { _isBlank }            from 'chaire-lib-common/lib/utils/LodashExtensions';
import taxiActivitesDbQueries  from '../../models/db/taxiActivities.db.queries';
import BTMService              from '../btm/BTMService';

// The taxi API requests intervals of 10 minutes, other intervals return errors
const loopLengthMs = 10 * 60 * 1000;

class OctaviApiImporter extends OctaviImporter {

  constructor(attributes) {
    super(attributes, false);
  }

  /**
   * Get the start and end time for the importation period. They can be set
   * manually, or otherwise configured from the previous data imported
   *
   * @param dataSourceId ID of the datasource to import
   * @param start_at begining of importation period. If null start a last trip
   * end_date of db rounded to 10 minute
   * @param end_at end of importation period. If null ends at now.
   */
  async getImportPeriod(dataSourceId, start_at, end_at) {

    console.log('Getting query start and end times');
    //init start and end dates if needed
    if (!start_at) {
        const start_at_str = await taxiActivitesDbQueries.selectLastActivityTimestamp({dataSourceId});
        if (!start_at_str) {
          throw 'No data in database and no start date specified. Please add a date as third argument on the command line, with format `yyyy-MM-DD`';
        }
        start_at = new Date(start_at_str);
    }
    if (!end_at) {
        end_at = new Date()
        // To avoid loosing data if some taxis have delay or transmission problem, we get the last 12 hours
        end_at.setHours(end_at.getHours() - 12);
    }
    //round start and end dates to 10 minutes
    start_at.setMinutes(Math.floor(start_at.getMinutes()/10) * 10)
    start_at.setSeconds(0)
    start_at.setMilliseconds(0)

    end_at.setMinutes(Math.ceil(end_at.getMinutes()/10) * 10)
    end_at.setSeconds(0)
    end_at.setMilliseconds(0)
    return [start_at, end_at];
  }


  /**
   * @param dataSourceId
   * @param start_at begining of importation period, should not be null
   * @param end_at end of importation period, should not be null
   */
  async extractTaxiPositionsFromAPI(dataSourceId, start_at, end_at) {

    //init start and end dates if needed
    if (!start_at || !end_at) {
        throw 'Times are not set, call the `getImportPeriod` function before extracting data';
    }
    console.log(`Importation of taxi gps data from BTM API from ${start_at} to ${end_at}`);

    const numberOfLoops = (end_at - start_at)/loopLengthMs // this corresponde to number of ten minutes intervall between start and end
    //first we import taxi objects

    const fetchTaxiPositionsPromises = [];
    for (let i=0 ; i<numberOfLoops ; i++) {
        fetchTaxiPositionsPromises.push(
            this._dataImporter.fetchTaxiPositions({
                btmServiceFunction: BTMService.taxiPositions.bind(BTMService),
                date: new Date(start_at.getTime() + i*loopLengthMs)
            }).then((response) => {
                return (response);
            })
        );
    }

    const taxiResponses = await Promise.all(fetchTaxiPositionsPromises);
    //group all points into one list for each driver. To speed up search in pbject, each driver is affected to its operator
    const points = [];
    for (let tenMinutesResponse of taxiResponses) {
        if (tenMinutesResponse && tenMinutesResponse.items) {
            for (let pointsGroup of tenMinutesResponse.items) {
                for (let point of pointsGroup.items) {
                    // verification of points attributes
                    this.validateTaxiPositionFeature(point)
                    if (this.isValid()) {
                        points.push(point)
                    } else {
                        console.error(`Invalid point received from API`)
                    }
                }
            }
        } else {
            console.warn('Invalid response for some interval');
        }
    }
    return points;
  }

}

export default OctaviApiImporter;
