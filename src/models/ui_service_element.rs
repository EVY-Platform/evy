use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UiServiceElement {
    created_at: String,
    description: String,
    id: String,
    name: String,
    service_id: String,
    ui_element_id: Option<String>,
    element_id: Option<serde_json::Value>,
}
