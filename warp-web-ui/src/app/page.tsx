'use client'

import { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { LogBlock } from './components/types'
import { useTerminalSession } from './components/hooks/useTerminalSession'
import TerminalLog from './components/TerminalLog'
import TerminalInput from './components/TerminalInput'
import SidebarPanel from './components/SidebarPanel'
import { BrainCog, LayoutPanelLeft, Plus, Terminal, X } from 'lucide-react'
import TerminalLLMOutputPanel from './components/TerminalLLMOutputPanel'
import TerminalLLMInput from './components/TerminalLLMInput'

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
  const [sugestaoAutoComplete, setSugestaoAutoComplete] = useState<string | null>(null)
  const [sidebarAberta, setSidebarAberta] = useState(true)


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
    setSugestaoAutoComplete(null)
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
    } else if ((e.key === 'Tab' || e.key === 'ArrowRight') && sugestaoAutoComplete?.startsWith(cmd)) {
      e.preventDefault()
      setCmd(sugestaoAutoComplete)
      setSugestaoAutoComplete(null)
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

  useEffect(() => {
    if (!cmd.trim()) return setSugestaoAutoComplete(null)

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:3030/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: `Complete este comando: ${cmd}` })
        })
        const json = await res.json()
        const resposta = json.response?.trim()
        if (resposta?.toLowerCase().startsWith(cmd.toLowerCase())) {
          setSugestaoAutoComplete(resposta)
        } else {
          setSugestaoAutoComplete(null)
        }
      } catch {
        setSugestaoAutoComplete(null)
      }
    }, 400)

    return () => clearTimeout(timeout)
  }, [cmd])

  return (
    <div
      className={`grid grid-rows-[1fr] h-screen bg-black text-green-400 font-mono transition-all duration-300
        }`}
      style={{
        gridTemplateColumns: sidebarAberta ? '300px 1fr' : '48px 1fr',
        gridTemplateAreas: `'sidebar main'`,
      }}
    >

      {/* Área principal */}
      <div style={{ gridArea: 'main' }} className="flex flex-col w-full justify-center items-center h-screen overflow-y-auto">
        {/* Abas de sessões */}
        <div className="flex gap-2 p-2 bg-black overflow-x-auto">
          {sessoes.map(s => (
            <div key={s} className="relative group">
              <button
                onClick={() => setSessaoAtiva(s)}
                className={`px-2 py-1 text-sm rounded-4xl pr-12 transition duration-200 ${s === sessaoAtiva
                  ? 'bg-zinc-900 text-white'
                  : 'bg-black text-gray-400 hover:bg-zinc-900 hover:text-white'
                  }`}
              >
                <Terminal className="inline-block mr-2 w-4 h-4" />
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
                    if (sessaoAtiva === s) {
                      setSessaoAtiva('default')
                    }
                  }}
                  className="absolute top-1/2 right-1 -translate-y-1/2 px-1 rounded-4xl group-hover:flex hidden"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-white" />
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
            className="px-2 py-1 text-sm rounded-4xl hover:bg-zinc-900 text-white transition duration-200"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Área de scroll com resposta da IA + logs */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 scrollbar-thin w-full flex justify-center">
          <div className="relative flex flex-col space-y-4 w-full max-w-4xl min-h-[calc(100vh-10vh)]">
            {/* Resposta da IA */}
            {modoInput === 'ia' && (llmResposta || llmSugestao) && (
              <TerminalLLMOutputPanel
                llmResposta={llmResposta}
                llmSugestao={llmSugestao}
                sugestoesExtras={sugestoesExtras}
                onExecutar={() => {
                  if (llmSugestao) sendCommand(llmSugestao)
                  setLlmSugestao(null)
                }}
                onCancelar={() => setLlmSugestao(null)}
                onEscolherSugestao={setLlmSugestao}
              />
            )}

            {/* Logs da sessão */}
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
            {/* Input do terminal ou da IA fixo ao final da div scrollável */}
            <div className="sticky bottom-0 bg-black py-2">
              {modoInput === 'terminal' && (
                <TerminalInput
                  cmd={cmd}
                  cwd={cwd}
                  onChange={setCmd}
                  onKeyDown={handleKey}
                  autoCompleteSugestao={sugestaoAutoComplete}
                />
              )}
              {modoInput === 'ia' && (
                <TerminalLLMInput
                  prompt={llmPrompt}
                  onChange={setLlmPrompt}
                  onEnviar={enviarPromptLLM}
                />
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Sidebar sempre visível, alternando entre minimizada e expandida */}
      <div
        style={{ gridArea: 'sidebar' }}
        className={`relative h-screen overflow-y-auto scrollbar-thin bg-black transition-all duration-300 flex flex-col ${sidebarAberta ? 'w-full' : 'w-12'
          }`}
      >
        {/* Botão no topo da sidebar */}
        <div className="absolute top-0 right-0 p-2 z-50">
          <button
            onClick={() => setSidebarAberta(prev => !prev)}
            className="text-gray-400 hover:text-white transition p-2 rounded-4xl"
          >
            <LayoutPanelLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo visível só quando expandida */}
        {sidebarAberta && (
          <SidebarPanel
            iaHistorico={historicoIA}
            favoritos={favoritos}
            ultimoOutput={logs.at(-1)?.output || ''}
            cwd={cwd}
            onExecutar={sendCommand}
          />
        )}
      </div>

      {/* Barra de modos fixa no rodapé */}
      <div className="fixed bottom-0 left-0 w-[80%]">
        <div className="h-[5vh] w-full bg-transparent flex items-center gap-2 px-4 z-50">
          <button
            className={`px-3 py-1 rounded-4xl text-sm ${modoInput === 'terminal' ? 'bg-zinc-700 text-white' : 'bg-black text-gray-400 hover:bg-gray-800'}`}
            onClick={() => setModoInput('terminal')}
          >
            <Terminal className="w-5 h-5" />
          </button>
          <button
            className={`px-3 py-1 rounded-4xl text-sm ${modoInput === 'ia' ? 'bg-zinc-700 text-white' : 'bg-black text-gray-400 hover:bg-gray-800'}`}
            onClick={() => setModoInput('ia')}
          >
            <BrainCog className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )

}
