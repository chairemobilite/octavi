/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'chaire-lib-backend/lib/config/dotenv.config';

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import prepareSocketRoutes from '../scripts/prepareProcessRoutes';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import dataSourceDbQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import runJoinZonesToActivities from 'octavi-legacy/lib/services/zones/joinZonesToTaxiActivities';

// Ensure import directory exists to save any data
directoryManager.createDirectoryIfNotExists('imports');

const run = async () => {
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv)).argv;
    const taxiDataSourceShortname = argv['taxiDs'];
    const zoneDataSourceShortname = argv['zonesDs'];
    if (taxiDataSourceShortname === undefined || zoneDataSourceShortname === undefined) {
        throw new Error(
            'joinZonesToTaxiActivities: taxi and zones data sources need to be specified on the command line with --taxiDs dataSourceShortName --zonesDs dataSourceShortName'
        );
    }
    const startDateArg = argv['start'];
    const startDateDate = startDateArg ? new Date(startDateArg) : undefined;
    const endDateArg = argv['end'];
    const endDateDate = endDateArg ? new Date(endDateArg) : undefined;
    const startTs =
        startDateDate && startDateDate.toString() !== 'Invalid Date' ? startDateDate.getTime() / 1000 : undefined;
    const endTs = endDateDate && endDateDate.toString() !== 'Invalid Date' ? endDateDate.getTime() / 1000 : undefined;

    prepareSocketRoutes();

    const taxiActivitiesDataSource = await dataSourceDbQueries.findByName(taxiDataSourceShortname);
    const zoneDataSource = await dataSourceDbQueries.findByName(zoneDataSourceShortname);

    if (taxiActivitiesDataSource === undefined) {
        throw new Error(`taxi activities datasource ${taxiDataSourceShortname} does not exist`);
    }
    if (zoneDataSource === undefined) {
        throw new Error(`zones datasource ${zoneDataSourceShortname} does not exist`);
    }

    await runJoinZonesToActivities(taxiActivitiesDataSource.id, zoneDataSource.id, startTs, endTs);
};

run()
    .then(() => {
        console.log('Successfully joined zones to taxi activities');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error joining zones to taxi activities', error);
        process.exit(1);
    });
