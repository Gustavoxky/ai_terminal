import { SendHorizonal } from 'lucide-react'

interface Props {
    prompt: string
    onChange: (val: string) => void
    onEnviar: () => void
}

export default function TerminalLLMInput({ prompt, onChange, onEnviar }: Props) {
    return (
        <div className="relative w-3xl">
            <input
                type="text"
                placeholder="Pergunte ao agente..."
                className="w-3xl h-24 pl-4 pr-12 py-2 rounded-4xl bg-zinc-900 text-sm text-white placeholder:text-gray-500 border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                value={prompt}
                onChange={(e) => onChange(e.target.value)}
            />
            <button
                onClick={onEnviar}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded-4xl hover:bg-zinc-700"
            >
                <SendHorizonal className="w-4 h-4 text-gray-300" />
            </button>
        </div>
    )
}
