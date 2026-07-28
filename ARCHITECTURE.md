# Arquitetura do `local-agent-desktop`

## Visão geral

O `local-agent-desktop` é o aplicativo desktop Linux do Local Agent. Ele consulta e controla somente as units `local-agent-worker.service` e `local-agent-observer.service`, usando Tauri para a ponte entre a interface React e o backend Rust.

## Versões

- `Node.js`: `22+` para executar os serviços locais.
- `TypeScript`: `5.7`.
- `React`: `19`.
- `Vite`: `6`.
- `Tauri`: `2`.
- `Rust`: `1.77+`.
- `Sistema suportado/testado`: Linux com `systemd --user`.

## Stack principal

- `React` e `TypeScript` para a interface.
- `Vite` para desenvolvimento e bundle web.
- `Tauri 2` para o aplicativo desktop e IPC.
- `Rust` para comandos nativos, validação e controle das units.
- `systemd --user` para supervisão dos serviços locais.
- `Vitest` e testes nativos Rust para validação.

## Estrutura de pacotes

```text
├── docs/                 Documentação de apoio.
├── scripts/              Validações auxiliares.
├── src/                  Interface React.
│   ├── components/       Cartões e componentes visuais.
│   ├── hooks/            Consulta e ações sobre serviços locais.
│   ├── routes/           Tela principal do Desktop.
│   └── services/         Modelo de estados e regras de ações.
├── src-tauri/            Aplicação nativa Tauri/Rust.
│   ├── capabilities/     Permissões IPC e do plugin opener.
│   ├── icons/             Ícones de distribuição.
│   └── src/               Comandos e gerenciador de serviços.
└── systemd/              Units de referência para worker e observer.
```

## Bibliotecas e ferramentas mais importantes

- `@tauri-apps/api`: invocação de comandos nativos a partir do frontend.
- `tauri-plugin-opener`: abertura do Hub no navegador padrão.
- `react` e `react-dom`: composição da interface.
- `vitest`: testes das regras de estado do frontend.
- `serde` e `thiserror`: serialização e erros estruturados no backend.
- `libc`: leitura de `CLOCK_MONOTONIC` para calcular o uptime na mesma base do `systemd`.

## Estrutura interna

- `src/hooks/use-local-services.ts`: consulta periódica, configuração e ações dos serviços.
- `src/services/service-model.ts`: allowlist de serviços, estados e regras de habilitação.
- `src/components/service-card.tsx`: exibição e controles de cada serviço.
- `src/routes/services.tsx`: tela principal, ações coletivas e abertura do Hub.
- `src-tauri/src/commands.rs`: fronteira IPC com comandos explícitos.
- `src-tauri/src/service_manager.rs`: descoberta do workspace, validação do Node.js, units e interpretação do `systemctl`.
- `src-tauri/src/lib.rs`: bootstrap Tauri e URL de produção do Hub.

## Responsabilidade arquitetural

O Desktop separa apresentação, IPC e supervisão operacional:

1. a interface solicita estados e ações por IPC;
2. os comandos Rust validam o identificador contra `worker` e `observer`;
3. o gerenciador mapeia o identificador para uma unit fixa;
4. o `systemd --user` executa e supervisiona o processo Node.js;
5. o Desktop interpreta o resultado e atualiza a interface.

O aplicativo não executa shell genérico, não recebe paths de execução da interface e não envia secrets ao frontend.

## Fluxo principal

1. Inicializa a janela Tauri maximizada.
2. Consulta `systemctl --user show` para as duas units.
3. Converte `ActiveState`, `SubState` e `Result` em estado visual.
4. Atualiza a tela automaticamente a cada 5 segundos.
5. Executa somente `start`, `stop` ou `restart` na unit selecionada.
6. Abre o Hub de produção em `https://local-agent-view.pages.dev/`.

Na configuração inicial, o Desktop encontra o workspace, valida um Node.js 22+ e grava o caminho absoluto desse runtime nas units. Isso evita que o `systemd --user` escolha acidentalmente um Node.js antigo do sistema.

## Segurança

- O allowlist de serviços aceita apenas `worker` e `observer`.
- As units e ações são definidas no backend, não na interface.
- As portas dos serviços permanecem vinculadas a `127.0.0.1`.
- A ação coletiva de parada exige confirmação.
- O conteúdo de `.env`, tokens e caminhos sensíveis não é exposto ao frontend.
- Falhas em `auto-restart` são reportadas como `FAILED`, evitando mascarar um loop de reinício como `STARTING`.

## Observações úteis

- O Desktop é um módulo Linux; o Hub continua sendo uma aplicação web independente.
- As units geradas ficam em `~/.config/systemd/user`.
- `LOCAL_AGENT_NODE` pode ser definido no `.env` do `worker` ou do `observer` quando o Node.js não estiver no `PATH` da aplicação.
- Execute `npm run tauri:build` para gerar os pacotes AppImage e `.deb`.
