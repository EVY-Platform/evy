/* eslint-disable */
/** Generated from schema/sdui/evy.schema.json - do not edit. */

/**
 * SDUI types: SDUI_Flow, SDUI_Page, SDUI_Row
 */
export interface SDUI_Flow {
  id: string;
  name: string;
  type: "read" | "write" | "create" | "update" | "delete";
  data: string;
  pages: SDUI_Page[];
}
export interface SDUI_Page {
  id: string;
  title: string;
  rows: SDUI_Row[];
  footer?: SDUI_Row;
}
export interface SDUI_Row {
  id: string;
  type:
    | "Button"
    | "Calendar"
    | "ColumnContainer"
    | "Dropdown"
    | "Info"
    | "InlinePicker"
    | "InputList"
    | "Input"
    | "ListContainer"
    | "Search"
    | "SelectPhoto"
    | "SelectSegmentContainer"
    | "SheetContainer"
    | "TextAction"
    | "TextArea"
    | "Text"
    | "TextSelect";
  view: {
    content: SDUI_RowContent;
    data?: string;
    max_lines?: string;
  };
  edit?: SDUI_RowEdit;
  action?: SDUI_RowAction;
}
export interface SDUI_RowContent {
  title: string;
  children?: SDUI_Row[];
  child?: SDUI_Row;
  segments?: string[];
  [k: string]: unknown;
}
export interface SDUI_RowEdit {
  destination?: string;
  validation?: SDUI_RowValidation;
}
export interface SDUI_RowValidation {
  required?: string;
  message?: string;
  minAmount?: string;
  minValue?: string;
  minCharacters?: string;
}
export interface SDUI_RowAction {
  target: string;
}
