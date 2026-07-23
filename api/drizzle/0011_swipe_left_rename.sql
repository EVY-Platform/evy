DO $$
BEGIN
	UPDATE "Row"
	SET
		data = jsonb_set(
			(data #- '{actions,slide-left}'),
			'{actions,swipe-left}',
			CASE
				WHEN data -> 'actions' ? 'swipe-left' THEN data -> 'actions' -> 'swipe-left'
				ELSE data -> 'actions' -> 'slide-left'
			END,
			true
		),
		updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	WHERE data -> 'actions' ? 'slide-left';
END $$;
