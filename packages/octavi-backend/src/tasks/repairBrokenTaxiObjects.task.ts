/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'chaire-lib-backend/lib/config/dotenv.config';

import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { Knex } from 'knex';

import { OctaviTaxiDataImporter } from 'octavi-legacy/lib/services/importers/OctaviTaxiDataImporter';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import prepareSocketRoutes from '../scripts/prepareProcessRoutes';
import getDataSourceId from 'octavi-legacy/lib/services/dataSources/getDataSourceId';
import loadAllTaxiCollections from 'octavi-legacy/lib/services/taxis/CollectionService';
import Taxi from 'octavi-legacy/lib/services/taxis/Taxi';
import TaxiDriver from 'octavi-legacy/lib/services/taxis/TaxiDriver';
import TaxiPermit from 'octavi-legacy/lib/services/taxis/TaxiPermit';
import TaxiVehicle from 'octavi-legacy/lib/services/taxis/TaxiVehicle';
import taxiParser from 'octavi-legacy/lib/services/btm/BTMApiParsers/Taxi.parser';
import vehicleParser from 'octavi-legacy/lib/services/btm/BTMApiParsers/TaxiVehicle.parser';
import permitParser from 'octavi-legacy/lib/services/btm/BTMApiParsers/TaxiPermit.parser';
import driverParser from 'octavi-legacy/lib/services/btm/BTMApiParsers/TaxiDriver.parser';
import taxisDbQueries from 'octavi-legacy/lib/models/db/taxis.db.queries';
import driversDbQueries from 'octavi-legacy/lib/models/db/taxiDrivers.db.queries';
import permitsDbQueries from 'octavi-legacy/lib/models/db/taxiPermits.db.queries';
import vehiclesDbQueries from 'octavi-legacy/lib/models/db/taxiVehicles.db.queries';
import BTMService from 'octavi-legacy/lib/services/btm/BTMService';

/**
 * An error in the data import caused objects not to be recognized as existing,
 * so new objects were created, which then may be used as foreign keys to other
 * objects. The objects whose keys were not recognized are the operators and
 * drivers.
 *
 * This query selects the object to keep (the first one ordered by created_at,
 * integer_id asc), as well as those to replace. Then it automatically searches
 * all foreign keys to this object table (the operators has a foreign key in the
 * dynamically created taxi_activities table) and replaces all duplicate ids
 * with the one from the reference object. The duplicate objects are then
 * deleted from the database, keeping only the reference one.
 *
 * @param knex
 * @returns
 */
