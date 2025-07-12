# AI Terminal
Terminal web interativo com suporte a execução de comandos shell via PTY, histórico persistente, WebSocket em tempo real e integração com uma IA copiloto para sugestões, explicações e comandos seguros.

---

## 🚀 Funcionalidades

- ✅ Interface de terminal em tempo real com WebSocket
- ✅ Execução de comandos shell isolada por sessão (`session_id`)
- ✅ Histórico com navegação (`↑` / `↓`) e persistência no `localStorage`
- ✅ Copiloto IA com:
  - 📌 Sugestões automáticas baseadas no prompt
  - ✍️ Comando editável antes da execução
  - 🔁 Múltiplas sugestões clicáveis
  - 🔍 Explicações para comandos e suas saídas
- ✅ Ações por comando:
  - Reexecutar 🔁
  - Copiar 📋
  - Explicar 🤖
- ✅ Diretório dinâmico no prompt (`➜ ~/projeto ❯`)
---

## 📦 Tecnologias utilizadas

### Frontend
- `Next.js` + `React`
- `TailwindCSS`
- `react-syntax-highlighter`

### Backend
- `Rust` com `warp`, `tokio`, `portable-pty`, `reqwest`
- WebSocket para atualização em tempo real
- Sessões gerenciadas por `UUID` via query string
- Comunicação com modelo IA (ex: DeepSeek via Ollama)

### IA
- `Ollama` + `deepseek-coder:6.7b-instruct` rodando localmente

---

## 📁 Estrutura do projeto

```
📦 warp-web-terminal/
├── docker-compose.yml
├── frontend/      # Next.js app
├── backend/       # Rust + Warp API
├── Dockerfile.backend
├── Dockerfile.frontend
├── Dockerfile.ollama
└── README.md
```

---

## 🔧 Como rodar com Docker Compose

### 1. Clone o projeto

```bash
git clone https://github.com/seu-usuario/ai-terminal.git
cd ai-terminal
```

### 2. Suba os containers

```bash
docker compose up --build
```

### 3. Acesse os serviços

- 🖥 Terminal Web: http://localhost:3005
- ⚙️ Backend API: http://localhost:3030
- 🧠 Ollama LLM API: http://localhost:11434

### 4. Verifique o modelo DeepSeek

Se ainda não tiver o modelo, instale com:

```bash
ollama run deepseek-coder:6.7b-instruct
```

---

## 🐳 docker-compose.yml

```yaml
services:
  ollama:
    build:
      context: .
      dockerfile: Dockerfile.ollama
    container_name: ollama
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: warp-backend
    depends_on:
      - ollama
    ports:
      - "3030:3030"
    volumes:
      - ./src:/app/src
      - ./Cargo.toml:/app/Cargo.toml

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: warp-frontend
    depends_on:
      - backend
    ports:
      - "3005:3000"

volumes:
  ollama_data:
```

---

## 🛡️ Segurança

- Modo seguro: comandos da IA **não são executados automaticamente**
- O usuário revisa e executa manualmente sugestões da IA
- Sessões isoladas com `UUID`

---

## 📈 Próximas melhorias

- [ ] Editor visual de arquivos (modo `nano` no browser)
- [ ] Suporte a múltiplas sessões em abas
- [ ] Autenticação (JWT ou OAuth)
- [ ] Upload/download de arquivos com preview

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

- Abrir uma issue 🐛
- Sugerir melhorias 💡
- Criar um pull request 🚀

---

## 📄 Licença

MIT © [Seu Nome ou Organização]
