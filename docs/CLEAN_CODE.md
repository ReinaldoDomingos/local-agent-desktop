# Código limpo e comentários

Código deve comunicar intenção por meio de nomes, funções pequenas, tipos e testes. Prefira uma única responsabilidade por unidade, fluxo simples, validação antecipada de entradas e eliminação de duplicação que dificulte manutenção. Refatore quando uma alteração revelar uma abstração confusa, mas mantenha cada mudança pequena e coberta por testes.

## Regras do módulo

- Mantenha a separação entre apresentação React, comandos IPC e operações Rust.
- Valide identificadores e estados no backend antes de executar ações em `systemd`.
- Não transforme a interface em uma camada de execução de shell ou em uma fonte de paths sensíveis.
- Prefira tipos explícitos para estados, ações, serviços e payloads serializados pelo Tauri.
- Centralize o allowlist de serviços e units; não repita strings de `worker` e `observer` em regras diferentes.
- Mantenha ações de interface previsíveis: transições devem bloquear controles e ações destrutivas coletivas devem pedir confirmação.
- Preserve o vínculo das APIs locais com `127.0.0.1` e não envie conteúdo de `.env` ao frontend.
- Prefira funções puras para interpretação de estado, habilitação de ações, formatação e cálculos de uptime.
- Use erros estruturados no Rust e mensagens operacionais compreensíveis no frontend.
- Documente decisões arquiteturais e contratos em Markdown, não em comentários espalhados pelo código.

## Frontend React e TypeScript

- Nomeie componentes pela responsabilidade visual ou de fluxo que representam.
- Extraia hooks quando uma tela precisar controlar consulta, polling, transição e tratamento de erro.
- Evite `any`, casts sem validação e objetos sem tipo na fronteira IPC.
- Mantenha eventos de interface curtos; delegue regras de negócio a funções nomeadas e testáveis.
- Use elementos semânticos, estados acessíveis (`role`, `aria-*`) e foco coerente para modais.
- Evite duplicar a mesma regra de habilitação em botões individuais e ações coletivas.

## Backend Rust e Tauri

- Mantenha os comandos Tauri finos: validar entrada, chamar o serviço de domínio e traduzir o erro.
- Não crie comandos genéricos para executar programas, shell ou caminhos recebidos da interface.
- Use enums e funções de mapeamento para representar serviços e estados conhecidos.
- Mantenha operações de arquivo e processo concentradas no gerenciador de serviços.
- Isole chamadas externas (`systemctl`, `node`, relógio monotônico) para que a lógica possa ser testada com providers ou funções puras.
- Evite expor ao frontend detalhes de ambiente, tokens, conteúdo de `.env` e paths desnecessários.

## Units e operação local

- Gere units com `ExecStart` apontando para um Node.js validado e absoluto.
- Mantenha `Restart` e limites de reinício coerentes com o diagnóstico de falhas.
- Trate `auto-restart` com erro como falha operacional, não como inicialização indefinida.
- Não altere launchers de desenvolvimento sem necessidade da tarefa.
- Prefira reconfiguração explícita das units quando o runtime ou os artefatos compilados mudarem.

## Comentários

Não escreva comentários em código de produção ou teste. Um comentário normalmente sinaliza que o nome, a estrutura ou a extração de uma função pode ser melhorado. Em vez de explicar *como* uma instrução funciona, expresse o porquê no desenho do código, no nome de uma regra de domínio ou nesta documentação.

Exceções são raras: licenças obrigatórias, diretivas exigidas por compiladores ou ferramentas e arquivos gerados que não devem ser editados. README, documentos de arquitetura e mensagens de commit continuam sendo os locais adequados para decisões, contratos e instruções de uso.

## Validação antes da entrega

Execute os comandos do módulo afetado:

```bash
npm run validate:utf8
npm test
npm run typecheck
npm run build
npm run test:rust
```

Não entregue a alteração enquanto uma dessas validações estiver falhando. Para mudanças no empacotamento ou na configuração Tauri, acrescente:

```bash
npm run tauri:build:deb
```
