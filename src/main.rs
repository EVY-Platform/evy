use actix_web::{App, get, HttpResponse, HttpServer, Result};
use surrealdb::engine::remote::ws::Client;
use surrealdb::engine::remote::ws::Ws;
use surrealdb::opt::auth::Root;
use surrealdb::Surreal;

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
	DB.connect::<Ws>("localhost:8000").await?;

	DB.signin(Root {
		username: "root",
		password: "root",
	})
	.await?;

	DB.use_ns("ns").use_db("sam").await?;

	HttpServer::new(|| {
		App::new()
            .service(health)
			.service(service::create)
			.service(service::read)
			.service(service::update)
			.service(service::delete)
			.service(service::list)
	})
	.bind(("0.0.0.0", 8080))?
	.run()
	.await?;

	Ok(())
}