async function removeDuplicateRecords(knex: Knex): Promise<void> {
    await knex.transaction(async (trx) => {
        await trx.raw(`
        DO $migration$
        DECLARE
            target_table text;
            referenced_table_oid regclass;
            foreign_key record;
        BEGIN
            CREATE TEMP TABLE duplicate_import_id_map (
                target_oid oid NOT NULL,
                duplicate_id uuid NOT NULL,
                keeper_id uuid NOT NULL,
                PRIMARY KEY (target_oid, duplicate_id)
            ) ON COMMIT DROP;

            FOREACH target_table IN ARRAY ARRAY['tr_taxi_drivers', 'tr_taxi_operators']
            LOOP
                referenced_table_oid := to_regclass(target_table);
                IF referenced_table_oid IS NULL THEN
                    RAISE EXCEPTION 'Required table % does not exist', target_table;
                END IF;

                -- format() replaces %s with the referenced table name. The $1 inside
                -- the dynamic query is a bound parameter supplied by USING; it stores
                -- that table's OID alongside each duplicate mapping.
                EXECUTE format(
                    $query$
                        INSERT INTO pg_temp.duplicate_import_id_map (target_oid, duplicate_id, keeper_id)
                        SELECT $1, duplicates.id, duplicates.keeper_id
                        FROM (
                            SELECT
                                id,
                                first_value(id) OVER (
                                    PARTITION BY internal_id
                                    ORDER BY created_at ASC NULLS LAST, integer_id ASC NULLS LAST, id ASC
                                ) AS keeper_id,
                                row_number() OVER (
                                    PARTITION BY internal_id
                                    ORDER BY created_at ASC NULLS LAST, integer_id ASC NULLS LAST, id ASC
                                ) AS row_number
                            FROM %s
                            WHERE internal_id IS NOT NULL
                        ) AS duplicates
                        WHERE duplicates.row_number > 1
                    $query$,
                    referenced_table_oid
                ) USING referenced_table_oid;

                -- PostgreSQL does not support updating only part of a composite
                -- foreign key, so fail before changing any references if one exists.
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE contype = 'f'
                      AND confrelid = referenced_table_oid
                      AND cardinality(conkey) <> 1
                      AND EXISTS (
                          SELECT 1
                          FROM pg_temp.duplicate_import_id_map AS id_map
                          WHERE id_map.target_oid = referenced_table_oid
                      )
                ) THEN
                    RAISE EXCEPTION 'Cannot repair duplicate references to %: composite foreign keys are not supported', target_table;
                END IF;

                -- Discover every declared single-column foreign key that references
                -- this table from PostgreSQL's catalog, rather than listing child
                -- tables (including dynamically named taxi activity tables) here.
                FOR foreign_key IN
                    SELECT
                        child_namespace.nspname AS schema_name,
                        child_table.relname AS table_name,
                        child_column.attname AS column_name
                    FROM pg_constraint AS constraint_info
                    JOIN pg_class AS child_table
                      ON child_table.oid = constraint_info.conrelid
                    JOIN pg_namespace AS child_namespace
                      ON child_namespace.oid = child_table.relnamespace
                    JOIN LATERAL unnest(constraint_info.conkey) AS key_column(attnum)
                      ON true
                    JOIN pg_attribute AS child_column
                      ON child_column.attrelid = child_table.oid
                     AND child_column.attnum = key_column.attnum
                    WHERE constraint_info.contype = 'f'
                      AND constraint_info.confrelid = referenced_table_oid
                LOOP
                    -- %I safely quotes each discovered identifier (schema, table,
                    -- and column); $1 is again the referenced table OID bound by USING.
                    EXECUTE format(
                        'UPDATE %I.%I AS child
                         SET %I = id_map.keeper_id
                         FROM pg_temp.duplicate_import_id_map AS id_map
                         WHERE id_map.target_oid = $1
                           AND child.%I = id_map.duplicate_id',
                        foreign_key.schema_name,
                        foreign_key.table_name,
                        foreign_key.column_name,
                        foreign_key.column_name
                    ) USING referenced_table_oid;
                END LOOP;

                -- Delete the duplicate parent rows only after all declared references
                -- have been redirected to their keeper.
                EXECUTE format(
                    'DELETE FROM %s
                     WHERE id IN (
                         SELECT duplicate_id
                         FROM pg_temp.duplicate_import_id_map
                         WHERE target_oid = $1
                     )',
                    referenced_table_oid
                ) USING referenced_table_oid;
            END LOOP;
        END
        $migration$;
        `);
    });
}

/**
 * Internal class extending the data importer to use a null etag and force
 * reload all without date check. The base class being in javascript, typescript
 * cannot type any of the methods, so we cast as `any`, which is an acceptable
 * approximation for a one-time script.
 */
class OctaviAllDataImporter extends OctaviTaxiDataImporter {
    constructor(attributes: any) {
        super(attributes);
    }

    // Simply copied from the base class, so that we don't check etag and data
    // diff. It's a one-time script, so not worth extending the base class to
    // allow this.
    async updateTaxiObjects(parameters: any) {
        console.log(`updating ${parameters.objectsName}`);

        const taxiObjectsResponse = await parameters.btmServiceFunction({ etag: null });
        if (taxiObjectsResponse.status === 'NotModified') {
            console.log(`No changes since last check for '${parameters.objectsName}'`);
            return;
        }
        const taxiObjectsCount = taxiObjectsResponse.length ? taxiObjectsResponse.length : 0;

        const updatedTaxiObjectsAttributes: any[] = [];
        const newTaxiObjectsAttributes: any[] = [];

        for (let i = 0; i < taxiObjectsCount; i++) {
            const taxiObjectData = taxiObjectsResponse[i];
            const taxiObjectInternalId = taxiObjectData.id.toString();

            const taxiObject = parameters.collection.getByInternalId(taxiObjectInternalId);

            if (taxiObject !== undefined && taxiObject !== null) {
                // We need to update the existing data:
                //if object type is taxi, parser takes other collection (drivers, permits, vehicules) as arguement
                if (parameters.objectsName === 'taxis') {
                    taxiObject.mergeAttributes(
                        parameters.parser(
                            taxiObjectData,
                            parameters.dataSourceId,
                            (this as any)._driversCollection,
                            (this as any)._permitsCollection,
                            (this as any)._vehiclesCollection
                        )
                    ); //ask what is data source
                } else {
                    // for other types parser only takes data
                    taxiObject.mergeAttributes(parameters.parser(taxiObjectData));
                }
                updatedTaxiObjectsAttributes.push(taxiObject.attributes);
            } else {
                // new taxiObject data
                const newTaxiObject = new parameters.objectClass(
                    parameters.parser(
                        taxiObjectData,
                        parameters.dataSourceId,
                        (this as any)._driversCollection,
                        (this as any)._permitsCollection,
                        (this as any)._vehiclesCollection
                    ),
                    true,
                    serviceLocator.collectionManager
                );
                newTaxiObjectsAttributes.push(newTaxiObject.attributes);
            }
        }

        // save new taxiObjects and update existing taxiObjects in database:
        await parameters.dbQueries.createMultiple(newTaxiObjectsAttributes);
        console.log(`  ${newTaxiObjectsAttributes.length} created ${parameters.objectsName}`);
        await parameters.dbQueries.updateMultiple(updatedTaxiObjectsAttributes);
        console.log(`  ${updatedTaxiObjectsAttributes.length} updated ${parameters.objectsName}`);
    }
}

