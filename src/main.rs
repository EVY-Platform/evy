use actix_web::{get, App, HttpResponse, HttpServer, Result};
use configuration::read_env_vars;
use configuration::Configuration;
use surrealdb::engine::remote::ws::Client;
use surrealdb::engine::remote::ws::Ws;
use surrealdb::opt::auth::Root;
use surrealdb::Surreal;

mod configuration;
mod error;
mod service;

static DB: Surreal<Client> = Surreal::init();

/**
 * Endpoints
 **/
#[get("/health")]
pub async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().body("success".to_string()))
}

/**
 * Main
 **/
#[actix_web::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let conf: Configuration = read_env_vars();

    DB.connect::<Ws>(format!(
        "{}:{}",
        conf.frodo_surrealdb_host, conf.frodo_surrealdb_port
    ))
    .await?;

    DB.signin(Root {
        username: &conf.frodo_surrealdb_username,
        password: &conf.frodo_surrealdb_password,
    })
    .await?;

    DB.use_ns(&conf.frodo_surrealdb_namespace)
        .use_db(&conf.frodo_surrealdb_database)
        .await?;

    HttpServer::new(|| {
        App::new()
            .service(health)
            .service(service::create)
            .service(service::read)
            .service(service::update)
            .service(service::delete)
            .service(service::list)
    })
    .bind((conf.frodo_api_host, conf.frodo_api_port))?
    .run()
    .await?;

    Ok(())
}
