/**
 * Landing do iBarber — o que abre em "/".
 *
 * O app (redirecionamento por perfil) mora em /app. A landing tem paleta
 * propria: sobrescreve --primary aqui no container para nao herdar o tema da
 * ultima barbearia aberta neste navegador.
 */
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  ChevronDown,
  Crown,
  EyeOff,
  Gift,
  Link2,
  Receipt,
  Repeat,
  Smartphone,
  Star,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

const WHATSAPP = '5512991015266';
const EMAIL = 'davisnaider06@gmail.com';
const linkWhatsApp = (texto: string) =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
const CTA_TEXTO = 'Oi! Tenho uma barbearia e quero conhecer o iBarber.';

const paleta = {
  '--primary': '38 92% 50%',
  '--primary-foreground': '24 10% 10%',
} as React.CSSProperties;

const aparecer = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Secao: React.FC<{ id?: string; className?: string; children: React.ReactNode }> = ({
  id,
  className,
  children,
}) => (
  <motion.section
    id={id}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: '-80px' }}
    variants={aparecer}
    className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}
  >
    {children}
  </motion.section>
);

const Estrelas: React.FC<{ nota: number; className?: string }> = ({ nota, className }) => (
  <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${nota} de 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={cn('h-3.5 w-3.5', i <= Math.round(nota) ? 'fill-amber-400 text-amber-400' : 'text-stone-300')}
      />
    ))}
  </span>
);

