mod configuration;
mod database;
mod error;
mod models;
mod websocket;

use actix::{Actor, Addr};
use actix_web::{
    get, web, web::Data, web::Query, App, Error, HttpRequest, HttpResponse, HttpServer, Result,
};
use actix_web_actors::ws;
use configuration::read_env_vars;
use configuration::Configuration;
use database::db::DB;
use serde::Deserialize;
use websocket::ws::WsConn;
use websocket::wsserver::WSServer;

/**
 * Structs
 */
#[derive(Debug, Deserialize)]
pub struct WSParams {
    token: String,
}

/**
 * Endpoints
 **/
#[get("/health")]
pub async fn health() -> Result<HttpResponse> {
    println!("/health");
    Ok(HttpResponse::Ok().body("OK".to_string()))
}

#[get("/ws")]
pub async fn wsroute(
    req: HttpRequest,
    stream: web::Payload,
    ws_server: web::Data<Addr<WSServer>>,
) -> Result<HttpResponse, Error> {
    println!("/ws");

    let params = Query::<WSParams>::from_query(req.query_string()).unwrap();
    let ws = WsConn::new(params.token.clone(), ws_server.get_ref().clone());

    Ok(ws::start(ws, &req, stream)?)
}

/**
 * Main
 **/
#[actix_web::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let conf: Configuration = read_env_vars();

    let db_data = DB::init(
        conf.surrealdb_host,
        conf.surrealdb_port,
        conf.surrealdb_username,
        conf.surrealdb_password,
        conf.surrealdb_database,
        conf.surrealdb_namespace,
    )
    .await
    .expect("Error connecting to SurrealDB!");

    println!(
        "\nStarting HTTP server at {:?}:{:?}\n",
        conf.api_host, conf.api_port
    );

    let ws_server = WSServer::default().start();

    HttpServer::new(move || {
        App::new()
            .app_data(Data::new(db_data.clone()))
            .app_data(Data::new(ws_server.clone()))
            .service(health)
            .service(wsroute)
    })
    .bind((conf.api_host, conf.api_port))?
    .run()
    .await?;

    Ok(())
}
