use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub struct Configuration {
    #[serde(default = "default_host")]
    pub frodo_api_host: String,
    #[serde(default = "default_api_port")]
    pub frodo_api_port: u16,
    #[serde(default = "default_host")]
    pub frodo_surrealdb_host: String,
    #[serde(default = "default_surrealdb_port")]
    pub frodo_surrealdb_port: u16,
    #[serde(default = "default_surrealdb_credential")]
    pub frodo_surrealdb_username: String,
    #[serde(default = "default_surrealdb_credential")]
    pub frodo_surrealdb_password: String,
    #[serde(default = "default_surrealdb_namespace")]
    pub frodo_surrealdb_namespace: String,
    #[serde(default = "default_surrealdb_database")]
    pub frodo_surrealdb_database: String,
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}
fn default_api_port() -> u16 {
    8080
}
fn default_surrealdb_port() -> u16 {
    8000
}
fn default_surrealdb_credential() -> String {
    "root".to_string()
}
fn default_surrealdb_namespace() -> String {
    "ns".to_string()
}
fn default_surrealdb_database() -> String {
    "sam".to_string()
}

pub fn read_env_vars() -> Configuration {
    envy::prefixed("FRODO_").from_env::<Configuration>().expect(
        "Please provide environment variables for \
        FRODO_API_HOST, \
        FRODO_API_PORT, \
        FRODO_SURREALDB_HOST, \
        FRODO_SURREALDB_PORT, \
        FRODO_SURREALDB_USERNAME, \
        FRODO_SURREALDB_PASSWORD, \
        FRODO_SURREALDB_NAMESPACE and \
        FRODO_SURREALDB_DATABAE",
    )
}
