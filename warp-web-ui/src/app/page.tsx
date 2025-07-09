'use client'

import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs'

interface LogBlock {
  id: string
  command: string
  output: string
  timestamp: string
}

export default function TerminalPage() {
  const [logs, setLogs] = useState<LogBlock[]>([])
  const [cmd, setCmd] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [llmPrompt, setLlmPrompt] = useState('')
  const [llmResposta, setLlmResposta] = useState('')
  const [llmSugestao, setLlmSugestao] = useState<string | null>(null)
  const [sugestoesExtras, setSugestoesExtras] = useState<string[]>([])
  const [cwd, setCwd] = useState<string>('~')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sessionId] = useState(() => uuidv4())

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3030/ws?session_id=${sessionId}`)
    ws.onmessage = (event) => {
      const output = event.data
      setLogs(prev => {
        if (prev.length === 0 || prev[prev.length - 1].output !== '') {
          return [...prev, { id: uuidv4(), command: '', output, timestamp: new Date().toISOString() }]
        }
        const last = prev[prev.length - 1]
        return [...prev.slice(0, -1), { ...last, output: last.output + output }]
      })
    }
    return () => ws.close()
  }, [sessionId])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:3030/status')
        const json = await res.json()
        if (json.cwd) setCwd(json.cwd)
      } catch (err) {
        console.error('Erro ao obter diretório atual:', err)
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  const sendCommand = async (input: string) => {
    if (!input.trim()) return
    setHistory((prev) => [...prev, input])
    setHistoryIndex(null)
    setCmd('')
    setLogs(prev => [...prev, {
      id: uuidv4(),
      command: input,
      output: '',
      timestamp: new Date().toISOString()
    }])
    await fetch(`http://localhost:3030/input?session_id=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `cmd=${encodeURIComponent(input)}`
    })
  }

  const enviarPromptLLM = async () => {
    if (!llmPrompt.trim()) return
    setLlmResposta('Pensando...')
    setLlmSugestao(null)
    setSugestoesExtras([])
    try {
      const res = await fetch('http://localhost:3030/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: llmPrompt })
      })
      const json = await res.json()
      const resposta = json.response || 'Resposta vazia'
      setLlmResposta(resposta)

      const blocos = Array.from(resposta.matchAll(/```(?:bash)?\n([\s\S]*?)```/g)) as RegExpMatchArray[]
      const comandos: string[] = blocos
        .map(m => m[1].trim())
        .flatMap((block: string) => block.split('\n').map((l: string) => l.trim()).filter(l => l.length > 0))


      if (comandos.length > 0) {
        setLlmSugestao(comandos[0])
        setSugestoesExtras(comandos.slice(1))
      }
    } catch (err) {
      console.error(err)
      setLlmResposta('Erro ao contactar o servidor de IA')
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendCommand(cmd)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCmd(history[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex !== null) {
        const newIndex = historyIndex + 1
        if (newIndex < history.length) {
          setHistoryIndex(newIndex)
          setCmd(history[newIndex])
        } else {
          setHistoryIndex(null)
          setCmd('')
        }
      }
    }
  }

  const handleReexecute = (command: string) => {
    sendCommand(command)
  }

  const handleCopy = (command: string) => {
    navigator.clipboard.writeText(command)
  }

  const handleExplainOutput = async (command: string, output: string) => {
    setLlmResposta(`🔍 Explicando a saída de: "${command}"...`)
    setLlmSugestao(null)
    try {
      const res = await fetch('http://localhost:3030/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Explique a saída deste comando:\n\n${command}\n\nSaída:\n${output}`
        })
      })
      const json = await res.json()
      setLlmResposta(json.response || 'Resposta vazia')
    } catch (err) {
      console.error(err)
      setLlmResposta('Erro ao contactar o servidor de IA')
    }
  }

  const handleExplain = async (command: string) => {
    setLlmResposta(`🔎 Explicando: "${command}"...`)
    try {
      const res = await fetch('http://localhost:3030/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Explique o comando: ${command}` })
      })
      const json = await res.json()
      setLlmResposta(json.response || 'Resposta vazia')
    } catch (err) {
      console.error(err)
      setLlmResposta('Erro ao contactar o servidor de IA')
    }
  }

  return (
    <div className="bg-black text-green-400 min-h-screen font-mono p-4">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
        {logs.map(log => (
          <div key={log.id} className="bg-gray-900 p-2 rounded border border-gray-700">
            {log.command && (
              <div className="flex justify-between items-center text-white mb-1">
                <span>➜ {log.command}</span>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => handleReexecute(log.command)} className="hover:underline text-green-400">Reexecutar</button>
                  <button onClick={() => handleCopy(log.command)} className="hover:underline text-yellow-400">Copiar</button>
                  <button onClick={() => handleExplain(log.command)} className="hover:underline text-blue-400">Explicar</button>
                </div>
              </div>
            )}
            <div className="relative">
              <SyntaxHighlighter language="bash" style={atomOneDark} customStyle={{ background: 'transparent' }}>
                {log.output.trim()}
              </SyntaxHighlighter>
              {log.command && log.output.trim() !== '' && (
                <div className="text-sm text-right mt-1">
                  <button
                    onClick={() => handleExplainOutput(log.command, log.output)}
                    className="text-purple-400 hover:underline"
                  >
                    🔍 Explicar saída
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef}></div>
      </div>

      <div className="mt-4 flex items-center">
        <span className="text-green-400 mr-2">➜</span>
        <span className="text-blue-400 mr-2">{cwd}</span>
        <input
          type="text"
          className="flex-1 bg-transparent outline-none"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
        />
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-black border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600"
            placeholder="Digite sua pergunta para o LLM..."
            value={llmPrompt}
            onChange={(e) => setLlmPrompt(e.target.value)}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={enviarPromptLLM}
          >
            Enviar
          </button>
        </div>
        <div className="mt-4 text-sm text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
          <SyntaxHighlighter language="bash" style={atomOneDark} customStyle={{ background: 'transparent' }}>
            {llmResposta}
          </SyntaxHighlighter>

          {llmSugestao && (
            <div className="mt-2 text-white">
              💡 A IA sugeriu:
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="text"
                  value={llmSugestao}
                  onChange={(e) => setLlmSugestao(e.target.value)}
                  className="px-2 py-1 bg-gray-800 text-green-300 border border-gray-600 rounded flex-1"
                />
                <button
                  onClick={() => {
                    if (llmSugestao) sendCommand(llmSugestao)
                    setLlmSugestao(null)
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Executar
                </button>
                <button
                  onClick={() => setLlmSugestao(null)}
                  className="text-sm text-gray-400 hover:underline"
                >
                  Cancelar
                </button>
              </div>
              {sugestoesExtras.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-gray-400 text-sm">💡 Outras sugestões:</div>
                  {sugestoesExtras.map((cmd, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLlmSugestao(cmd)}
                      className="block text-left text-sm text-blue-300 hover:underline"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}