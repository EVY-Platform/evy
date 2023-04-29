use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Endpoint {
    api_id: String,
    created_at: String,
    endpoint: String,
    headers: Option<String>,
    id: String,
    name: String,
    updated_at: String,
}
