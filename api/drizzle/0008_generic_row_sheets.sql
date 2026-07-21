-- 0007 shipped on origin/dev (PR #224) with persistent Row JSONB.
-- Move legacy sheet-owner child_row_id → sheet_row_id; rewrite exact {show()}
-- only on those migrated rows; remove container dynamic source + child_row_id
-- without converting templates to sheets; delete former container templates only
-- when they are unreferenced elsewhere.

DO $$
DECLARE
	unsupported_show_count integer;
BEGIN
	CREATE TEMP TABLE _container_template_ids ON COMMIT DROP AS
	SELECT DISTINCT (data ->> 'child_row_id')::uuid AS id
	FROM "Row"
	WHERE type IN ('VerticalContainer', 'HorizontalContainer', 'TabContainer')
		AND data ? 'child_row_id'
		AND (data ->> 'child_row_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

	UPDATE "Row"
	SET
		data = (data - 'child_row_id') || jsonb_build_object('sheet_row_id', data -> 'child_row_id'),
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE type IN ('Button', 'TextAction', 'TimeslotPicker')
		AND data ? 'child_row_id'
		AND NOT (data ? 'sheet_row_id');

	UPDATE "Row"
	SET
		data = jsonb_set(
			data,
			'{actions}',
			(
				SELECT COALESCE(
					jsonb_agg(
						CASE
							WHEN (elem ->> 'true' = '{show()}' OR elem ->> 'false' = '{show()}') THEN
								elem
								|| CASE
									WHEN elem ->> 'true' = '{show()}' THEN
										jsonb_build_object(
											'true',
											format('{show(%s)}', data ->> 'sheet_row_id')
										)
									ELSE '{}'::jsonb
								END
								|| CASE
									WHEN elem ->> 'false' = '{show()}' THEN
										jsonb_build_object(
											'false',
											format('{show(%s)}', data ->> 'sheet_row_id')
										)
									ELSE '{}'::jsonb
								END
							ELSE elem
						END
					),
					'[]'::jsonb
				)
				FROM jsonb_array_elements(COALESCE(data -> 'actions', '[]'::jsonb)) AS elem
			)
		),
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE type IN ('Button', 'TextAction', 'TimeslotPicker')
		AND data ? 'sheet_row_id'
		AND EXISTS (
			SELECT 1
			FROM jsonb_array_elements(COALESCE(data -> 'actions', '[]'::jsonb)) AS elem
			WHERE elem ->> 'true' = '{show()}'
				OR elem ->> 'false' = '{show()}'
		);

	UPDATE "Row"
	SET
		data = data - 'source' - 'child_row_id',
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE type IN ('VerticalContainer', 'HorizontalContainer', 'TabContainer')
		AND (data ? 'source' OR data ? 'child_row_id');

	DELETE FROM "Row" AS orphan
	WHERE orphan.id IN (SELECT id FROM _container_template_ids)
		AND NOT EXISTS (
			SELECT 1
			FROM "Row" AS owner
			WHERE owner.id <> orphan.id
				AND (
					owner.data ->> 'sheet_row_id' = orphan.id::text
					OR owner.data ->> 'child_row_id' = orphan.id::text
					OR (
						jsonb_typeof(owner.data -> 'children_row_ids') = 'array'
						AND EXISTS (
							SELECT 1
							FROM jsonb_array_elements_text(owner.data -> 'children_row_ids') AS child_id
							WHERE child_id = orphan.id::text
						)
					)
				)
		)
		AND NOT EXISTS (
			SELECT 1
			FROM "Page" AS page
			WHERE page.footer_row_id = orphan.id
				OR (
					jsonb_typeof(page.row_ids) = 'array'
					AND EXISTS (
						SELECT 1
						FROM jsonb_array_elements_text(page.row_ids) AS root_id
						WHERE root_id = orphan.id::text
					)
				)
		);

	SELECT count(*) INTO unsupported_show_count
	FROM "Row",
		LATERAL jsonb_array_elements(COALESCE(data -> 'actions', '[]'::jsonb)) AS elem
	WHERE elem ->> 'true' = '{show()}'
		OR elem ->> 'false' = '{show()}';

	IF unsupported_show_count > 0 THEN
		RAISE EXCEPTION
			'0008_generic_row_sheets: % unsupported {show()} branch(es) remain after migration',
			unsupported_show_count;
	END IF;
END $$;