// Function copied and adapted from a method of OctaviImporter, so we can call
// it without being part of the import process for this one-off script.
const importTaxiObjects = async (dataSourceId: string, dataImporter: OctaviAllDataImporter) => {
    const updateTaxiObjectsPromises: Promise<void>[] = [];
    console.log('Importation of taxi objects');

    // Copied from the OctaviImporter, with same parsers, queries and collections
    updateTaxiObjectsPromises.push(
        dataImporter.updateTaxiObjects({
            objectsName: 'drivers',
            objectClass: TaxiDriver,
            dbQueries: driversDbQueries,
            parser: driverParser,
            collection: serviceLocator.collectionManager.get('taxiDrivers'),
            btmServiceFunction: BTMService.drivers.bind(BTMService),
            dataSourceId: dataSourceId,
            updateEtag: true
        })
    );
    updateTaxiObjectsPromises.push(
        dataImporter.updateTaxiObjects({
            objectsName: 'permits',
            objectClass: TaxiPermit,
            dbQueries: permitsDbQueries,
            parser: permitParser,
            collection: serviceLocator.collectionManager.get('taxiPermits'),
            btmServiceFunction: BTMService.permits.bind(BTMService),
            dataSourceId: dataSourceId,
            updateEtag: true
        })
    );
    updateTaxiObjectsPromises.push(
        dataImporter.updateTaxiObjects({
            objectsName: 'vehicles',
            objectClass: TaxiVehicle,
            dbQueries: vehiclesDbQueries,
            parser: vehicleParser,
            collection: serviceLocator.collectionManager.get('taxiVehicles'),
            btmServiceFunction: BTMService.vehicles.bind(BTMService),
            dataSourceId: dataSourceId,
            updateEtag: true
        })
    );

    await Promise.all(updateTaxiObjectsPromises);
    await loadAllTaxiCollections(serviceLocator.collectionManager, serviceLocator.eventManager);
    await dataImporter.updateTaxiObjects({
        objectsName: 'taxis',
        objectClass: Taxi,
        dbQueries: taxisDbQueries,
        parser: taxiParser,
        collection: serviceLocator.collectionManager.get('taxis'),
        btmServiceFunction: BTMService.taxis.bind(BTMService),
        dataSourceId: dataSourceId,
        updateEtag: true
    });
};

const run = async () => {
    // Repair the duplicate objects in the database
    console.log('Removing duplicate records from DB, keeping only one and updating keys...');
    await removeDuplicateRecords(knex);
    console.log('Done removing duplicate records');

    // Re-import the taxi objects, so `null` references can link to actual IDs.
    // We need to import all data, so we do not use the etag
    console.log('Re-running object import to fix broken objects');
    // Prepare the app and load the data
    prepareSocketRoutes();
    await loadAllTaxiCollections(serviceLocator.collectionManager, serviceLocator.eventManager);

    // Load the data in the data source called btm_api
    const dataSourceId = await getDataSourceId('btm_api');
    const taxiDataImporter = new OctaviAllDataImporter({});
    await importTaxiObjects(dataSourceId, taxiDataImporter);

    console.log('Done importing objects');
};

run()
    .then(() => {
        console.log('Successfully repaired taxi data');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error repairing taxi data', error);
        process.exit(1);
    });
