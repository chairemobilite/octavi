/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'chaire-lib-backend/lib/config/dotenv.config';

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import moment from 'moment';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import OctaviApiImporter from 'octavi-legacy/lib/services/importers/OctaviApiImporter';
import prepareSocketRoutes from '../scripts/prepareProcessRoutes';
import loadAllTaxiCollections from 'octavi-legacy/lib/services/taxis/CollectionService';
import getDataSourceId from 'octavi-legacy/lib/services/dataSources/getDataSourceId';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';

// Ensure import directory exists to save any data
directoryManager.createDirectoryIfNotExists('imports');

const run = async () => {
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv)).argv;
    const dataSource = argv['dataSource'];
    const startDateArg = argv['start'];
    const startDate = startDateArg ? new Date(startDateArg) : undefined;
    const endDateArg = argv['end'];
    const endDate = endDateArg ? new Date(endDateArg) : undefined;
    const noTaxiImport = argv['noTaxiImport'];

    prepareSocketRoutes();

    await loadAllTaxiCollections(serviceLocator.collectionManager, serviceLocator.eventManager);

    const dataSourceId = await getDataSourceId(dataSource);

    const octaviApiImporter = new OctaviApiImporter();
    // Do not fetch all at once if the time range is very large. Do 3 hours at a time
    const [startImportPeriod, endImportPeriod] = await octaviApiImporter.getImportPeriod(
        dataSourceId,
        startDate && startDate.toString() !== 'Invalid Date' ? startDate : undefined,
        endDate && endDate.toString() !== 'Invalid Date' ? endDate : undefined
    );
    let currentStart = startImportPeriod;
    // Import only on first iteration if import is set
    let noTaxiImportForStep = noTaxiImport;
    while (currentStart < endImportPeriod) {
        const endCurrentPeriod = new Date(currentStart);
        endCurrentPeriod.setHours(endCurrentPeriod.getHours() + 3);
        const endTime = endCurrentPeriod <= endImportPeriod ? endCurrentPeriod : endImportPeriod;

        const taxiPositions = await octaviApiImporter.extractTaxiPositionsFromAPI(dataSourceId, currentStart, endTime);
        await octaviApiImporter.createActivitiesFromPositions(
            taxiPositions,
            dataSourceId,
            noTaxiImportForStep,
            moment(endTime.getTime())
        );

        noTaxiImportForStep = true;
        currentStart = endCurrentPeriod;
    }
};

run()
    .then(() => {
        console.log('Import taxi points from API complete');
        process.exit();
    })
    .catch((error) => {
        console.error('Error importing data from API', error);
        process.exit();
    });
