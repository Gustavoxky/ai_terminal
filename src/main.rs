use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use regex::Regex;
use std::collections::VecDeque;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tokio::sync::broadcast;
use warp::{ws::Message, ws::WebSocket, Filter};
use futures_util::{StreamExt, SinkExt};
use serde::Deserialize;
use reqwest::Client;
use std::process::Command;

#[derive(Deserialize)]
struct AiRequest {
    prompt: String,
}

#[tokio::main]
async fn main() {
    let shared_buffer = Arc::new(Mutex::new(VecDeque::new()));
    let input_tx = Arc::new(Mutex::new(None));
    let current_dir = Arc::new(Mutex::new(String::from("~")));
    let history = Arc::new(Mutex::new(VecDeque::new()));
    let (ws_tx, _) = broadcast::channel::<String>(100);

    let buffer_clone = shared_buffer.clone();
    let tx_clone = input_tx.clone();
    let ws_tx_clone = ws_tx.clone();
    let ws_tx_filter = warp::any().map(move || ws_tx.clone());
    let current_dir_clone = current_dir.clone();
    let history_clone = history.clone();

    thread::spawn(move || {
        let pty_system = native_pty_system();
        let pair = match pty_system.openpty(PtySize {
            rows: 40,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        }) {
            Ok(p) => p,
            Err(err) => {
                buffer_clone.lock().unwrap().push_back(format!("Erro ao criar PTY: {}\n", err));
                return;
            }
        };

        let _child = match pair.slave.spawn_command(CommandBuilder::new("/bin/bash")) {
            Ok(c) => c,
            Err(err) => {
                buffer_clone.lock().unwrap().push_back(format!("Erro ao iniciar bash: {}\n", err));
                return;
            }
        };

        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut writer = pair.master.take_writer().unwrap();

        let (tx, rx) = std::sync::mpsc::channel::<String>();
        let buf_clone = buffer_clone.clone();
        let tx_inner_clone = tx.clone();

        thread::spawn({
            let tx_clone = tx_clone.clone();
            let ws_tx_clone = ws_tx_clone.clone();
            let current_dir = current_dir_clone.clone();
            move || {
                let mut buffer = [0u8; 1024];
                let mut shell_ready = false;

                while let Ok(n) = reader.read(&mut buffer) {
                    if n > 0 {
                        let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                        buf_clone.lock().unwrap().push_back(output.clone());
                        let _ = ws_tx_clone.send(output.clone());

                        if let Some(cap) = Regex::new(r"root@[^:]+:([^#\n]+)#")
                            .unwrap()
                            .captures(&output)
                        {
                            let dir = cap.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or("~".to_string());
                            *current_dir.lock().unwrap() = dir;
                        }

                        if !shell_ready && output.contains("#") {
                            shell_ready = true;
                            *tx_clone.lock().unwrap() = Some(tx_inner_clone.clone());
                        }
                    }
                    thread::sleep(Duration::from_millis(20));
                }
            }
        });

        for line in rx {
            history_clone.lock().unwrap().push_back(line.clone());
            if history_clone.lock().unwrap().len() > 5 {
                history_clone.lock().unwrap().pop_front();
            }
            let _ = write!(writer, "{}\n", line);
            let _ = writer.flush();
        }
    });

    let output_route = warp::path("output")
        .and(warp::get())
        .and(with_state(shared_buffer.clone()))
        .map(|buffer: Arc<Mutex<VecDeque<String>>>| {
            let mut buf = buffer.lock().unwrap();
            let joined = buf.drain(..).collect::<Vec<_>>().join("");
            warp::reply::html(joined)
        });

    let input_route = warp::path("input")
        .and(warp::post())
        .and(warp::body::form())
        .and(with_input_tx(input_tx.clone()))
        .map(|form: std::collections::HashMap<String, String>, tx: Arc<Mutex<Option<std::sync::mpsc::Sender<String>>>>| {
            if let Some(cmd) = form.get("cmd") {
                if let Some(sender) = &*tx.lock().unwrap() {
                    let _ = sender.send(cmd.clone());
                }
            }
            warp::reply::html("OK")
        });

    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(ws_tx_filter)
        .map(|ws: warp::ws::Ws, tx| {
            ws.on_upgrade(move |socket| handle_ws(socket, tx))
        });

    let ai_route = warp::path("ai")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_input_tx(input_tx.clone()))
        .and(with_dir_and_history(current_dir.clone(), history.clone()))
        .and_then(handle_ai_request);
    
    let status_route = warp::path("status")
        .and(warp::get())
        .and(with_dir_and_history(current_dir.clone(), history.clone()))
        .map(|dir: Arc<Mutex<String>>, _hist: Arc<Mutex<VecDeque<String>>>| {
            let dir_str = dir.lock().unwrap().clone();
            warp::reply::json(&serde_json::json!({ "cwd": dir_str }))
        });

    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "OPTIONS"])
        .allow_headers(vec!["Content-Type", "Accept"]);

    let routes = output_route.or(input_route).or(ws_route).or(ai_route).or(status_route).with(cors);

    println!("Servidor backend iniciado em http://localhost:3030");
    warp::serve(routes).run(([0, 0, 0, 0], 3030)).await;
}

