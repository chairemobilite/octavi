import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_taxis';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.uuid('data_source_id').index();
        table.specificType('integer_id', 'serial').index(); // unique per driver uuid
        table.string('internal_id').index();
        table.float('rating').index(); // average
        table.uuid('driver_id').index();
        table.uuid('permit_id').index();
        table.uuid('vehicle_id').index();
        table.foreign('driver_id').references('tr_taxi_drivers.id').onDelete('CASCADE');
        table.foreign('permit_id').references('tr_taxi_permits.id').onDelete('CASCADE');
        table.foreign('vehicle_id').references('tr_taxi_vehicles.id').onDelete('CASCADE');
        table.json('data');
        // The addition and update of the permit
        table.timestamp('added_at', { useTz: false }); // UTC
        table.timestamp('last_updated_at', { useTz: false }); // UTC
        // Those are timestamps from the database insertion/update
        table.timestamps();
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
