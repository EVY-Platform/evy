use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Device {
    created_at: String,
    id: String,
    os: Os,
    token: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Os {
    #[serde(rename = "android")]
    Android,
    #[serde(rename = "ios")]
    Ios,
}
