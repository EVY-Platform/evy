use std::sync::Arc;
use surrealdb::dbs::Session;
use surrealdb::engine::remote::ws::{Client, Ws};
use surrealdb::opt::auth::Root;
use surrealdb::Error;
use surrealdb::Surreal;

#[derive(Clone)]
pub struct DB {
    pub client: Arc<Surreal<Client>>,
    pub session: Session,
}

impl DB {
    pub async fn init(
        host: String,
        port: u16,
        username: String,
        password: String,
        database: String,
        namespace: String,
    ) -> Result<Self, Error> {
        println!("Connecting to SurrealDB at {:?}:{:?}", host, port);

        let client = Arc::new(Surreal::new::<Ws>(format!("{}:{}", host, port)).await?);

        client
            .signin(Root {
                username: &username,
                password: &password,
            })
            .await?;

        let session = Session::for_kv().with_ns(&namespace).with_db(&database);

        Ok(DB { session, client })
    }
}
