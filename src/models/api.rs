pub use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Api {
    pub base_url: String,
    pub created_at: String,
    pub headers: Option<String>,
    pub id: String,
    pub name: String,
    pub service_provider_id: String,
    pub updated_at: String,
}
