# AGENTS.md

## Escopo

Estas instruções se aplicam a todo o módulo `local-agent-desktop`.

## Objetivo

Fornecer uma aplicação desktop Linux com Tauri para consultar e controlar somente os serviços locais `worker` e `observer`, preservando os launchers atuais de desenvolvimento.

## Regras

- Não criar comando genérico para executar shell, binários ou caminhos recebidos da interface.
- Aceitar somente os identificadores fixos `worker` e `observer`.
- Preferir `systemd --user` como supervisor dos processos.
- Manter as portas e verificações de saúde vinculadas a `127.0.0.1`.
- Não enviar variáveis de ambiente, tokens, conteúdo de `.env` ou caminhos sensíveis ao frontend.
- Desabilitar ações na interface enquanto um serviço estiver em transição.
- Confirmar apenas a ação coletiva de parar todos os serviços.
- Manter testes unitários para validação de identificadores, mapeamento das units e interpretação dos estados do `systemd`.
- Não alterar nem remover os launchers de desenvolvimento existentes.

## Gate transversal

- Execute `npm run validate` antes de concluir alterações.
- O gate inclui UTF-8, typecheck, testes TypeScript, testes Rust e build web.
- O build Tauri (`npm run tauri:build`) é obrigatório quando a alteração
  atingir configuração Rust, capabilities, units ou empacotamento.
- O ESLint valida o frontend TypeScript; a validação automática de comentários
  é obrigatória pelo script `validate:comments`. O Rust é validado pelo Cargo.