/** Celular desenhado em HTML: a escolha do barbeiro no link da barbearia. */
const CelularAgendamento: React.FC = () => {
  const barbeiros = [
    { nome: 'Rafael', nota: 4.9, avaliacoes: 128, cor: 'bg-amber-200' },
    { nome: 'Diego', nota: 4.8, avaliacoes: 96, cor: 'bg-stone-300' },
    { nome: 'Lucas', nota: 4.6, avaliacoes: 41, cor: 'bg-orange-200' },
  ];
  return (
    <div className="relative mx-auto w-[270px] rounded-[2.5rem] border-[10px] border-stone-900 bg-white shadow-2xl shadow-stone-900/30">
      <div className="absolute left-1/2 top-0 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-stone-900" />
      <div className="space-y-3 px-4 pb-6 pt-8">
        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">Passo 2 de 4</p>
        <p className="text-lg font-bold leading-tight text-stone-900">Com quem você quer cortar?</p>
        {barbeiros.map((b, i) => (
          <div
            key={b.nome}
            className={cn(
              'flex items-center gap-3 rounded-2xl border p-3',
              i === 0 ? 'border-amber-400 bg-amber-50' : 'border-stone-200',
            )}
          >
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-full font-semibold text-stone-700', b.cor)}>
              {b.nome[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900">{b.nome}</p>
              <div className="flex items-center gap-1.5">
                <Estrelas nota={b.nota} />
                <span className="text-[11px] text-stone-500">
                  {b.nota.toFixed(1)} · {b.avaliacoes}
                </span>
              </div>
            </div>
            {i === 0 && <Crown className="h-4 w-4 text-amber-500" />}
          </div>
        ))}
        <div className="rounded-2xl bg-stone-900 py-3 text-center text-sm font-semibold text-white">
          Escolher horário
        </div>
      </div>
    </div>
  );
};

const recursos = [
  {
    icon: Link2,
    titulo: 'Link de agendamento próprio',
    texto: 'Cada barbearia tem o seu link. O cliente escolhe serviço, barbeiro e horário pelo celular, sem baixar nada.',
  },
  {
    icon: Star,
    titulo: 'Avaliação anônima',
    texto: 'Depois do corte o cliente dá a nota. Você descobre quem são os melhores barbeiros da casa.',
    destaque: true,
  },
  {
    icon: Wallet,
    titulo: 'Caixa e PDV',
    texto: 'Abre o caixa, lança corte, produto e pagamento. Fecha o dia sabendo quanto entrou.',
  },
  {
    icon: Receipt,
    titulo: 'Comissões no automático',
    texto: 'Percentual por serviço e por produto. Cada barbeiro vê a própria comissão, sem planilha.',
  },
  {
    icon: Repeat,
    titulo: 'Planos e mensalidades',
    texto: 'Venda pacotes de cortes por mês. O sistema controla quantos ainda restam para cada cliente.',
  },
  {
    icon: Gift,
    titulo: 'Fidelidade',
    texto: 'Pontos por visita para o cliente voltar. As regras quem define é você.',
  },
  {
    icon: Users,
    titulo: 'Equipe com permissões',
    texto: 'O dono vê tudo. O barbeiro vê a agenda, os clientes e a comissão dele.',
  },
  {
    icon: Smartphone,
    titulo: 'App no celular',
    texto: 'Instala direto do navegador, no Android e no iPhone. Abre como app, com notificação.',
  },
];

const perguntas = [
  {
    p: 'Meu cliente precisa baixar algum app?',
    r: 'Não. Ele abre o link da sua barbearia, escolhe o horário e só cria a conta no final, para confirmar. Se quiser, instala como app pelo navegador.',
  },
  {
    p: 'A avaliação é anônima mesmo?',
    r: 'Para o barbeiro, sim: ele vê a própria nota e os comentários, sem saber quem avaliou. O dono vê quem foi, para conseguir chamar o cliente que saiu insatisfeito.',
  },
  {
    p: 'O barbeiro vê a nota dos colegas?',
    r: 'Não. Na conta dele aparece só a nota dele. O ranking completo fica com o dono.',
  },
  {
    p: 'Funciona com mais de uma unidade?',
    r: 'Cada unidade é uma barbearia no iBarber, com link, equipe e caixa próprios.',
  },
  {
    p: 'Quanto custa?',
    r: 'Depende do tamanho da equipe. Chama a gente no WhatsApp que a gente monta a proposta e mostra o sistema funcionando.',
  },
];

// Quem instalou o app antes da landing tem start_url "/" guardado no celular.
const abertoComoApp = () => {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch (_error) {
    return false;
  }
};

const Landing: React.FC = () => {
  if (abertoComoApp()) return <Navigate to="/app" replace />;
  return <Pagina />;
};

const Pagina: React.FC = () => (
  <div style={paleta} className="min-h-screen overflow-x-hidden bg-stone-50 text-stone-900">
    {/* Topo */}
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-stone-50/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="iBarber, início">
          <Logo size="md" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex">
          <a href="#recursos" className="hover:text-stone-900">Recursos</a>
          <a href="#avaliacoes" className="hover:text-stone-900">Avaliações</a>
          <a href="#como-funciona" className="hover:text-stone-900">Como funciona</a>
          <a href="#duvidas" className="hover:text-stone-900">Dúvidas</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/entrar"
            className="rounded-full px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200/60"
          >
            Entrar
          </Link>
          <a
            href={linkWhatsApp(CTA_TEXTO)}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 sm:inline-flex"
          >
            Quero o iBarber
          </a>
        </div>
      </div>
    </header>

    <main>
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <motion.div initial="hidden" animate="visible" variants={aparecer}>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100/70 px-3 py-1 text-xs font-semibold text-amber-800">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            Novo: avaliação anônima dos barbeiros
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Agenda cheia, caixa fechado e a nota de cada barbeiro.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-stone-600">
            O iBarber é o sistema da barbearia: agendamento online com link próprio, caixa,
            comissões, planos e avaliações dos clientes. Tudo no celular.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={linkWhatsApp(CTA_TEXTO)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3.5 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
            >
              Quero conhecer
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#recursos"
              className="inline-flex items-center justify-center rounded-full border border-stone-300 px-6 py-3.5 text-base font-semibold text-stone-800 hover:bg-white"
            >
              Ver o que tem
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600">
            {['Cliente agenda sem baixar app', 'Funciona no celular', 'Feito só para barbearia'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-amber-600" />
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative"
        >
          <div className="absolute inset-0 -z-10 mx-auto h-full max-w-sm rounded-full bg-amber-300/40 blur-3xl" />
          <CelularAgendamento />
        </motion.div>
      </section>

      {/* Recursos */}
      <Secao id="recursos" className="py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Recursos</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Do agendamento ao fechamento do caixa.
          </h2>
          <p className="mt-3 text-stone-600">
            Tudo que acontece na barbearia num lugar só, para o dono, para o barbeiro e para o cliente.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recursos.map(({ icon: Icone, titulo, texto, destaque }) => (
            <div
              key={titulo}
              className={cn(
                'rounded-2xl border p-5',
                destaque ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  destaque ? 'bg-amber-500 text-stone-950' : 'bg-amber-100 text-amber-700',
                )}
              >
                <Icone className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{titulo}</h3>
              <p className={cn('mt-1.5 text-sm', destaque ? 'text-stone-300' : 'text-stone-600')}>{texto}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/* Avaliacoes */}
      <section id="avaliacoes" className="bg-stone-900 py-20 text-white">
        <Secao className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Avaliações</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Igual Uber e 99, só que para o seu barbeiro.
            </h2>
            <p className="mt-4 text-stone-300">
              Terminou o atendimento, o cliente recebe o pedido de avaliação e dá de 1 a 5 estrelas.
              Sem constrangimento, porque o barbeiro não sabe quem avaliou.
            </p>
            <ul className="mt-8 space-y-5">
              {[
                {
                  icon: EyeOff,
                  t: 'Anônima para o barbeiro',
                  d: 'Ele vê a própria nota e os comentários, sem saber de quem são.',
                },
                {
                  icon: Trophy,
                  t: 'Ranking para o dono',
                  d: 'Quem são os melhores da casa, a média de cada um e quem avaliou cada atendimento.',
                },
                {
                  icon: CalendarCheck,
                  t: 'Estrelas na hora de agendar',
                  d: 'O cliente vê a nota de cada barbeiro antes de escolher com quem cortar.',
                },
              ].map(({ icon: Icone, t, d }) => (
                <li key={t} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-400">
                    <Icone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{t}</p>
                    <p className="text-sm text-stone-400">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Ranking de exemplo, como o dono ve */}
          <div className="rounded-3xl bg-white p-6 text-stone-900 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Melhores barbeiros do mês</p>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-500">Visão do dono</span>
            </div>
            <ol className="mt-5 space-y-3">
              {[
                { nome: 'Rafael', nota: 4.9, qtd: 128 },
                { nome: 'Diego', nota: 4.8, qtd: 96 },
                { nome: 'Lucas', nota: 4.6, qtd: 41 },
                { nome: 'Bruno', nota: 4.2, qtd: 37 },
              ].map((b, i) => (
                <li key={b.nome} className="flex items-center gap-3 rounded-2xl border border-stone-100 p-3">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                      i === 0 ? 'bg-amber-400 text-stone-950' : 'bg-stone-100 text-stone-500',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium">{b.nome}</span>
                  <Estrelas nota={b.nota} />
                  <span className="w-20 text-right text-sm tabular-nums text-stone-500">
                    {b.nota.toFixed(1)} · {b.qtd}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm">
              <p className="font-medium text-stone-800">"Corte ficou perfeito, voltei pela terceira vez."</p>
              <p className="mt-1 text-stone-500">Rafael · 5 estrelas · ontem</p>
            </div>
          </div>
        </Secao>
      </section>

      {/* Como funciona */}
      <Secao id="como-funciona" className="py-20">
        <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Como funciona</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Em três passos.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              n: '1',
              t: 'A gente monta sua barbearia',
              d: 'Serviços, preços, equipe e horários. Você recebe o acesso do dono e cada barbeiro recebe o dele.',
            },
            {
              n: '2',
              t: 'Você divulga o seu link',
              d: 'Manda no WhatsApp, coloca na bio do Instagram. O link é da sua barbearia, com o seu nome.',
            },
            {
              n: '3',
              t: 'O cliente agenda e avalia',
              d: 'O horário cai na agenda do barbeiro e na sua. Depois do corte, vem a avaliação.',
            },
          ].map((p) => (
            <div key={p.n} className="rounded-2xl border border-stone-200 bg-white p-6">
              <span className="text-4xl font-extrabold text-amber-500">{p.n}</span>
              <h3 className="mt-3 text-lg font-semibold">{p.t}</h3>
              <p className="mt-1.5 text-sm text-stone-600">{p.d}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/* Duvidas */}
      <Secao id="duvidas" className="pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Dúvidas</h2>
          <div className="mt-8 space-y-3">
            {perguntas.map(({ p, r }) => (
              <details key={p} className="group rounded-2xl border border-stone-200 bg-white p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {p}
                  <ChevronDown className="h-5 w-5 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-stone-600">{r}</p>
              </details>
            ))}
          </div>
        </div>
      </Secao>

      {/* Chamada final */}
      <Secao className="pb-20">
        <div className="rounded-3xl bg-amber-500 px-6 py-12 text-center text-stone-950 sm:px-12">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Bora organizar essa barbearia?</h2>
          <p className="mx-auto mt-3 max-w-xl text-stone-800">
            Chama no WhatsApp. A gente mostra o iBarber funcionando e monta tudo para você.
          </p>
          <p className="mt-2 text-sm text-stone-800">
            (12) 99101-5266 ·{' '}
            <a href={`mailto:${EMAIL}`} className="underline underline-offset-2">
              {EMAIL}
            </a>
          </p>
          <a
            href={linkWhatsApp(CTA_TEXTO)}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-stone-950 px-6 py-3.5 font-semibold text-white hover:bg-stone-800"
          >
            Falar no WhatsApp
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </Secao>
    </main>

    <footer className="border-t border-stone-200">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-stone-500 sm:flex-row sm:px-6">
        <Logo size="sm" />
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link to="/entrar" className="hover:text-stone-900">Entrar</Link>
          <a href={linkWhatsApp(CTA_TEXTO)} target="_blank" rel="noreferrer" className="hover:text-stone-900">
            WhatsApp (12) 99101-5266
          </a>
          <a href={`mailto:${EMAIL}`} className="hover:text-stone-900">{EMAIL}</a>
        </div>
        <p>© {new Date().getFullYear()} iBarber</p>
      </div>
    </footer>
  </div>
);

export default Landing;
