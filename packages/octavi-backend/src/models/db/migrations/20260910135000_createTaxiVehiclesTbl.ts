import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_taxi_vehicles';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.specificType('integer_id', 'serial').index(); // unique per vehicle uuid
        table.string('internal_id').index();
        table.string('license_plate').index();
        table.string('model').index();
        table.string('constructor').index();
        table.string('model_year').index();
        table.integer('number_of_seats').index();
        table
            .enu(
                'vehicle_type',
                [
                    // enum is a js reserved word
                    'none',
                    'sedan',
                    'station_wagon',
                    'normal',
                    'mpv',
                    'other',
                    'unknown'
                ],
                { useNative: true, enumName: 'tr_taxi_vehicle_types' }
            )
            .index();
        table.string('color');
        table.boolean('is_private').index();
        table.boolean('is_temporary_replacement').index();
        table.boolean('is_special_need_vehicle').index();
        table.boolean('is_luxury').index();
        table.boolean('accepts_credit_card').index();
        table.boolean('accepts_paypass').index();
        table.boolean('accepts_amex').index();
        table.boolean('accepts_bank_checks').index();
        table.boolean('offers_fresh_drinks').index();
        table.boolean('accepts_bikes').index();
        table.boolean('has_dvd_player').index();
        table.boolean('has_tablet').index();
        table.boolean('has_wifi').index();
        table.boolean('has_baby_seat').index();
        table.boolean('accepts_pets').index();
        table.boolean('has_aircon').index();
        table.boolean('can_use_electronic_tolls').index();
        table.boolean('has_gps').index();
        table.date('technical_control_last_date');
        table.date('technical_control_expiration_date');
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
    return knex.schema.dropTable(tableName).raw('DROP TYPE tr_taxi_vehicle_types');
}
