use reqwest::Client;
use regex::Regex;
use serde::Deserialize;
use std::{
    collections::VecDeque,
    process::Command,
    sync::{Arc, Mutex},
};
use std::path::Path;

#[derive(Deserialize)]
pub struct AiRequest {
    pub prompt: String,
    pub output: Option<String>,
}

pub async fn handle_ai_request(
    body: AiRequest,
    tx: Arc<Mutex<Option<std::sync::mpsc::Sender<String>>>>,
    current_dir: Arc<Mutex<String>>,
    history: Arc<Mutex<VecDeque<String>>>,
) -> Result<impl warp::Reply, warp::Rejection> {
    let client = Client::new();

    // Resolve diretório real
    let raw_dir = current_dir.lock().unwrap().clone();
    let dir = if raw_dir == "~" {
        std::env::var("HOME").unwrap_or_else(|_| "/root".to_string())
    } else {
        raw_dir
    };

    // Verifica se o diretório existe antes de tentar listar
    let files = if Path::new(&dir).exists() {
        match Command::new("ls")
            .arg("-lhA")
            .current_dir(&dir)
            .output()
        {
            Ok(out) => String::from_utf8_lossy(&out.stdout).trim().to_string(),
            Err(err) => {
                eprintln!("[AI] Erro ao executar ls em '{}': {}", dir, err);
                "<erro ao listar arquivos>".to_string()
            }
        }
    } else {
        eprintln!("[AI] Diretório inválido: '{}'", dir);
        "<diretório inexistente>".to_string()
    };

    // Histórico de comandos recentes
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

    // Prompt do sistema
    let system_prompt = format!(
        "Você é um assistente de terminal Linux. Diretório atual: {}.\nArquivos:\n{}\nComandos recentes:\n{}\nResponda apenas com UM comando bash dentro de bloco markdown, quando for solicitado um comando. Quando for solicitada uma explicação de saída, explique com clareza e objetividade.",
        dir, files, hist_str
    );

    // Prompt do usuário adaptado
    let user_prompt = if let Some(output) = &body.output {
        format!(
            "Explique a seguinte saída do comando '{}':\n\n{}",
            body.prompt, output
        )
    } else if body.prompt.trim().to_lowercase().starts_with("complete este comando:") {
        body.prompt.clone()
    } else {
        format!("Explique o comando: {}", body.prompt)
    };

    let json = serde_json::json!({
        "model": "deepseek-coder:6.7b-instruct",
        "stream": false,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    });

    // Envia requisição para o modelo
    match client
        .post("http://ollama:11434/api/chat")
        .json(&json)
        .send()
        .await
    {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(json) => {
                let full = json["message"]["content"]
                    .as_str()
                    .unwrap_or("⚠️ Resposta vazia ou inválida do modelo");

                // Tenta extrair o comando de dentro de bloco markdown
                let re = Regex::new(r"```(?:bash)?\n([\s\S]*?)```").unwrap();
                let extracted = re
                    .captures(full)
                    .and_then(|caps| caps.get(1))
                    .map(|m| m.as_str().trim().lines().next().unwrap_or(""))
                    .unwrap_or("");

                // Autocomplete: envia o comando extraído como sugestão pura
                let resposta_final = if body.prompt.to_lowercase().starts_with("complete este comando:") {
                    extracted.to_string()
                } else {
                    full.to_string()
                };

                // Envia sugestão para o terminal se for comando puro
                if !extracted.is_empty() && body.output.is_none() {
                    if let Some(sender) = &*tx.lock().unwrap() {
                        let _ = sender.send(extracted.to_string());
                    }
                }

                Ok(warp::reply::json(&serde_json::json!({ "response": resposta_final })))
            }
            Err(err) => {
                eprintln!("[AI] Erro ao interpretar JSON da resposta: {}", err);
                Ok(warp::reply::json(&serde_json::json!({"response": "Erro ao interpretar resposta da IA"})))
            }
        },
        Err(err) => {
            eprintln!("[AI] Falha ao contactar DeepSeek: {}", err);
            Ok(warp::reply::json(&serde_json::json!({"response": "Erro ao contactar DeepSeek"})))
        }
    }
}
