import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_taxi_activities_master';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.string('table_name').notNullable();
        table.date('start_date').notNullable();
        table.uuid('data_source_id').notNullable();
        table.timestamp('last_trips_end_at', { useTz: false }); // UTC
        table.unique(['start_date', 'data_source_id'], { indexName: 'unique_data_source_start' });
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
