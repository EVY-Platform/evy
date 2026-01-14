import ButtonRow from "./action/ButtonRow";
import TextActionRow from "./action/TextActionRow";
import ColumnContainerRow from "./container/ColumnContainerRow";
import ListContainerRow from "./container/ListContainerRow";
import SelectSegmentContainerRow from "./container/SelectSegmentContainerRow";
import SheetContainerRow from "./container/SheetContainerRow";
import CalendarRow from "./edit/CalendarRow";
import DropdownRow from "./edit/DropdownRow";
import InlinePickerRow from "./edit/InlinePickerRow";
import InputRow from "./edit/InputRow";
import SearchRow from "./edit/SearchRow";
import SelectPhotoRow from "./edit/SelectPhotoRow";
import TextAreaRow from "./edit/TextAreaRow";
import TextSelectRow from "./edit/TextSelectRow";
import InfoRow from "./view/InfoRow";
import InputListRow from "./view/InputListRow";
import TextRow from "./view/TextRow";

export const baseRows = [
	ButtonRow,
	CalendarRow,
	ColumnContainerRow,
	DropdownRow,
	InfoRow,
	InlinePickerRow,
	InputListRow,
	InputRow,
	ListContainerRow,
	SearchRow,
	SelectPhotoRow,
	SelectSegmentContainerRow,
	SheetContainerRow,
	TextActionRow,
	TextAreaRow,
	TextRow,
	TextSelectRow,
];
