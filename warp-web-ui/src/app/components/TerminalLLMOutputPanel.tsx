import { Play, X } from 'lucide-react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

interface Props {
    llmResposta: string
    llmSugestao: string | null
    sugestoesExtras: string[]
    onExecutar: () => void
    onCancelar: () => void
    onEscolherSugestao: (cmd: string) => void
}

export default function TerminalLLMOutputPanel({
    llmResposta,
    llmSugestao,
    sugestoesExtras,
    onExecutar,
    onCancelar,
    onEscolherSugestao
}: Props) {
    return (
        <div className="w-3xl space-y-6 text-sm">
            {/* Resposta da IA */}
            {llmResposta && (
                <div className="bg-zinc-900 rounded-4xl border border-zinc-800 p-4 text-gray-200 whitespace-pre-wrap break-words">
                    <SyntaxHighlighter
                        language="bash"
                        style={atomOneDark}
                        wrapLongLines={true}
                        customStyle={{
                            background: 'transparent',
                            margin: 0,
                            padding: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '0.875rem',
                            lineHeight: '1.5rem',
                        }}
                    >
                        {llmResposta}
                    </SyntaxHighlighter>
                </div>
            )}

            {/* Sugestão principal */}
            {llmSugestao && (
                <div className="bg-zinc-900 border border-zinc-700 rounded-4xl p-4 space-y-3">
                    <div className="text-white font-medium flex items-center gap-2">
                        💡 Sugestão da IA:
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={llmSugestao}
                            onChange={(e) => onEscolherSugestao(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-4xl border border-zinc-700 bg-black text-green-300 placeholder:text-gray-500 text-sm focus:outline-none focus:ring focus:ring-zinc-600"
                        />
                        <button
                            onClick={onExecutar}
                            className="p-2 rounded-4xl bg-zinc-700 hover:bg-zinc-600 transition"
                            title="Executar"
                        >
                            <Play className="w-4 h-4 text-white" />
                        </button>
                        <button
                            onClick={onCancelar}
                            className="p-2 rounded-4xl hover:bg-zinc-700 transition"
                            title="Cancelar"
                        >
                            <X className="w-4 h-4 text-gray-400 hover:text-white" />
                        </button>
                    </div>

                    {/* Outras sugestões */}
                    {sugestoesExtras.length > 0 && (
                        <div>
                            <div className="text-gray-400 text-xs mb-2">Outras sugestões:</div>
                            <div className="flex flex-wrap gap-2">
                                {sugestoesExtras.map((cmd, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onEscolherSugestao(cmd)}
                                        className="px-3 py-1 rounded-4xl bg-zinc-800 text-blue-300 text-xs hover:bg-zinc-700 hover:underline transition"
                                    >
                                        {cmd}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
