// main.rs
mod pty_handler;
mod routes;
mod ws;
mod ai;
mod utils;
use warp::Filter;

use crate::routes::{ai_route, input_route, output_route, status_route, ws_route};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
#[tokio::main]
async fn main() {
    let shared_buffer = Arc::new(Mutex::new(VecDeque::new()));
    let input_tx = Arc::new(Mutex::new(None));
    let current_dir = Arc::new(Mutex::new(String::from("~")));
    let history = Arc::new(Mutex::new(VecDeque::new()));
    let (ws_tx, _) = tokio::sync::broadcast::channel::<String>(100);

    // Spawn PTY thread
    pty_handler::spawn_pty(shared_buffer.clone(), input_tx.clone(), current_dir.clone(), history.clone(), ws_tx.clone());

    // Set up routes
    let routes = output_route(shared_buffer.clone())
        .or(input_route(input_tx.clone()))
        .or(ws_route(ws_tx.clone()))
        .or(ai_route(input_tx.clone(), current_dir.clone(), history.clone()))
        .or(status_route(current_dir.clone(), history.clone()))
        .with(warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type", "Accept"]));

    println!("Servidor backend iniciado em http://localhost:3030");
    warp::serve(routes).run(([0, 0, 0, 0], 3030)).await;
}
