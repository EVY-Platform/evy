DO $$
BEGIN
	UPDATE "Row"
	SET
		data = jsonb_set(
			COALESCE(data, '{}'::jsonb),
			'{actions}',
			COALESCE(data -> 'actions', '{}'::jsonb)
				|| jsonb_build_object(
					'tap-row',
					'[{"condition": "", "false": "", "true": "{select($datum)}"}]'::jsonb
				),
			true
		),
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE type = 'Calendar'
		AND (
			NOT (data ? 'actions')
			OR NOT (data -> 'actions' ? 'tap-row')
			OR jsonb_typeof(data -> 'actions' -> 'tap-row') != 'array'
			OR jsonb_array_length(data -> 'actions' -> 'tap-row') = 0
		);

	UPDATE "Row"
	SET
		data = jsonb_set(
			COALESCE(data, '{}'::jsonb),
			'{actions}',
			COALESCE(data -> 'actions', '{}'::jsonb)
				|| jsonb_build_object(
					'tap-column',
					'[{"condition": "", "false": "", "true": "{select($datum)}"}]'::jsonb
				),
			true
		),
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE type = 'Calendar'
		AND (
			NOT (data ? 'actions')
			OR NOT (data -> 'actions' ? 'tap-column')
			OR jsonb_typeof(data -> 'actions' -> 'tap-column') != 'array'
			OR jsonb_array_length(data -> 'actions' -> 'tap-column') = 0
		);
END $$;
