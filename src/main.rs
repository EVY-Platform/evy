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

    DB.connect::<Ws>(format!("{}:{}", conf.surrealdb_host, conf.surrealdb_port))
        .await?;

    DB.signin(Root {
        username: &conf.surrealdb_username,
        password: &conf.surrealdb_password,
    })
    .await?;

    DB.use_ns(&conf.surrealdb_namespace)
        .use_db(&conf.surrealdb_database)
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
    .bind((conf.api_host, conf.api_port))?
    .run()
    .await?;

    Ok(())
}
