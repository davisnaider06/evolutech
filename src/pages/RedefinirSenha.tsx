import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { API_URL } from '@/config/api';

/**
 * Uma tela para os quatro casos: equipe ou cliente, pedindo o link ou
 * criando a senha nova. Sem `?token=` na URL e o pedido; com token, e a
 * troca. O link chega por e-mail ou, para o cliente sem e-mail, pelo
 * WhatsApp da barbearia.
 */
type Tipo = 'equipe' | 'cliente';

const SENHA_MINIMA = 6;

const postar = async (caminho: string, corpo: Record<string, unknown>) => {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.error || 'Não foi possível concluir agora. Tente de novo.');
  return dados;
};

const RedefinirSenha: React.FC<{ tipo: Tipo }> = ({ tipo }) => {
  const { slug = '' } = useParams<{ slug?: string }>();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);

  const rotaLogin = tipo === 'equipe' ? '/login' : slug ? `/cliente/${slug}/login` : '/cliente/login';
  const base = tipo === 'equipe' ? '/auth' : '/customer-auth';

  const pedirLink = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await postar(
        `${base}/forgot-password`,
        tipo === 'equipe' ? { email: identificador } : { company_slug: slug, identifier: identificador }
      );
      setPronto(true);
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setEnviando(false);
    }
  };

  const trocarSenha = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro('');
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.');
      return;
    }
    setEnviando(true);
    try {
      await postar(`${base}/reset-password`, { token, password: senha });
      setPronto(true);
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setEnviando(false);
    }
  };

  const caixaDeErro = erro ? (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {erro}
    </div>
  ) : null;

  let conteudo: React.ReactNode;
  if (token && pronto) {
    conteudo = (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <p>Senha nova criada. Já pode entrar com ela.</p>
        <Button asChild className="w-full">
          <Link to={rotaLogin}>Entrar</Link>
        </Button>
      </div>
    );
  } else if (token) {
    conteudo = (
      <form className="space-y-4" onSubmit={trocarSenha}>
        {caixaDeErro}
        <div className="space-y-2">
          <Label htmlFor="nova-senha">Nova senha</Label>
          <Input
            id="nova-senha"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Pelo menos {SENHA_MINIMA} caracteres.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmar-senha">Repita a nova senha</Label>
          <Input
            id="confirmar-senha"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
          />
        </div>
        <Button className="w-full" type="submit" disabled={enviando}>
          {enviando ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
      </form>
    );
  } else if (pronto) {
    // Mesma mensagem exista ou nao a conta: a tela nao confirma quem tem
    // cadastro.
    conteudo = (
      <div className="space-y-3 text-sm">
        <p>
          Se encontrarmos uma conta com esse {tipo === 'equipe' ? 'e-mail' : 'contato'}, enviamos um link para o
          e-mail cadastrado. Ele vale por 1 hora.
        </p>
        <p className="text-muted-foreground">Não chegou? Confira a caixa de spam.</p>
        {tipo === 'cliente' && (
          <p className="text-muted-foreground">
            Cadastrou só com WhatsApp? Peça à barbearia o link para criar uma nova senha.
          </p>
        )}
        {tipo === 'equipe' && (
          <p className="text-muted-foreground">
            Sem acesso ao e-mail? O dono da empresa pode trocar sua senha em Equipe.
          </p>
        )}
      </div>
    );
  } else {
    conteudo = (
      <form className="space-y-4" onSubmit={pedirLink}>
        {caixaDeErro}
        <div className="space-y-2">
          <Label htmlFor="identificador">{tipo === 'equipe' ? 'E-mail' : 'WhatsApp ou e-mail'}</Label>
          <Input
            id="identificador"
            type={tipo === 'equipe' ? 'email' : 'text'}
            autoComplete={tipo === 'equipe' ? 'email' : 'username'}
            placeholder={tipo === 'equipe' ? 'voce@suaempresa.com' : '(11) 91234-5678 ou voce@email.com'}
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            required
          />
        </div>
        <Button className="w-full" type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar link'}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {token ? 'Criar nova senha' : 'Esqueci minha senha'}
          </CardTitle>
          {!token && !pronto && (
            <CardDescription>
              {tipo === 'equipe'
                ? 'Informe seu e-mail de acesso. Vamos mandar um link para criar uma senha nova.'
                : 'Informe o WhatsApp ou o e-mail do seu cadastro. Vamos mandar um link para o seu e-mail.'}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {conteudo}
          {!(token && pronto) && (
            <p className="mt-6 text-sm">
              <Link className="text-primary underline" to={rotaLogin}>
                Voltar para o login
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RedefinirSenha;
