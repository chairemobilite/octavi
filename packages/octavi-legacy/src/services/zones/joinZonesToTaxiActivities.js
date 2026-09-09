import _camelCase   from 'lodash/camelCase';
import _set         from 'lodash/set';

import taxiActivitesDbQueries   from '../../models/db/taxiActivities.db.queries';
import { joinToPointsByBatch } from '../../models/db/zonesExtra.db.queries';

const clearLastLines = (count) => {
    process.stdout.moveCursor(0, -count)
    process.stdout.clearScreenDown()
  }

const joinPointsOnAttributes = async({ pointsTableName, zonesDataSourceId, pointsDataSourceId }, parameters, joinAttributeName) => {
    parameters.nullColumn = `data->'zones'->>'${joinAttributeName}'`;
    const pointsGeographyColumnName = joinAttributeName + '_geography';
    const minMax = parameters.minMax || {};

    console.time(`joining zones on ${joinAttributeName}`);
    const response = await joinToPointsByBatch(zonesDataSourceId, pointsDataSourceId, pointsTableName, pointsGeographyColumnName, parameters);
    console.timeEnd(`joining zones on ${joinAttributeName}`);

    // build pointsAttributes by batch
    if (response.response) {
      return response.response
        .filter(x => minMax.min === undefined && minMax.max === undefined ? true : x.zone_id)
        .map( x => ({
            id : x.point_id,
            data: x.data,
            [joinAttributeName] : x.zone_id ? x.zone_id : "noMatchFound"
        }));
    } else {
        console.error('wrong response from database');
        return [];
    }
}

const joinPointsOnZones = async(data, minMax = undefined, nullOnly = true) => {
    const parameters = {
        nullOnly,
        minMax
    }

    const pointsToUpdate = {};
    // Join on origin
    const origPointAttributes = await joinPointsOnAttributes(data, parameters, 'origin');
    origPointAttributes.forEach((point) => {
        const pointToUpdate = pointsToUpdate[point.id] || { id: point.id, data: point.data };
        _set(pointToUpdate.data, `zones.origin`, point.origin);
        pointsToUpdate[point.id] = pointToUpdate;
    });

    // Join on destination
    const destPointAttributes = await joinPointsOnAttributes(data, parameters, 'destination');
    destPointAttributes.forEach((point) => {
        const pointToUpdate = pointsToUpdate[point.id] || { id: point.id, data: point.data };
        _set(pointToUpdate.data, `zones.destination`, point.destination);
        pointsToUpdate[point.id] = pointToUpdate;
    });

    return Object.values(pointsToUpdate);
}

const run = async (pointsDataSourceId, zonesDataSourceId, startTs, endTs) => {

  let joinAttributeName;

  // Load and update DataBase by month
  const monthTablesList = startTs && endTs ?
    await taxiActivitesDbQueries.getTablesNameForDateRangeAndDataSource(startTs, endTs, pointsDataSourceId) :
    (await taxiActivitesDbQueries.getAllTablesForDataSource({dataSourceId: pointsDataSourceId})).map(tblInfo => tblInfo.table_name);

  console.log('joining points to zones...');
  // To reduce number of intersects, split the zone ids for each query. Last split will get the unmatched points
  // const splitBy = [{max: '4'}, {min: '4', max: '8'}, {min: '8', max: 'c'}, {min: 'c'}, {}];
  const splitBy = [{}];

  for (let pointsTableName of monthTablesList) {
    console.log('Joining for table ', pointsTableName);
    // Match Zones by month
    // if null only is set to true only points for which the origin/destination zones is null will be calculated
    // if you want to recalculate this attributes for all points set the second parameter of joinPointsOnZones to false and change the splitBy to be [{}]

    // Split the zones ids in chunks, to avoid nxm query complexity, where n is
    // the number of activities and m the number of zones. This will divide by t
    // the first batch of queries, where t is the number of splits. And each
    // subsequent query will have less unassigned points.
    for (let minMax of splitBy) {
        const pointAttributes = await joinPointsOnZones({ pointsTableName, zonesDataSourceId, pointsDataSourceId }, minMax, true);
        if (pointAttributes.length > 0) {
          // update data by batch
          console.time('Updating activities');
          await taxiActivitesDbQueries.updateMultiple(pointAttributes, [...Array(pointAttributes.length)].map(x => pointsTableName));
          console.timeEnd('Updating activities');
        }

    }

  }

  return;
}

export default run;