fn with_state(
    state: Arc<Mutex<VecDeque<String>>>,
) -> impl Filter<Extract = (Arc<Mutex<VecDeque<String>>> ,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || state.clone())
}

fn with_input_tx(
    tx: Arc<Mutex<Option<std::sync::mpsc::Sender<String>>>>,
) -> impl Filter<Extract = (Arc<Mutex<Option<std::sync::mpsc::Sender<String>>>>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || tx.clone())
}

fn with_dir_and_history(
    dir: Arc<Mutex<String>>,
    hist: Arc<Mutex<VecDeque<String>>>,
) -> impl Filter<Extract = (Arc<Mutex<String>>, Arc<Mutex<VecDeque<String>>>), Error = std::convert::Infallible> + Clone {
    warp::any()
        .map(move || dir.clone())
        .and(warp::any().map(move || hist.clone()))
}

async fn handle_ws(ws: WebSocket, tx: broadcast::Sender<String>) {
    let (mut user_ws_tx, _) = ws.split();
    let mut rx = tx.subscribe();

    tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let _ = user_ws_tx.send(Message::text(msg)).await;
        }
    });
}

async fn handle_ai_request(
    body: AiRequest,
    tx: Arc<Mutex<Option<std::sync::mpsc::Sender<String>>>>,
    current_dir: Arc<Mutex<String>>,
    history: Arc<Mutex<VecDeque<String>>>,
) -> Result<impl warp::Reply, warp::Rejection> {
    let client = Client::new();

    let raw_dir = current_dir.lock().unwrap().clone();
    let dir = if raw_dir == "~" {
        std::env::var("HOME").unwrap_or_else(|_| "/root".to_string())
    } else {
        raw_dir
    };
    let files = String::from_utf8_lossy(
        &Command::new("ls")
            .arg("-lhA")
            .current_dir(&dir)
            .output()
            .unwrap()
            .stdout,
    )
    .trim()
    .to_string();

    let hist_str = history
        .lock()
        .unwrap()
        .iter()
        .rev()
        .take(3)
        .enumerate()
        .map(|(i, h)| format!("{}. {}", i + 1, h))
        .collect::<Vec<_>>()
        .join("\n");

    let system_prompt = format!(
        "Você é um assistente de terminal Linux. Diretório atual: {}.\nArquivos:\n{}\nComandos recentes:\n{}\nResponda apenas com UM comando bash dentro de bloco markdown.",
        dir, files, hist_str
    );

    let json = serde_json::json!({
        "model": "deepseek-coder:6.7b-instruct",
        "stream": false,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": body.prompt}
        ]
    });

    match client
        .post("http://ollama:11434/api/chat")
        .json(&json)
        .send()
        .await
    {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(json) => {
                let full = json["message"]["content"].as_str().unwrap_or("Erro ao interpretar resposta");

                let re = Regex::new(r"```(?:bash)?\\n([\\s\\S]*?)```\\s*").unwrap();
                let extracted = re.captures(full)
                    .and_then(|caps| caps.get(1))
                    .map(|m| m.as_str().trim().lines().next().unwrap_or(""))
                    .unwrap_or("");

                if !extracted.is_empty() {
                    if let Some(sender) = &*tx.lock().unwrap() {
                        let _ = sender.send(extracted.to_string());
                    }
                }

                Ok(warp::reply::json(&serde_json::json!({ "response": full })))
            }
            Err(_) => Ok(warp::reply::json(&serde_json::json!({"response": "Erro ao interpretar JSON"}))),
        },
        Err(_) => Ok(warp::reply::json(&serde_json::json!({"response": "Erro ao contactar DeepSeek"}))),
    }
}
