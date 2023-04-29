use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Service {
    created_at: String,
    description: String,
    id: String,
    list_name: Option<String>,
    name: String,
    updated_at: String,
}
