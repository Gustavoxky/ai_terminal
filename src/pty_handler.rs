use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use regex::Regex;
use std::{
    collections::VecDeque,
    io::{Read, Write},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::Duration,
};
use tokio::sync::broadcast::Sender;

pub fn spawn_pty(
    buffer: Arc<Mutex<VecDeque<String>>>,
    input_tx: Arc<Mutex<Option<mpsc::Sender<String>>>>,
    current_dir: Arc<Mutex<String>>,
    history: Arc<Mutex<VecDeque<String>>>,
    ws_tx: Sender<String>,
) {
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
                buffer.lock().unwrap().push_back(format!("Erro ao criar PTY: {}\n", err));
                return;
            }
        };

        let _child = match pair.slave.spawn_command(CommandBuilder::new("/bin/bash")) {
            Ok(c) => c,
            Err(err) => {
                buffer.lock().unwrap().push_back(format!("Erro ao iniciar bash: {}\n", err));
                return;
            }
        };

        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut writer = pair.master.take_writer().unwrap();

        let (tx, rx) = mpsc::channel::<String>();
        let buf_clone = buffer.clone();
        let tx_inner_clone = tx.clone();

        {
            let tx_input_clone = input_tx.clone();
            let ws_tx_clone = ws_tx.clone();
            let current_dir = current_dir.clone();
            thread::spawn(move || {
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
                            *tx_input_clone.lock().unwrap() = Some(tx_inner_clone.clone());
                        }
                    }
                    thread::sleep(Duration::from_millis(20));
                }
            });
        }

        for line in rx {
            history.lock().unwrap().push_back(line.clone());
            if history.lock().unwrap().len() > 5 {
                history.lock().unwrap().pop_front();
            }
            let _ = write!(writer, "{}\n", line);
            let _ = writer.flush();
        }
    });
}
