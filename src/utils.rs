use std::{
    collections::VecDeque,
    convert::Infallible,
    sync::{mpsc, Arc, Mutex},
};
use warp::Filter;

pub fn with_state(
    state: Arc<Mutex<VecDeque<String>>>,
) -> impl Filter<Extract = (Arc<Mutex<VecDeque<String>>>,), Error = Infallible> + Clone {
    warp::any().map(move || state.clone())
}

pub fn with_input_tx(
    tx: Arc<Mutex<Option<mpsc::Sender<String>>>>,
) -> impl Filter<Extract = (Arc<Mutex<Option<mpsc::Sender<String>>>>,), Error = Infallible> + Clone {
    warp::any().map(move || tx.clone())
}

pub fn with_dir_and_history(
    dir: Arc<Mutex<String>>,
    hist: Arc<Mutex<VecDeque<String>>>,
) -> impl Filter<Extract = (Arc<Mutex<String>>, Arc<Mutex<VecDeque<String>>>), Error = Infallible> + Clone {
    warp::any().map(move || dir.clone()).and(warp::any().map(move || hist.clone()))
}
