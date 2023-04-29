use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct UiElement {
    #[serde(rename = " ui_element_id")]
    ui_element_id: String,
    actions: Vec<Action>,
    archived: bool,
    conditions: Vec<Condition>,
    created_at: String,
    data: Vec<Data>,
    description: Option<String>,
    id: String,
    name: Name,
    properties: Vec<Property>,
    slot_identifier: Option<String>,
    slots: Option<Vec<Slot>>,
    ui_elements: Option<Vec<HashMap<String, Option<serde_json::Value>>>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Action {
    endpoint_id: Option<String>,
    go_back_to_ui_element_id: Option<String>,
    go_forward_to_ui_element_id: Option<String>,
    replace_with_ui_element_id: Option<String>,
    #[serde(rename = "type")]
    action_type: Type,
    ui_variable_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Condition {
    order_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Data {
    endpoint_id: Option<String>,
    format: Option<Format>,
    ui_variable_id: Option<String>,
    value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Format {
    bold: Option<bool>,
    capitalization: Option<Capitaliz>,
    date_format: Option<String>,
    italic: Option<bool>,
    underlined: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Property {
    auto_complete: Option<bool>,
    bold: Option<bool>,
    button_type: Option<ButtonType>,
    capitalized: Option<Capitaliz>,
    #[serde(rename = "default")]
    property_default: Option<Default>,
    editable: Option<bool>,
    italic: Option<bool>,
    map_type: Option<MapType>,
    movable: Option<bool>,
    multi_select: Option<bool>,
    real_time: Option<bool>,
    removable: Option<bool>,
    required: Option<bool>,
    scrollable: Option<bool>,
    selectable: Option<bool>,
    slot_identifier: String,
    underlined: Option<bool>,
    zoomable: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Slot {
    identifier: String,
    position_from_bottom: i64,
    position_from_left: i64,
    position_from_right: i64,
    position_from_top: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Type {
    #[serde(rename = "on_hold")]
    OnHold,
    #[serde(rename = "on_select")]
    OnSelect,
    #[serde(rename = "on_swipe_left")]
    OnSwipeLeft,
    #[serde(rename = "on_swipe_right")]
    OnSwipeRight,
    #[serde(rename = "on_tap")]
    OnTap,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Capitaliz {
    #[serde(rename = "all")]
    All,
    #[serde(rename = "all_first")]
    AllFirst,
    #[serde(rename = "first")]
    First,
    #[serde(rename = "none")]
    None,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Name {
    #[serde(rename = "button")]
    Button,
    #[serde(rename = "container")]
    Container,
    #[serde(rename = "dropdown")]
    Dropdown,
    #[serde(rename = "image")]
    Image,
    #[serde(rename = "input")]
    Input,
    #[serde(rename = "label")]
    Label,
    #[serde(rename = "list")]
    List,
    #[serde(rename = "map")]
    Map,
    #[serde(rename = "row")]
    Row,
    #[serde(rename = "status")]
    Status,
    #[serde(rename = "text")]
    Text,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ButtonType {
    #[serde(rename = "primary")]
    Primary,
    #[serde(rename = "secondary")]
    Secondary,
    #[serde(rename = "warning")]
    Warning,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum MapType {
    #[serde(rename = "multi_location")]
    MultiLocation,
    #[serde(rename = "multi_location_traced")]
    MultiLocationTraced,
    #[serde(rename = "single_location")]
    SingleLocation,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Default {
    #[serde(rename = "data")]
    Data,
    #[serde(rename = "none")]
    None,
    #[serde(rename = "placeholder")]
    Placeholder,
}
