/* eslint-disable */
/** Generated from schema/data/data.schema.json - do not edit. */

/**
 * API persistence row types: DATA_Flow, DATA_Device, DATA_Service, etc.
 */
export type DATA_Rows = DATA_Flow | DATA_Data | DATA_Device | DATA_Service | DATA_Organization | DATA_ServiceProvider;
export type OS = "ios" | "android" | "Web";

export interface DATA_Flow {
  id: string;
  data: SDUI_Flow;
  createdAt: string;
  updatedAt: string;
}
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
export interface DATA_Data {
  id: string;
  data: NamespacedData;
  createdAt: string;
  updatedAt: string;
}
export interface NamespacedData {
  evy?: {
    [k: string]:
      | (string | number | boolean | null)
      | (string | number | boolean | null)[]
      | {
          [k: string]: string | number | boolean | null;
        };
  };
  marketplace?: {
    [k: string]:
      | (string | number | boolean | null)
      | (string | number | boolean | null)[]
      | {
          [k: string]: string | number | boolean | null;
        };
  };
}
export interface DATA_Device {
  token: string;
  os: OS;
  createdAt: string;
}
export interface DATA_Service {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
export interface DATA_Organization {
  id: string;
  name: string;
  description: string;
  logo: string;
  url: string;
  supportEmail: string;
  createdAt: string;
  updatedAt: string;
}
export interface DATA_ServiceProvider {
  id: string;
  fkServiceId: string;
  fkOrganizationId: string;
  name: string;
  description: string;
  logo: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  retired: boolean;
}
