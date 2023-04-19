use actix_web::{get, App, Result, HttpResponse, HttpServer};

#[get("/health")]
pub async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().body("success".to_string()))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().service(health))
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}