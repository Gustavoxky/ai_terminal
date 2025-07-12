interface Props {
    cmd: string
    cwd: string
    onChange: (val: string) => void
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export default function TerminalInput({ cmd, cwd, onChange, onKeyDown }: Props) {
    return (
        <div className="mt-4 mb-4 flex items-center">
            <span className="text-green-400 mr-2">➜</span>
            <span className="text-blue-400 mr-2">{cwd}</span>
            <input
                type="text"
                className="flex-1 bg-transparent outline-none"
                value={cmd}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                autoFocus
            />
        </div>
    )
}
