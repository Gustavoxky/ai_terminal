export interface LogBlock {
    id: string
    command: string
    output: string
    timestamp: string
}

export interface RespostaLLM {
    texto: string;
    sugestao?: string | null;
    extras?: string[];
}
