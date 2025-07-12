use tokio::sync::broadcast::Sender;
use warp::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};

pub async fn handle_ws(ws: WebSocket, tx: Sender<String>) {
    let (mut user_ws_tx, _) = ws.split();
    let mut rx = tx.subscribe();

    tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let _ = user_ws_tx.send(Message::text(msg)).await;
        }
    });
}
