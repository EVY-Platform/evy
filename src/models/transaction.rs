use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Transaction {
    amount: f64,
    created_at: String,
    id: String,
    payee_user_id: String,
    payer_user_id: String,
    reference: String,
    #[serde(rename = "type")]
    transaction_type: String,
}
