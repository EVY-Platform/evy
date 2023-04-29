use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Member {
    created_at: String,
    id: String,
    organization_id: String,
    updated_at: String,
    user_id: String,
}
