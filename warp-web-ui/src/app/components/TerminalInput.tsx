interface Props {
    cmd: string
    cwd: string
    onChange: (val: string) => void
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
    autoCompleteSugestao?: string | null
}

export default function TerminalInput({ cmd, cwd, onChange, onKeyDown, autoCompleteSugestao }: Props) {
    return (
        <div className="mt-4 mb-4 flex items-center relative">
            <span className="text-green-400 mr-2">➜</span>
            <span className="text-blue-400 mr-2">{cwd}</span>
            <div className="relative flex-1">
                <input
                    type="text"
                    className="w-full bg-transparent outline-none relative z-10 text-green-400"
                    value={cmd}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    autoFocus
                />
                {autoCompleteSugestao && autoCompleteSugestao.startsWith(cmd) && (
                    <span className="absolute top-0 left-0 text-green-600 opacity-30 pointer-events-none select-none z-0">
                        {autoCompleteSugestao}
                    </span>
                )}
            </div>
        </div>
    )
}
