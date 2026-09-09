import { validate as uuidValidate } from 'uuid';

import { select, input, confirm } from '@inquirer/prompts';
import { v4 as uuidV4 } from 'uuid';
import GenericDataImportTask from 'chaire-lib-backend/lib/tasks/dataImport/genericDataImportTask';

import serviceLocator           from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank }             from 'chaire-lib-common/lib/utils/LodashExtensions';
import DataSource               from 'chaire-lib-common/lib/services/dataSource/DataSource';
import dataSourcesDbQueries     from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';

// add possibility to input datasource as argument in order to automate this script --> data source uuid must be put as second arg for this
// if data source is specified you alos have posibility to specify not to import taxi objects by adding a third argument noTaxiImport
export default async (dataSourceArg = undefined) => {
    const dataSources = serviceLocator.collectionManager.get('dataSources').getFeatures();

    let dataSourceId = undefined;
    let answers;
    if (dataSourceArg) {
        if (uuidValidate(dataSourceArg) && await dataSourcesDbQueries.exists(dataSourceArg)) {
            // The data source is an ID
            dataSourceId = dataSourceArg
        } else {
            // Is it a data source name?
            const dataSourceByName = await dataSourcesDbQueries.findByName(dataSourceArg);
            if (dataSourceByName) {
                dataSourceId = dataSourceByName.id;
            }
        }
    }
    if (dataSourceId === undefined) {
        const dataSourcesChoices = dataSources.map(function(dataSource) {
            return {
            name: dataSource.toString(),
            value: dataSource.get('id')
            }
        });
        dataSourcesChoices.push({
            name : '--New data source--',
            value: '__newDataSource__'
        });

        dataSourceId = await select({
            message: 'Please select a data source for import',
            choices: dataSourcesChoices
        });

        if (dataSourceId === GenericDataImportTask.NEW_DATA_SOURCE_ID) {
            const newDataSourceShortname = await input({
                message: 'New data source shortname'
            });
            const newDataSourceName = await input({
                message: 'New data source name'
            });

            const dataSource = new DataSource({
                id       : uuidV4(),
                shortname: newDataSourceShortname,
                type: 'taxiTransactions',
                name     : newDataSourceName
            }, true, serviceLocator.collectionManager);

            dataSourceId = dataSource.getId();

            await dataSourcesDbQueries.create(dataSource.attributes);
            console.log(`data source ${dataSourceId} saved to db`);
        }

    }

    return dataSourceId;
};
