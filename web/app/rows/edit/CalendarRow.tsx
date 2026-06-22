import type { RowConfig } from "../../types/row";
import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import { useParseText } from "../../hooks/useParseText";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const COLUMN_WIDTH = 60;
const ROW_HEIGHT = 20;

function isoDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const today = new Date();

const mockColumnDates = Array.from({ length: 4 }, (_, i) => {
	const d = new Date(today);
	d.setDate(today.getDate() + i);
	return `${isoDateString(d)}T00:00:00`;
});

const mockTimeSlots = Array.from({ length: 8 }, (_, i) => {
	const minutes = 7 * 60 + i * 30;
	const h = String(Math.floor(minutes / 60)).padStart(2, "0");
	const m = String(minutes % 60).padStart(2, "0");
	return `2000-01-01T${h}:${m}:00`;
});

const axisLabelStyle: React.CSSProperties = {
	width: COLUMN_WIDTH,
	height: ROW_HEIGHT,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: 11,
	color: "var(--color-evy-gray-dark)",
	flexShrink: 0,
};

function CalendarCell({ col, row }: { col: number; row: number }) {
	const isPrimary = col === 0 && row < 2;
	const isSecondary = col === 1 && row === 1;
	const background = isPrimary
		? "var(--color-evy-blue)"
		: isSecondary
			? "var(--color-evy-gray-light)"
			: "transparent";
	return (
		<div
			style={{
				width: COLUMN_WIDTH,
				height: ROW_HEIGHT,
				background,
				borderLeft: "1px solid var(--color-evy-gray-light)",
				borderBottom: "1px solid var(--color-evy-gray-light)",
				flexShrink: 0,
			}}
		/>
	);
}

function CalendarGrid({
	headerFormat,
	timeslotFormat,
}: {
	headerFormat: string;
	timeslotFormat: string;
}) {
	const parseText = useParseText();
	return (
		<div className="evy-flex evy-flex-row evy-overflow-hidden evy-mt-2">
			{/* Y-axis: time labels */}
			<div className="evy-flex evy-flex-col">
				<div style={{ height: ROW_HEIGHT }} />
				{mockTimeSlots.map((datetime, i) => (
					<div key={datetime} style={axisLabelStyle}>
						{i % 2 === 0 ? parseText(timeslotFormat, { datum: datetime }) : ""}
					</div>
				))}
			</div>
			{/* X-axis date headers + grid */}
			<div className="evy-flex evy-flex-col">
				<div className="evy-flex evy-flex-row">
					{mockColumnDates.map((datetime) => (
						<div key={datetime} style={axisLabelStyle}>
							{parseText(headerFormat, { datum: datetime })}
						</div>
					))}
				</div>
				<div className="evy-flex evy-flex-row">
					{mockColumnDates.map((datetime, col) => (
						<div key={datetime} className="evy-flex evy-flex-col">
							{mockTimeSlots.map((_, row) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: stable fixed-size mock grid
								<CalendarCell key={row} col={col} row={row} />
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export default defineRow("CalendarRow", {
	config: {
		type: "Calendar",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "Calendar row title",
				start_time: "07:00",
				end_time: "19:00",
				timeslot_interval_minutes: 30,
				label_interval_minutes: 60,
				header_format: '{formatDatetime($datum, "EEE d")}',
				timeslot_format: '{formatDatetime($datum, "HH:mm")}',
				primary: "{pickup_selection}",
				secondary: "{delivery_selection}",
			},
		},
		destination: `{${MARKETPLACE_RESOURCE.ITEMS}.pickup_selection}`,
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<CalendarGrid
				headerFormat={row.config.view.content.header_format ?? ""}
				timeslotFormat={row.config.view.content.timeslot_format ?? ""}
			/>
		</RowLayout>
	),
});
