use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceProvider {
    created_at: String,
    description: String,
    id: String,
    logo: String,
    name: String,
    organization_id: String,
    service_id: String,
    updated_at: String,
    url: String,
}
