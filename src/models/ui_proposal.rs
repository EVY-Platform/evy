use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UiProposal {
    cancelled_at: Option<String>,
    created_at: String,
    description: String,
    id: String,
    member_id: String,
    name: String,
    ui_elements: Vec<UiElementElement>,
    ui_service_elements: Vec<ServiceElementProposal>,
    ui_variables: Vec<UiVariableElement>,
    validator_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UiElementElement {
    new_ui_element_id: String,
    source_ui_element_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceElementProposal {
    new_ui_service_element_id: String,
    source_ui_service_element_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UiVariableElement {
    new_ui_variable_id: String,
    source_ui_variable_id: String,
}
