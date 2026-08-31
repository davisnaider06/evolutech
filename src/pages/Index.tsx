/**
 * Porta de entrada da aplicacao — e o `start_url` do PWA.
 *
 * Antes esta tela decidia sozinha, olhando so o `isAuthenticated`. Como o
 * AuthProvider comeca deslogado e so restaura a sessao dentro do efeito, o
 * primeiro render SEMPRE via `false` e mandava para /login com `replace`.
 * Milissegundos depois a sessao voltava, mas o usuario ja estava parado no
 * formulario — era isso que fazia pedir login a cada abertura do app.
 *
 * O RoleRedirect ja espera o `isLoading` antes de decidir, entao a entrada
 * agora e so ele.
 */
import React from 'react';
import { RoleRedirect } from '@/components/guards/RoleRedirect';

const Index: React.FC = () => <RoleRedirect />;

export default Index;
