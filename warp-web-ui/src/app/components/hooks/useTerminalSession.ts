'use client'

import { useEffect } from 'react'
import { LogBlock } from '../types'

export function useTerminalSession(
    sessionId: string,
    setLogs: (fn: (prev: LogBlock[]) => LogBlock[]) => void) {
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`http://localhost:3030/output?session_id=${sessionId}`)
                const output = await res.text()

                if (output.trim()) {
                    setLogs(prevLogs => {
                        const reversed = [...prevLogs].reverse()
                        const lastLogWithEmptyOutput = reversed.find(log => log.output === '')

                        if (lastLogWithEmptyOutput) {
                            const updatedLogs = prevLogs.map(log =>
                                log.id === lastLogWithEmptyOutput.id
                                    ? { ...log, output }
                                    : log
                            )
                            return updatedLogs
                        }

                        return prevLogs
                    })
                }
            } catch (err) {
                console.error('[TerminalSession] Erro ao buscar saída:', err)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [sessionId, setLogs])

    const cwd = '~'
    return { cwd }
}
