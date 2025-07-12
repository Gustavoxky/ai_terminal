'use client'

import { useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { LogBlock } from './components/types'
import { useTerminalSession } from './components/hooks/useTerminalSession'
import TerminalLog from './components/TerminalLog'
import TerminalInput from './components/TerminalInput'
import TerminalLLMPanel from './components/TerminalLLMPanel'
import SidebarPanel from './components/SidebarPanel'

export default function TerminalPage() {
  const [sessoes, setSessoes] = useState<string[]>(['default'])
  const [sessaoAtiva, setSessaoAtiva] = useState<string>('default')
  const [logsPorSessao, setLogsPorSessao] = useState<Record<string, LogBlock[]>>({ default: [] })
  const [cmd, setCmd] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [llmPrompt, setLlmPrompt] = useState('')
  const [llmResposta, setLlmResposta] = useState('')
  const [llmSugestao, setLlmSugestao] = useState<string | null>(null)
  const [sugestoesExtras, setSugestoesExtras] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [historicoIA, setHistoricoIA] = useState<string[]>([])
  const [favoritos, setFavoritos] = useState<string[]>([])
  const [modoInput, setModoInput] = useState<'terminal' | 'ia'>('terminal')

  const logs = logsPorSessao[sessaoAtiva] || []
  const setLogs = (fn: (prev: LogBlock[]) => LogBlock[]) => {
    setLogsPorSessao(prev => ({
      ...prev,
      [sessaoAtiva]: fn(prev[sessaoAtiva] || [])
    }))
  }

  const { cwd } = useTerminalSession(sessaoAtiva, setLogs)

  const sendCommand = async (input: string) => {
    if (!input.trim()) return
    setHistory(prev => [...prev, input])
    setHistoryIndex(null)
    setCmd('')
    setLogs(prev => [...prev, {
      id: uuidv4(),
      command: input,
      output: '',
      timestamp: new Date().toISOString()
    }])
    await fetch(`http://localhost:3030/input?session_id=${sessaoAtiva}`, {
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
      setHistoricoIA(prev => [...prev, resposta])

      const blocos = Array.from(resposta.matchAll(/```(?:bash)?\n([\s\S]*?)```/g)) as RegExpMatchArray[]
      const comandos = blocos
        .map(m => m[1].trim())
        .flatMap(block => block.split('\n').map(l => l.trim()).filter(Boolean))

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

  const handleReexecute = (command: string) => sendCommand(command)
  const handleCopy = (command: string) => navigator.clipboard.writeText(command)

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
    } catch {
      setLlmResposta('Erro ao contactar o servidor de IA')
    }
  }

  const handleExplainOutput = async (command: string, output: string) => {
    setLlmResposta(`🔍 Explicando a saída de: "${command}"...`)
    setLlmSugestao(null)
    try {
      const res = await fetch('http://localhost:3030/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: command, output })
      })
      const json = await res.json()
      setLlmResposta(json.response || 'Resposta vazia')
    } catch {
      setLlmResposta('Erro ao contactar o servidor de IA')
    }
  }

  const handleFavoritar = (command: string) => {
    setFavoritos(prev => [...new Set([...prev, command])])
  }

  return (
    <div
      className="grid grid-cols-[4fr_1fr] grid-rows-[1fr] min-h-screen bg-black text-green-400 font-mono"
      style={{ gridTemplateAreas: `'main sidebar'` }}
    >
      {/* Área principal do terminal */}
      <div style={{ gridArea: 'main' }} className="flex flex-col w-full">
        <div className="flex gap-2 p-2 bg-black overflow-x-auto">
          {sessoes.map(s => (
            <div key={s} className="relative group">
              <button
                onClick={() => setSessaoAtiva(s)}
                className={`px-2 py-1 text-sm rounded pr-6 transition duration-200 ${s === sessaoAtiva
                  ? 'bg-zinc-900 text-white'
                  : 'bg-black text-gray-400 hover:bg-zinc-900 hover:text-white'
                  }`}
              >
                Sessão {s.slice(0, 5)}
              </button>

              {s !== 'default' && (
                <button
                  onClick={() => {
                    setSessoes(prev => prev.filter(sessao => sessao !== s))
                    setLogsPorSessao(prev => {
                      const novo = { ...prev }
                      delete novo[s]
                      return novo
                    })

                    // se estava ativa, voltar pra default
                    if (sessaoAtiva === s) {
                      setSessaoAtiva('default')
                    }
                  }}
                  className="absolute top-1/2 w-[24px] h-[24px] ml-[20px] right-1 -translate-y-1/2 px-1 text-xs text-gray-400 hover:bg-zinc-600 rounded"
                >
                  x
                </button>
              )}
            </div>
          ))}

          <button
            onClick={() => {
              const novaSessao = uuidv4()
              setSessoes(prev => [...prev, novaSessao])
              setSessaoAtiva(novaSessao)
              setLogsPorSessao(prev => ({ ...prev, [novaSessao]: [] }))
            }}
            className="px-2 py-1 text-sm rounded hover:bg-zinc-900 text-white transition duration-200"
          >
            +
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 scrollbar-thin w-full" style={{ paddingBottom: '20vh' }}>
          <div className="space-y-4">
            {logs.map(log => (
              <TerminalLog
                key={log.id}
                log={log}
                onReexecute={handleReexecute}
                onCopy={handleCopy}
                onExplain={handleExplain}
                onExplainOutput={handleExplainOutput}
                onFavoritar={handleFavoritar}
              />
            ))}
            <div ref={scrollRef}></div>
          </div>
        </div>

        {/* Terminal Input (acima dos botões) */}
        {modoInput === 'terminal' && (
          <div className="fixed bottom-[5vh] left-0 w-[80%] px-4 py-2 bg-black z-40">
            <TerminalInput
              cmd={cmd}
              cwd={cwd}
              onChange={setCmd}
              onKeyDown={handleKey}
            />
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ gridArea: 'sidebar' }} className="w-full flex h-screen flex-col overflow-y-auto p-4 scrollbar-thin">
        <SidebarPanel
          iaHistorico={historicoIA}
          favoritos={favoritos}
          ultimoOutput={logs.at(-1)?.output || ''}
          cwd={cwd}
          onExecutar={sendCommand}
        />
      </div>

      {/* Painéis fixos: IA Panel + Botões */}
      <div className="fixed bottom-0 left-0 w-[80%]">
        {/* IA Panel logo acima dos botões */}
        {modoInput === 'ia' && (
          <div className="fixed bottom-[5vh] left-0 w-[80%] px-4 py-2 bg-black z-40">
            <TerminalLLMPanel
              llmPrompt={llmPrompt}
              llmResposta={llmResposta}
              llmSugestao={llmSugestao}
              sugestoesExtras={sugestoesExtras}
              onPromptChange={setLlmPrompt}
              onEnviar={enviarPromptLLM}
              onExecutar={() => {
                if (llmSugestao) sendCommand(llmSugestao)
                setLlmSugestao(null)
              }}
              onCancelar={() => setLlmSugestao(null)}
              onEscolherSugestao={setLlmSugestao}
            />
          </div>
        )}

        {/* Rodapé fixo ocupando 5% da tela */}
        <div className="h-[5vh] w-full bg-black flex items-center gap-2 px-4 z-50">
          <button
            className={`px-3 py-1 rounded text-sm ${modoInput === 'terminal' ? 'bg-zinc-700 text-white' : 'bg-black text-gray-400 hover:bg-gray-800'}`}
            onClick={() => setModoInput('terminal')}
          >
            Terminal
          </button>
          <button
            className={`px-3 py-1 rounded text-sm ${modoInput === 'ia' ? 'bg-zinc-700 text-white' : 'bg-black text-gray-400 hover:bg-gray-800'}`}
            onClick={() => setModoInput('ia')}
          >
            IA
          </button>
        </div>
      </div>
    </div >
  )

}
