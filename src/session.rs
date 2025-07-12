use std::{
    collections::VecDeque,
    sync::{Arc, Mutex, mpsc},
};
use tokio::sync::broadcast;

pub struct Session {
    pub buffer: Arc<Mutex<VecDeque<String>>>,
    pub input_tx: Arc<Mutex<Option<mpsc::Sender<String>>>>,
    pub current_dir: Arc<Mutex<String>>,
    pub history: Arc<Mutex<VecDeque<String>>>,
    pub ws_tx: broadcast::Sender<String>,
}
