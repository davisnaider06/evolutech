import { useEffect } from 'react';

/**
 * Liga o tema vidro no <body> enquanto o layout logado estiver na tela.
 * Fica no body (e nao so no layout) para dialogos e menus, que abrem em
 * portal fora do layout, herdarem as mesmas cores. Ao sair (logout, tela do
 * cliente) a classe sai junto.
 */
export function useTemaVidro() {
  useEffect(() => {
    document.body.classList.add('tema-vidro');
    return () => document.body.classList.remove('tema-vidro');
  }, []);
}
