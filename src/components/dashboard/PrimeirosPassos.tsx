/**
 * "Primeiros passos" do dono que acabou de entrar no teste.
 *
 * O painel de uma barbearia nova abria zerado e nao dizia o que fazer. O dono
 * divulgava o link antes de cadastrar servico ou horario, e o cliente abria
 * uma agenda vazia. Aqui ficam os passos na ordem em que o link passa a
 * funcionar, cada um com o botao que leva a tela certa.
 *
 * O estado de cada passo vem do backend (o que ja esta salvo). So "atendo
 * sozinho" fica no aparelho: nao ha dado que diga que a barbearia e de um
 * barbeiro so.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import { companyService } from '@/services/company';

type Passos = {
  horario: boolean;
  servicos: boolean;
  barbeiros: boolean;
  fotos: boolean;
  link_divulgado: boolean;
};

const SOZINHO_KEY = 'ibarber_atendo_sozinho';

const lerSozinho = () => {
  try {
    return localStorage.getItem(SOZINHO_KEY) === '1';
  } catch (_error) {
    return false;
  }
};

export const PrimeirosPassos: React.FC = () => {
  const [passos, setPassos] = useState<Passos | null>(null);
  const [sozinho, setSozinho] = useState(lerSozinho);

  useEffect(() => {
    companyService
      .getPrimeirosPassos()
      .then((dados: Passos) => setPassos(dados))
      // Ajuda, nao bloqueio: sem resposta o painel segue sem o cartao.
      .catch(() => setPassos(null));
  }, []);

  if (!passos) return null;

  const marcarSozinho = () => {
    try {
      localStorage.setItem(SOZINHO_KEY, '1');
    } catch (_error) {
      // Modo privado: o passo volta na proxima abertura, nada alem disso.
    }
    setSozinho(true);
  };

  const itens = [
    {
      feito: passos.horario,
      titulo: 'Defina o horário de funcionamento',
      texto: 'É dele que saem os horários livres que o cliente vê.',
      para: '/empresa/configuracoes',
      acao: 'Definir horário',
    },
    {
      feito: passos.servicos,
      titulo: 'Cadastre seus serviços',
      texto: 'Corte, barba, sobrancelha: com preço e quanto tempo leva.',
      para: '/empresa/servicos',
      acao: 'Cadastrar serviços',
    },
    {
      feito: passos.barbeiros || sozinho,
      titulo: 'Convide seus barbeiros',
      texto: 'Cada um entra com a própria conta e vê só a agenda dele.',
      para: '/empresa/equipe',
      acao: 'Convidar',
      extra: !passos.barbeiros && !sozinho && (
        <button type="button" onClick={marcarSozinho} className="text-xs text-muted-foreground underline">
          Atendo sozinho
        </button>
      ),
    },
    {
      feito: passos.fotos,
      titulo: 'Coloque a foto de quem atende',
      texto: 'O cliente escolhe o barbeiro pela foto. Sem foto, aparecem só as iniciais.',
      // A do dono fica no perfil; a dos barbeiros, na tela da equipe.
      para: passos.barbeiros ? '/empresa/equipe' : '/empresa/configuracoes',
      acao: 'Adicionar foto',
    },
    {
      feito: passos.link_divulgado,
      titulo: 'Divulgue seu link de agendamento',
      texto: 'Copie o link no cartão logo abaixo e ponha na bio do Instagram e no WhatsApp. Este passo se conclui sozinho no primeiro agendamento.',
      para: null,
      acao: null,
    },
  ];

  const feitos = itens.filter((item) => item.feito).length;
  if (feitos === itens.length) return null;
  // O primeiro que falta e o que ganha o botao: um caminho so, na ordem.
  const proximo = itens.findIndex((item) => !item.feito);

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Primeiros passos</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {feitos} de {itens.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(feitos / itens.length) * 100}%` }} />
      </div>
      <ol className="mt-4 space-y-3">
        {itens.map((item, indice) => (
          <li key={item.titulo} className="flex gap-3">
            {item.feito ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" />
            )}
            <div className="min-w-0 flex-1">
              <p className={item.feito ? 'text-sm text-muted-foreground line-through' : 'text-sm font-medium'}>
                {item.titulo}
              </p>
              {indice === proximo ? (
                <>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.texto}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {item.para && item.acao ? (
                      <Link
                        to={item.para}
                        className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                      >
                        {item.acao}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                    {item.extra || null}
                  </div>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
