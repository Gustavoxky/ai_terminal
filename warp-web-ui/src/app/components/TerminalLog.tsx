'use client'

import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs'
import { LogBlock } from './types'

interface TerminalLogProps {
    log: LogBlock
    onReexecute: (command: string) => void
    onCopy: (command: string) => void
    onExplain: (command: string) => void
    onExplainOutput: (command: string, output: string) => void
    onFavoritar: (command: string) => void
}

export default function TerminalLog({
    log,
    onReexecute,
    onCopy,
    onExplain,
    onExplainOutput,
    onFavoritar,
}: TerminalLogProps) {
    return (
        <div className="bg-zinc-900 p-2 rounded border border-gray-700">
            {log.command && (
                <div className="flex justify-between items-center text-white mb-1">
                    <span>➜ {log.command}</span>
                    <div className="flex gap-2 text-sm">
                        <button
                            onClick={() => onReexecute(log.command)}
                            className="hover:underline text-green-400"
                        >
                            Reexecutar
                        </button>
                        <button
                            onClick={() => onCopy(log.command)}
                            className="hover:underline text-yellow-400"
                        >
                            Copiar
                        </button>
                        <button
                            onClick={() => onExplain(log.command)}
                            className="hover:underline text-blue-400"
                        >
                            Explicar
                        </button>
                        <button
                            onClick={() => onFavoritar(log.command)}
                            className="hover:underline text-yellow-500"
                        >
                            ⭐
                        </button>
                    </div>
                </div>
            )}

            <div className="relative">
                <SyntaxHighlighter
                    language="bash"
                    style={atomOneDark}
                    customStyle={{ background: 'transparent' }}
                >
                    {log.output.trim()}
                </SyntaxHighlighter>

                {log.command && log.output.trim() !== '' && (
                    <div className="text-sm text-right mt-1">
                        <button
                            onClick={() => onExplainOutput(log.command, log.output)}
                            className="text-purple-400 hover:underline"
                        >
                            🔍 Explicar saída
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
