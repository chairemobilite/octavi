import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_taxi_drivers';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.specificType('integer_id', 'serial').index(); // unique per driver uuid
        table.string('internal_id').index();
        table.string('first_name');
        table.string('last_name');
        table.string('email');
        table.string('department').index();
        table.string('professional_license').index();
        table.date('birth_date').index();
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
