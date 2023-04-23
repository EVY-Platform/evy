use actix::{Actor, StreamHandler};
use actix_web::{get, web, App, Error, HttpRequest, HttpResponse, HttpServer, Result};
use actix_web_actors::ws;
use configuration::read_env_vars;
use configuration::Configuration;
use serde::Deserialize;
use surrealdb::engine::remote::ws::Client;
use surrealdb::engine::remote::ws::Ws;
use surrealdb::opt::auth::Root;
use surrealdb::Surreal;

mod configuration;
mod error;
mod service;

#[derive(Debug, Deserialize)]
pub struct WSParams {
    token: String,
}

/// Define HTTP actor
struct MyWs;

impl Actor for MyWs {
    type Context = ws::WebsocketContext<Self>;
}

static DB: Surreal<Client> = Surreal::init();

/**
 * Endpoints
 **/
#[get("/health")]
pub async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().body("success".to_string()))
}

/// Handler for ws::Message message
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MyWs {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Text(text)) => {
                println!("received {:?}", text);
                ctx.text(text)
            }
            _ => (),
        }
    }
}

async fn index(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    let params =
        web::Query::<WSParams>::from_query(req.query_string()).unwrap_or(web::Query(WSParams {
            token: String::from("token"),
        }));
    let token = &params.token;
    println!("req token: {:?}", token);
    // Here we need to validate the token with the DB. If it is not recognized, fail

    ws::start(MyWs {}, &req, stream)
}

/**
 * Main
 **/
#[actix_web::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let conf: Configuration = read_env_vars();

    println!(
        "Connecting to SurrealDB at {:?}:{:?}",
        conf.surrealdb_host, conf.surrealdb_port
    );

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

    println!(
        "Starting HTTP server at {:?}:{:?}",
        conf.api_host, conf.api_port
    );

    HttpServer::new(|| {
        App::new()
            .service(web::resource("/ws").to(index))
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
