import { useParseText } from "../../hooks/useParseText";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import CarouselIndicator from "../design-system/CarouselIndicator";
import { RowLayout } from "../design-system/RowLayout";

type MockSlot = {
	datetime: string;
	variant: "dark" | "light" | "unavailable";
};

type MockDay = {
	representativeDatetime: string;
	slots: MockSlot[];
};

function isoDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const today = new Date();
const mockData: MockDay[] = Array.from({ length: 5 }, (_, index) => {
	const date = new Date(today);
	date.setDate(today.getDate() + index);
	const dateStr = isoDateString(date);
	return {
		representativeDatetime: `${dateStr}T11:30:00`,
		slots: [
			{ datetime: `${dateStr}T11:30:00`, variant: "dark" },
			{
				datetime: `${dateStr}T12:00:00`,
				variant: index === 0 ? "dark" : "light",
			},
			{
				datetime: `${dateStr}T12:30:00`,
				variant: index === 0 ? "unavailable" : "dark",
			},
		],
	};
});

const timeslotPageSize = 4;
const visibleDays = mockData.slice(0, timeslotPageSize);
const pageCount = Math.ceil(mockData.length / timeslotPageSize);

function SlotChip({
	slot,
	timeslotFormat,
}: {
	slot: MockSlot;
	timeslotFormat: string;
}) {
	const parseText = useParseText();

	if (slot.variant === "unavailable") {
		return (
			<div
				className="evy-text-center evy-text-gray"
				style={{ height: 36 }}
			>
				-
			</div>
		);
	}
	return (
		<button
			type="button"
			className="evy-border-none evy-rounded-md evy-cursor-pointer evy-font-medium evy-text-sm"
			style={{
				background:
					slot.variant === "dark"
						? "var(--color-evy-gray-dark)"
						: "var(--color-evy-gray-light)",
				color:
					slot.variant === "dark"
						? "var(--color-white)"
						: "var(--color-black)",
				width: 64,
				height: 36,
			}}
		>
			{parseText(timeslotFormat, { datum: slot.datetime })}
		</button>
	);
}

function DayColumn({
	day,
	headerFormat,
	headerSubtitle,
	timeslotFormat,
}: {
	day: MockDay;
	headerFormat: string;
	headerSubtitle: string;
	timeslotFormat: string;
}) {
	const parseText = useParseText();
	return (
		<div className="evy-flex evy-flex-col evy-items-center">
			<div className="evy-text-center evy-mb-1">
				<div className="evy-text-sm evy-text-gray evy-font-medium">
					{parseText(headerFormat, {
						datum: day.representativeDatetime,
					})}
				</div>
				<div className="evy-text-sm evy-text-gray">
					{parseText(headerSubtitle, {
						datum: day.representativeDatetime,
					})}
				</div>
			</div>
			<div className="evy-flex evy-flex-col evy-items-center evy-gap-1">
				{day.slots.map((slot) => (
					<SlotChip
						key={slot.datetime}
						slot={slot}
						timeslotFormat={timeslotFormat}
					/>
				))}
			</div>
		</div>
	);
}

export default defineRow("TimeslotPickerRow", {
	config: {
		type: "TimeslotPicker",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "Timeslot picker row title",
				start_time: "07:00",
				end_time: "19:00",
				timeslot_interval_minutes: 30,
				label_interval_minutes: 60,
				header_format: '{formatDatetime($datum, "EEE")}',
				header_subtitle: '{formatDatetime($datum, "MMM do")}',
				timeslot_format: '{formatDatetime($datum, "HH:mm")}',
			},
		},
		destination: "",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-flex evy-justify-center evy-gap-1 evy-mt-2">
				{visibleDays.map((day) => (
					<DayColumn
						key={day.representativeDatetime}
						day={day}
						headerFormat={row.config.view.content.header_format}
						headerSubtitle={row.config.view.content.header_subtitle}
						timeslotFormat={row.config.view.content.timeslot_format}
					/>
				))}
			</div>
			<CarouselIndicator pageCount={pageCount} activeIndex={0} />
		</RowLayout>
	),
});
