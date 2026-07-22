DO $$
BEGIN
	UPDATE "Row"
	SET
		data = CASE
			WHEN jsonb_array_length(data -> 'actions') = 0 THEN data - 'actions'
			ELSE jsonb_set(
				data - 'actions',
				'{actions}',
				jsonb_build_object('tap', data -> 'actions')
			)
		END,
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE data ? 'actions'
		AND jsonb_typeof(data -> 'actions') = 'array';

	UPDATE "Row"
	SET
		data = jsonb_set(
			COALESCE(data, '{}'::jsonb),
			'{actions}',
			COALESCE(data -> 'actions', '{}'::jsonb)
				|| jsonb_build_object(
					'delete',
					'[{"condition": "", "false": "", "true": "{delete_photo()}"}]'::jsonb
				),
			true
		),
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE type = 'SelectPhoto'
		AND NOT (
			data ? 'actions'
			AND data -> 'actions' ? 'delete'
			AND jsonb_typeof(data -> 'actions' -> 'delete') = 'array'
			AND jsonb_array_length(data -> 'actions' -> 'delete') > 0
		);

	UPDATE "Row"
	SET
		data = jsonb_set(
			COALESCE(data, '{}'::jsonb),
			'{actions}',
			COALESCE(data -> 'actions', '{}'::jsonb)
				|| jsonb_build_object(
					'tap',
					jsonb_build_array(
						jsonb_build_object(
							'condition',
							'',
							'false',
							'',
							'true',
							'{show(' || id::text || ')}'
						)
					)
				),
			true
		),
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE type IN (
			'Button',
			'Calendar',
			'Dropdown',
			'InlinePicker',
			'InputList',
			'PhotoGallery',
			'SelectPhoto',
			'TextAction',
			'TextExpand',
			'TextSelect',
			'TimeslotPicker'
		)
		AND (
			NOT (data ? 'actions')
			OR NOT (data -> 'actions' ? 'tap')
			OR jsonb_typeof(data -> 'actions' -> 'tap') != 'array'
			OR jsonb_array_length(data -> 'actions' -> 'tap') = 0
		);
END $$;
