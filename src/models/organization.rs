use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Organization {
    created_at: String,
    description: String,
    id: String,
    logo: String,
    name: String,
    support_email: String,
    updated_at: String,
    url: String,
}
