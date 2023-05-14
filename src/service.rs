use crate::error::Error;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::{delete, get, post, put};
use serde::{Deserialize, Serialize};

const SERVICE: &str = "service";

#[derive(Serialize, Deserialize)]
pub struct Service {
    name: String,
    description: String,
}

#[post("/service/{id}")]
pub async fn create(id: Path<String>, service: Json<Service>) -> Result<Json<Service>, Error> {
    let service = DB.create((SERVICE, &*id)).content(service).await?;
    Ok(Json(service))
}

#[get("/service/{id}")]
pub async fn read(id: Path<String>) -> Result<Json<Option<Service>>, Error> {
    let service = DB.select((SERVICE, &*id)).await?;
    Ok(Json(service))
}

#[put("/service/{id}")]
pub async fn update(id: Path<String>, service: Json<Service>) -> Result<Json<Service>, Error> {
    let service = DB.update((SERVICE, &*id)).content(service).await?;
    Ok(Json(service))
}

#[delete("/service/{id}")]
pub async fn delete(id: Path<String>) -> Result<Json<Option<Service>>, Error> {
    let service = DB.delete((SERVICE, &*id)).await?;
    Ok(Json(service))
}

#[get("/services")]
pub async fn list() -> Result<Json<Vec<Service>>, Error> {
    let services = DB.select(SERVICE).await?;
    Ok(Json(services))
}
