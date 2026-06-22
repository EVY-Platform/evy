import ButtonRow from "./action/ButtonRow";
import ColumnContainerRow from "./container/ColumnContainerRow";
import ListContainerRow from "./container/ListContainerRow";
import SelectSegmentContainerRow from "./container/SelectSegmentContainerRow";
import CalendarRow from "./edit/CalendarRow";
import PhotoGalleryRow from "./edit/PhotoGalleryRow";
import DropdownRow from "./edit/DropdownRow";
import InlinePickerRow from "./edit/InlinePickerRow";
import InputRow from "./edit/InputRow";
import SearchRow from "./edit/SearchRow";
import SelectPhotoRow from "./edit/SelectPhotoRow";
import TextAreaRow from "./edit/TextAreaRow";
import TextSelectRow from "./edit/TextSelectRow";
import TimeslotPickerRow from "./edit/TimeslotPickerRow";
import InputListRow from "./view/InputListRow";
import ListItemRow from "./view/ListItemRow";
import MapRow from "./view/MapRow";
import TextActionRow from "./view/TextActionRow";
import TextExpandRow from "./view/TextExpandRow";
import TextRow from "./view/TextRow";

export const baseRows = [
	TextRow,
	TextActionRow,
	TextExpandRow,
	ButtonRow,
	DropdownRow,
	InputRow,
	TextAreaRow,
	TextSelectRow,
	SearchRow,
	InputListRow,
	ListItemRow,
	PhotoGalleryRow,
	SelectPhotoRow,
	CalendarRow,
	ColumnContainerRow,
	InlinePickerRow,
	ListContainerRow,
	MapRow,
	SelectSegmentContainerRow,
	TimeslotPickerRow,
];
