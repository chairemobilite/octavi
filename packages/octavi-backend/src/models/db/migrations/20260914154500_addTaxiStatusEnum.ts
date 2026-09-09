import { Knex } from 'knex';

const enumName = 'tr_taxi_status';
const enumValues = ['none', 'free', 'occupied', 'unavailable', 'oncoming', 'answering', 'off', 'other', 'unknown'];

export async function up(knex: Knex): Promise<unknown> {
    const [{ current_schema: schemaName }] = await knex.select(knex.raw('current_schema()'));

    return await knex.raw(`
      DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_catalog.pg_type AS t
                JOIN pg_catalog.pg_namespace AS n
                    ON n.oid = t.typnamespace
                WHERE n.nspname = '${schemaName}'
                  AND t.typname = '${enumName}'
            ) THEN
                CREATE TYPE ${enumName} AS ENUM (
                    ${enumValues.map((value) => `'${value}'`).join(', ')}
                );
            END IF;
        END
        $$;`);
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.raw(`DROP TYPE ${enumName}`);
}
