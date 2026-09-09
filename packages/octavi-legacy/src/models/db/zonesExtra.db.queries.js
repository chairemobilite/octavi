import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const tableName = 'tr_zones';

const queryResponses = {
    success: function (response) {
        return {
            status: 'success',
            error: null,
            response
        };
    },
    failed: function (error) {
        const parsedError = typeof error.export === 'function' ? error.export() : error;
        console.error(parsedError);
        return {
            status: 'failed',
            error: parsedError,
            response: null
        }
    }
};

/**
 * FIXME Comes from legacy octavi. Consider other ways to join zones: either
 * direct insert in a table that would match zones, points and datasources. Or
 * maybe not at all, if we manage to have performant queries.
 */
export const joinToPointsByBatch = async function (zonesDataSourceId, pointsDataSourceId, pointsTableName, pointsGeographyColumnName = 'geography', parameters) {
        /* parameters:
        - nullOnly,
        -nullColumn,
        -minMax
        */
    if (_isBlank(zonesDataSourceId) || _isBlank(pointsDataSourceId) || _isBlank(pointsTableName) || _isBlank(pointsGeographyColumnName))
    {
        return queryResponses.failed(new TrError(
            `cannot joint zones to points because there are missing params`,
            'DBQZJ2P1',
            "ZoneJoinToPointsCouldNotBeFetchedBecauseMissingParams"
        ));
    }

    try
    {
        const minMax = parameters.minMax || {};
        const knexResponse = await knex.raw(`
            SELECT
                z.id as zone_id,
                p.id as point_id,
                p.data as data
            FROM  (
                SELECT *
                FROM ${pointsTableName} ta
                ${parameters.nullOnly ? `WHERE ta.${parameters.nullColumn} IS NULL` : ""}
            ) p
            LEFT JOIN ${tableName} z ON ST_INTERSECTS(p.${pointsGeographyColumnName}, z.geography)
            WHERE z.data_source_id = '${zonesDataSourceId}'
            ${minMax.min !== undefined ? ` AND z.id::text > '${minMax.min}'` : ''}
            ${minMax.max !== undefined ? ` AND z.id::text <= '${minMax.max}'` : ''}
        `);
        if (knexResponse && knexResponse.rows)
        {
            return queryResponses.success(knexResponse.rows);
        }
        else
        {
            return queryResponses.failed(new TrError(
            `cannot joint zones to points because database response is malformed or empty`,
            'DBQZJ2P2',
            "ZoneJoinToPointsCouldNotBeFetchedBecauseResponseMalformedOrEmpty"
            ));
        }
    }
    catch(error)
    {
        return queryResponses.failed(new TrError(
            `cannot joint zones to points because of a database error (knex error: ${error})`,
            'DBQZJ2P3',
            "ZoneJoinToPointsCouldNotBeFetchedBecauseDatabaseError"
        ));
    }
};
