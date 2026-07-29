# Local Agent Desktop

O padrão transversal de stack e validação está em
`../docs/ENGINEERING-STANDARD.md`; as regras para IA estão em
`../docs/AI-RULES.md`.

Aplicativo desktop Linux para consultar e controlar os serviços locais `worker` e `observer` do Local Agent. A aplicação usa Tauri 2, React, Vite e `systemd --user`.

## Funcionalidades

- Consulta automática do estado, PID e uptime dos serviços.
- Ações individuais de iniciar, parar e reiniciar.
- Ações coletivas para iniciar todos ou parar todos os serviços ativos.
- Configuração das units do `systemd --user` pelo próprio aplicativo.
- Acesso ao Hub de produção: [local-agent-view.pages.dev](https://local-agent-view.pages.dev/).
- Interface com escopo fechado: somente `worker` e `observer` podem ser controlados.

A arquitetura detalhada está em [ARCHITECTURE.md](ARCHITECTURE.md). As convenções de implementação estão em [docs/CLEAN_CODE.md](docs/CLEAN_CODE.md).

## Pré-requisitos

- Linux com `systemd --user` e `systemctl` disponível.
- Node.js 22 ou superior com `npm`.
- Rust e as dependências de desenvolvimento do Tauri 2.
- Os módulos `local-agent-worker` e `local-agent-observer` no workspace do Local Agent.

O caminho do workspace pode ser informado explicitamente:

```bash
export LOCAL_AGENT_WORKSPACE="$HOME/workspace/estudo/local-agent"
```

Quando o Node.js não estiver no `PATH` da aplicação desktop, informe o executável explicitamente em `LOCAL_AGENT_NODE` no `.env` do `worker` ou do `observer`:

```bash
export LOCAL_AGENT_NODE="$(command -v node)"
```

O caminho precisa apontar para um arquivo executável real; curingas não são expandidos pelo aplicativo.

Sem essa variável, o Desktop procura o workspace nos diretórios ancestrais do diretório atual e no caminho padrão acima.

## Desenvolvimento

Execute os comandos dentro deste módulo:

```bash
npm ci
npm run dev
```

Para executar a aplicação Tauri em modo desktop:

```bash
npm run tauri:dev
```

Na primeira execução, compile os módulos `worker` e `observer`. Depois, use **Configurar serviços** na interface para gerar as units em `~/.config/systemd/user`.

## Validação e build

```bash
npm test                 # testes TypeScript
npm run validate:comments # comentários proibidos
npm run lint             # ESLint do frontend
npm run typecheck        # validação de tipos
npm run test:rust        # testes Rust
npm run build            # bundle web
npm run validate         # gate completo do módulo
npm run tauri:build      # AppImage e pacote .deb
```

Todos os scripts de validação também verificam UTF-8 nos arquivos do módulo.

## Operação dos serviços

O aplicativo usa somente estas units:

- `local-agent-worker.service`
- `local-agent-observer.service`

As units são supervisionadas pelo `systemd --user`, configuradas para reiniciar após falhas e habilitadas para iniciar com a sessão do usuário. As APIs dos serviços devem permanecer vinculadas a `127.0.0.1`.

## Segurança

- Não existe comando genérico para executar shell, binários ou caminhos vindos da interface.
- Identificadores de serviço, units e ações são allowlists fixos no backend Rust.
- Variáveis de ambiente, tokens, conteúdo de `.env` e caminhos sensíveis não são enviados ao frontend.
- A ação **Parar todos** exige confirmação explícita.
