use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UiVariable {
    created_at: String,
    default_value: Option<String>,
    description: String,
    endpoint_id: String,
    id: String,
    name: String,
    position: Position,
    #[serde(rename = "type")]
    ui_variable_type: Type,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Position {
    #[serde(rename = "path")]
    Path,
    #[serde(rename = "query")]
    Query,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Type {
    #[serde(rename = "number")]
    Number,
    #[serde(rename = "text")]
    Text,
}
