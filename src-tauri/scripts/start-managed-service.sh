#!/usr/bin/env bash
set -euo pipefail

MODULE_DIR=${1:?Uso: $0 <diretorio-do-modulo>}
NODE_VERSION_FILE="$MODULE_DIR/.nvmrc"

find_nvm_sh() {
  home_dir=${HOME:-}
  if [ -z "$home_dir" ]; then
    home_dir=$(getent passwd "$(id -u)" 2>/dev/null | awk -F: 'NR == 1 { print $6 }')
  fi
  nvm_dir=${NVM_DIR:-${home_dir:-}/.nvm}

  for candidate in "$nvm_dir/nvm.sh" "${home_dir:-}/.nvm/nvm.sh" /usr/share/nvm/nvm.sh; do
    if [ -s "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

if [ ! -d "$MODULE_DIR" ]; then
  printf 'Erro: diretório do módulo não encontrado: %s.\n' "$MODULE_DIR" >&2
  exit 1
fi

if [ ! -f "$NODE_VERSION_FILE" ]; then
  printf 'Erro: arquivo .nvmrc ausente em %s.\n' "$MODULE_DIR" >&2
  exit 1
fi

unset npm_config_prefix npm_config_global_prefix NPM_CONFIG_PREFIX NPM_CONFIG_GLOBAL_PREFIX

nvm_sh=$(find_nvm_sh) || {
  printf 'Erro: nvm não encontrado. Instale o nvm para iniciar este serviço.\n' >&2
  exit 1
}

# shellcheck disable=SC1090
set +u
. "$nvm_sh"
set -u

node_version=$(cat "$NODE_VERSION_FILE")
nvm use "$node_version" >/dev/null

cd "$MODULE_DIR"
echo "Usando Node $(node -v) via nvm."
exec npm start
