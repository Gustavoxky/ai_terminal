interface Props {
    llmPrompt: string
    llmResposta: string
    llmSugestao: string | null
    sugestoesExtras: string[]
    onPromptChange: (val: string) => void
    onEnviar: () => void
    onExecutar: () => void
    onCancelar: () => void
    onEscolherSugestao: (cmd: string) => void
}

import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs'

export default function TerminalLLMPanel({
    llmPrompt, llmResposta, llmSugestao, sugestoesExtras,
    onPromptChange, onEnviar, onExecutar, onCancelar, onEscolherSugestao
}: Props) {
    return (
        <div className="w-full bg-black p-2">
            <div className="flex">
                <input
                    type="text"
                    className="flex-1 bg-zinc-900 pl-2 rounded outline-none"
                    placeholder="pergunte ao agent..."
                    value={llmPrompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                />
                <button
                    className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-500"
                    onClick={onEnviar}
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
                                onChange={(e) => onEscolherSugestao(e.target.value)}
                                className="px-2 py-1 text-green-300 border rounded flex-1"
                            />
                            <button onClick={onExecutar} className="px-3 py-1 bg-zinc-600 text-white rounded hover:bg-zinc-700">Executar</button>
                            <button onClick={onCancelar} className="text-sm text-gray-400 hover:underline">Cancelar</button>
                        </div>

                        {sugestoesExtras.length > 0 && (
                            <div className="mt-2 space-y-1">
                                <div className="text-gray-400 text-sm">💡 Outras sugestões:</div>
                                {sugestoesExtras.map((cmd, idx) => (
                                    <button key={idx} onClick={() => onEscolherSugestao(cmd)} className="block text-left text-sm text-blue-300 hover:underline">
                                        {cmd}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
