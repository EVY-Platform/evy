use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TransactionUpdate {
    created_at: String,
    error_message: Option<String>,
    id: String,
    status: String,
    transaction_id: String,
}
