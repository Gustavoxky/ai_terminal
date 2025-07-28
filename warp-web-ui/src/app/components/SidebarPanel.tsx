'use client'

import { useEffect, useState } from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

interface SidebarPanelProps {
    iaHistorico: string[]
    favoritos: string[]
    ultimoOutput: string
    cwd: string
    onExecutar: (cmd: string) => void
}

export default function SidebarPanel({
    iaHistorico,
    favoritos,
    ultimoOutput,
    cwd,
    onExecutar,
}: SidebarPanelProps) {
    const [arquivos, setArquivos] = useState<string[]>([])

    useEffect(() => {
        const fetchArquivos = async () => {
            try {
                const res = await fetch('http://localhost:3030/status')
                const json = await res.json()
                if (json.files) {
                    setArquivos(json.files)
                }
            } catch (err) {
                console.error('Erro ao listar arquivos:', err)
            }
        }
        fetchArquivos()
    }, [cwd])

    return (
        <div className="w-full bg-[#111] text-white p-4 border-l border-gray-700 overflow-y-auto h-screen space-y-6">

            {/* 📜 Histórico da IA */}
            <section>
                <h2 className="text-green-400 text-sm font-bold mb-2">📜 Histórico da IA</h2>
                <div className="text-sm space-y-2 line-clamp-5 overflow-hidden">
                    {iaHistorico.map((msg, idx) => (
                        <div key={idx} className="text-gray-300 border-b border-gray-600 pb-1">{msg}</div>
                    ))}
                </div>
            </section>

            {/* ⭐ Comandos Favoritos */}
            <section>
                <h2 className="text-yellow-400 text-sm font-bold mb-2">⭐ Favoritos</h2>
                <ul className="space-y-1 text-sm overflow-hidden max-h-32">
                    {favoritos.map((cmd, idx) => (
                        <li key={idx} className="flex justify-between items-center">
                            <span className="text-blue-300 overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px] block">{cmd}</span>
                            <button onClick={() => onExecutar(cmd)} className="text-green-500 text-xs hover:underline">Executar</button>
                        </li>
                    ))}
                </ul>
            </section>

            {/* 📄 Último Output formatado */}
            <section>
                <h2 className="text-purple-400 text-sm font-bold mb-2">📄 Última Saída</h2>
                <div className="text-xs overflow-hidden max-h-32">
                    <SyntaxHighlighter
                        language="bash"
                        style={atomOneDark}
                        customStyle={{
                            background: 'transparent',
                            overflow: 'hidden',
                            maxHeight: '8rem',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {ultimoOutput || 'Nenhuma saída disponível.'}
                    </SyntaxHighlighter>
                </div>

            </section>

            {/* 📁 Arquivos no diretório atual */}
            <section>
                <h2 className="text-cyan-400 text-sm font-bold mb-2">📁 {cwd}</h2>
                <ul className="text-sm space-y-1 overflow-hidden max-h-32 line-clamp-4">
                    {arquivos.map((file, idx) => (
                        <li key={idx} className="text-gray-300">{file}</li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
