use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub struct Configuration {
    pub api_host: String,
    pub api_port: u16,
    pub surrealdb_host: String,
    pub surrealdb_port: u16,
    pub surrealdb_username: String,
    pub surrealdb_password: String,
    pub surrealdb_namespace: String,
    pub surrealdb_database: String,
}

pub fn read_env_vars() -> Configuration {
    envy::prefixed("FRODO_").from_env::<Configuration>().expect(
        "Please provide environment variables for \
        API_HOST, \
        API_PORT, \
        SURREALDB_HOST, \
        SURREALDB_PORT, \
        SURREALDB_USERNAME, \
        SURREALDB_PASSWORD, \
        SURREALDB_NAMESPACE and \
        SURREALDB_DATABASE",
    )
}
