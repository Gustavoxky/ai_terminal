use warp::{Filter, Rejection, Reply};
use std::collections::{HashMap, VecDeque};
use std::sync::{mpsc, Arc, Mutex};
use std::fs;

use crate::ai::{handle_ai_request};
use crate::utils::{with_dir_and_history, with_input_tx, with_state};
use crate::ws::handle_ws;

pub fn output_route(
    buffer: Arc<Mutex<VecDeque<String>>>,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::path("output")
        .and(warp::get())
        .and(with_state(buffer))
        .map(|buffer: Arc<Mutex<VecDeque<String>>>| {
            let mut buf = buffer.lock().unwrap();
            let joined = buf.drain(..).collect::<Vec<_>>().join("");
            warp::reply::html(joined)
        })
}

pub fn input_route(
    tx: Arc<Mutex<Option<mpsc::Sender<String>>>>,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::path("input")
        .and(warp::post())
        .and(warp::body::form())
        .and(with_input_tx(tx))
        .map(|form: HashMap<String, String>, tx: Arc<Mutex<Option<mpsc::Sender<String>>>>| {
            if let Some(cmd) = form.get("cmd") {
                if let Some(sender) = &*tx.lock().unwrap() {
                    let _ = sender.send(cmd.clone());
                }
            }
            warp::reply::html("OK")
        })
}

pub fn ws_route(
    tx: tokio::sync::broadcast::Sender<String>,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::path("ws")
        .and(warp::ws())
        .map(move |ws: warp::ws::Ws| {
            let tx = tx.clone();
            ws.on_upgrade(move |socket| handle_ws(socket, tx))
        })
}

pub fn ai_route(
    tx: Arc<Mutex<Option<mpsc::Sender<String>>>>,
    current_dir: Arc<Mutex<String>>,
    history: Arc<Mutex<VecDeque<String>>>,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::path("ai")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_input_tx(tx))
        .and(with_dir_and_history(current_dir, history))
        .and_then(handle_ai_request)
}

pub fn status_route(
    current_dir: Arc<Mutex<String>>,
    history: Arc<Mutex<VecDeque<String>>>,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::path("status")
        .and(warp::get())
        .and(with_dir_and_history(current_dir, history))
        .map(|dir: Arc<Mutex<String>>, _hist: Arc<Mutex<VecDeque<String>>>| {
            let dir_str = dir.lock().unwrap().clone();
            let resolved_dir = if dir_str == "~" {
                std::env::var("HOME").unwrap_or_else(|_| "/root".to_string())
            } else {
                dir_str.clone()
            };

            let files = match fs::read_dir(&resolved_dir) {
                Ok(entries) => entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.file_name().to_string_lossy().to_string())
                    .collect::<Vec<_>>(),
                Err(_) => vec!["<erro ao listar arquivos>".to_string()],
            };

            warp::reply::json(&serde_json::json!({
                "cwd": dir_str,
                "files": files
            }))
        })
}
