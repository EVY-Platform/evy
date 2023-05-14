use crate::websocket::message::{ClientActorMessage, Connect, Disconnect, WsMessage};
use actix::prelude::{Actor, Context, Handler, Recipient};
use actix_web::Result;
use serde::Deserialize;
use serde_json::{from_str, Value};
use std::collections::HashMap;

type Socket = Recipient<WsMessage>;

#[derive(Deserialize, Debug)]
enum WSQueryMethod {
    GET,
    POST,
    PUT,
    DEL,
}

#[derive(Deserialize)]
struct WSQuery {
    method: WSQueryMethod,
    data: Value,
}

pub struct WSServer {
    sessions: HashMap<String, Socket>,
}

impl Default for WSServer {
    fn default() -> WSServer {
        WSServer {
            sessions: HashMap::new(),
        }
    }
}

impl WSServer {
    fn send_message(&self, message: &str, recipient_token: &String) {
        if let Some(socket_recipient) = self.sessions.get(recipient_token) {
            socket_recipient.do_send(WsMessage(message.to_owned()));
        } else {
            println!("attempting to send message but couldn't find user id.");
        }
    }
}

impl Actor for WSServer {
    type Context = Context<Self>;
}

impl Handler<Connect> for WSServer {
    type Result = Result<(), String>;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        if self.sessions.get(&msg.token).is_some() {
            return Err("Token already in use".to_string());
        }

        msg.addr.do_send(WsMessage("Connected".to_owned()));
        self.sessions.insert(msg.token, msg.addr);

        return Ok(());
    }
}

impl Handler<Disconnect> for WSServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        self.sessions.remove(&msg.token);
    }
}

impl Handler<ClientActorMessage> for WSServer {
    type Result = ();

    fn handle(&mut self, msg: ClientActorMessage, _ctx: &mut Context<Self>) -> Self::Result {
        let query: WSQuery = from_str(&msg.msg).unwrap();

        match query.method {
            WSQueryMethod::GET => {
                println!("received GET request {:?}", query.data);
            }
            WSQueryMethod::POST => {
                println!("received POST request {:?}", query.data);
            }
            WSQueryMethod::PUT => {
                println!("received PUT request {:?}", query.data);
            }
            WSQueryMethod::DEL => {
                println!("received DEL request {:?}", query.data);
            }
        }

        for (token, _socket) in &self.sessions {
            self.send_message(&format!("Responding back with {}", &msg.msg), token);
        }
    }
}
