import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Check, 
  ChevronDown,
  Clock, 
  BarChart3, 
  ShoppingCart, 
  Users, 
  Smartphone,
  Palette,
  Shield,
  Headphones,
  Zap,
  Building2,
  GraduationCap,
  Utensils,
  Dumbbell,
  Calendar,
  Store,
  Home,
  Briefcase,
  Church,
  Wrench,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Import images
import heroDashboard from '@/assets/landing/hero-dashboard.jpg';
import mobileApp from '@/assets/landing/mobile-app.jpg';
import teamTech from '@/assets/landing/team-tech.jpg';
import whiteLabel from '@/assets/landing/white-label.jpg';

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const templates = [
  { icon: Calendar, name: 'Agendamentos', desc: 'Clínicas, salões, consultórios' },
  { icon: Dumbbell, name: 'Academias', desc: 'Gestão de alunos e treinos' },
  { icon: GraduationCap, name: 'Cursos / Educação', desc: 'EAD e escolas presenciais' },
  { icon: Utensils, name: 'Restaurantes', desc: 'Delivery e atendimento local' },
  { icon: ShoppingCart, name: 'Supermercados', desc: 'PDV, estoque e vendas' },
  { icon: Store, name: 'Lojas / Varejo', desc: 'Comércio e e-commerce' },
  { icon: Wrench, name: 'Prestadores', desc: 'Serviços técnicos e manutenção' },
  { icon: Home, name: 'Imobiliárias', desc: 'Gestão de imóveis e contratos' },
  { icon: Briefcase, name: 'Escritórios', desc: 'Contabilidade e advocacia' },
  { icon: Church, name: 'Igrejas', desc: 'Gestão de membros e eventos' },
];

const plans = [
  {
    name: 'Básico',
    price: 'R$ 197',
    period: '/mês',
    features: [
      'Sistema Web completo',
      'PWA instalável',
      '3 usuários inclusos',
      'Suporte por e-mail',
      'Atualizações incluídas',
    ],
    highlight: false,
  },
  {
    name: 'Profissional',
    price: 'R$ 397',
    period: '/mês',
    features: [
      'Tudo do Básico +',
      '10 usuários inclusos',
      'App Android nativo',
      'Suporte prioritário',
      'Integrações avançadas',
      'Relatórios personalizados',
    ],
    highlight: true,
  },
  {
    name: 'Avançado',
    price: 'R$ 697',
    period: '/mês',
    features: [
      'Tudo do Profissional +',
      'Usuários ilimitados',
      'App iOS + Android',
      'Suporte 24/7',
      'API completa',
      'Consultoria mensal',
      'SLA garantido',
    ],
    highlight: false,
  },
];

const LandingVendas = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openWhatsApp = () => {
    window.open('https://wa.me/5500000000000?text=Olá! Gostaria de saber mais sobre os sistemas da Evolutech.', '_blank');
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Floating WhatsApp Button */}
      <button
        onClick={openWhatsApp}
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 animate-pulse-glow"
        aria-label="WhatsApp"
      >
        <MessageCircle className="w-7 h-7" />
      </button>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-border/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-gradient">Evolutech Digital</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#templates" className="text-muted-foreground hover:text-foreground transition-colors">Templates</a>
            <a href="#como-funciona" className="text-muted-foreground hover:text-foreground transition-colors">Como Funciona</a>
            <a href="#planos" className="text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <Link to="/login">
              <Button variant="outline" size="sm">Área do Cliente</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 gradient-dark" />
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${heroDashboard})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `translateY(${scrollY * 0.3}px)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[150px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center max-w-5xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-accent mb-8">
                <Zap className="w-4 h-4" />
                Fábrica de Sistemas e Aplicativos
              </span>
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
            >
              A Evolutech cria o{' '}
              <span className="text-gradient">sistema e o aplicativo</span>{' '}
              da sua empresa.
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto"
            >
              Sistemas por nicho + módulos personalizados + white label + PWA + app nativo.
              <br />
              <strong className="text-foreground">Tudo com a sua marca.</strong>
            </motion.p>
            
            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button 
                size="lg" 
                className="gradient-primary text-lg px-8 py-6 shadow-glow hover:scale-105 transition-transform"
                onClick={openWhatsApp}
              >
                Quero um sistema para minha empresa
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-6 hover:scale-105 transition-transform"
                onClick={() => document.getElementById('templates')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Ver templates disponíveis
                <ChevronDown className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-muted-foreground" />
        </div>
      </section>

      {/* ========== PROVA DE VALOR ========== */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {[
              { icon: Clock, title: 'Menos tempo no operacional', desc: 'Automatize processos repetitivos' },
              { icon: BarChart3, title: 'Mais controle e gestão', desc: 'Dashboards e relatórios em tempo real' },
              { icon: ShoppingCart, title: 'Aumento de vendas', desc: 'Organize e venda mais com eficiência' },
              { icon: Smartphone, title: 'App da sua empresa', desc: 'Sistema + PWA + App no celular' },
            ].map((item, i) => (
              <motion.div key={i} variants={fadeInUp}>
                <Card className="glass border-border/30 hover:border-primary/50 transition-all hover:-translate-y-2 h-full">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                      <item.icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== COMO FUNCIONA ========== */}
      <section id="como-funciona" className="py-24 relative">
        <div className="absolute inset-0 gradient-glow opacity-50" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Como <span className="text-gradient">funciona</span>
            </h2>
            <p className="text-xl text-muted-foreground">3 passos simples para ter seu sistema</p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              { step: '1', title: 'Escolha o Nicho', desc: 'Selecione o template pronto para seu segmento de negócio' },
              { step: '2', title: 'Ative os Módulos', desc: 'Personalize as funcionalidades conforme sua necessidade' },
              { step: '3', title: 'Pronto para Usar', desc: 'Receba seu sistema + PWA + App com sua marca' },
            ].map((item, i) => (
              <motion.div key={i} variants={fadeInUp} className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full gradient-primary flex items-center justify-center shadow-glow text-3xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== TEMPLATES POR NICHO ========== */}
      <section id="templates" className="py-24 relative bg-card/30">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Templates <span className="text-gradient">por Nicho</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Sistemas prontos por nicho. Personalizados para a sua empresa.
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {templates.map((template, i) => (
              <motion.div key={i} variants={fadeInUp}>
                <Card className="glass border-border/30 hover:border-accent/50 transition-all hover:-translate-y-2 cursor-pointer group">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                      <template.icon className="w-7 h-7 text-accent" />
                    </div>
                    <h3 className="font-semibold mb-1">{template.name}</h3>
                    <p className="text-xs text-muted-foreground">{template.desc}</p>
                    <Button variant="ghost" size="sm" className="mt-3 text-accent hover:text-accent">
                      Ver demo
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== DEMONSTRAÇÃO VISUAL ========== */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Seu processo organizado,{' '}
                <span className="text-gradient">sua equipe mais rápida.</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Dashboards intuitivos, relatórios em tempo real e fluxos de trabalho 
                otimizados para sua operação do dia a dia.
              </p>
              <ul className="space-y-4">
                {['Dashboards personalizados', 'Relatórios em tempo real', 'Controle de equipe', 'Gestão financeira'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeInUp} className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
              <img 
                src={teamTech} 
                alt="Equipe usando sistema" 
                className="relative rounded-2xl shadow-elevated w-full"
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========== WHITE LABEL ========== */}
      <section className="py-24 relative bg-card/30">
        <div className="container mx-auto px-4">
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="order-2 lg:order-1 relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-primary/20 rounded-3xl blur-2xl" />
              <img 
                src={whiteLabel} 
                alt="Personalização White Label" 
                className="relative rounded-2xl shadow-elevated w-full"
              />
            </motion.div>
            <motion.div variants={fadeInUp} className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-accent mb-6">
                <Palette className="w-4 h-4" />
                White Label
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                A marca é do{' '}
                <span className="text-gradient">cliente</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Do sistema ao app, tudo com a sua marca. Sem menção à Evolutech para o seu cliente final.
              </p>
              <ul className="space-y-4">
                {['Logo personalizado', 'Cores da sua marca', 'Domínio próprio', 'App com seu nome'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-accent" />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========== PWA E APP NATIVO ========== */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-accent mb-6">
                <Smartphone className="w-4 h-4" />
                Mobile First
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                PWA + App Nativo,{' '}
                <span className="text-gradient">tudo integrado</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Sistema web responsivo, PWA instalável no celular e app nativo nas lojas.
                Tudo sincronizado em tempo real.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: 'Web', desc: 'Acesso em qualquer navegador' },
                  { title: 'PWA', desc: 'Instale como aplicativo' },
                  { title: 'App Nativo', desc: 'Nas lojas Google e Apple' },
                ].map((item, i) => (
                  <div key={i} className="glass p-4 rounded-xl text-center">
                    <h4 className="font-semibold text-accent mb-1">{item.title}</h4>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div variants={fadeInUp} className="relative flex justify-center">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
              <img 
                src={mobileApp} 
                alt="Aplicativo mobile" 
                className="relative rounded-2xl shadow-elevated max-w-sm"
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========== PLANOS ========== */}
      <section id="planos" className="py-24 relative bg-card/30">
        <div className="absolute inset-0 gradient-glow opacity-30" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Planos e <span className="text-gradient">Pacotes</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Escolha o plano ideal para sua empresa
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {plans.map((plan, i) => (
              <motion.div key={i} variants={fadeInUp}>
                <Card className={`h-full relative overflow-hidden ${
                  plan.highlight 
                    ? 'border-primary shadow-glow' 
                    : 'glass border-border/30'
                }`}>
                  {plan.highlight && (
                    <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
                  )}
                  <CardContent className="p-8">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-gradient">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-center gap-3">
                          <Check className="w-5 h-5 text-accent flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className={`w-full ${plan.highlight ? 'gradient-primary' : ''}`}
                      variant={plan.highlight ? 'default' : 'outline'}
                      onClick={openWhatsApp}
                    >
                      Solicitar este plano
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== QUEM SOMOS + GARANTIA ========== */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-accent mb-6">
                <Building2 className="w-4 h-4" />
                Sobre a Evolutech
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Sua parceira em{' '}
                <span className="text-gradient">transformação digital</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-12">
                Somos especialistas em criar sistemas e aplicativos personalizados para empresas 
                de todos os portes. Do planejamento à implantação, acompanhamos você em cada etapa.
              </p>
            </motion.div>

            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              variants={staggerContainer}
            >
              {[
                { icon: Users, title: 'Implantação Guiada', desc: 'Acompanhamento completo do início ao fim' },
                { icon: GraduationCap, title: 'Treinamento', desc: 'Sua equipe aprende a usar tudo' },
                { icon: Headphones, title: 'Suporte Contínuo', desc: 'Estamos sempre disponíveis para ajudar' },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeInUp}>
                  <Card className="glass border-border/30 h-full">
                    <CardContent className="p-6 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-secondary flex items-center justify-center">
                        <item.icon className="w-7 h-7 text-accent" />
                      </div>
                      <h3 className="font-semibold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========== CTA FINAL ========== */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-dark" />
        <div className="absolute inset-0 gradient-glow opacity-50" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <Shield className="w-16 h-16 mx-auto mb-6 text-accent" />
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Pronto para ter seu{' '}
                <span className="text-gradient">sistema profissional?</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-10">
                Fale com nossa equipe e descubra como podemos transformar seu negócio.
              </p>
            </motion.div>
            
            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button 
                size="lg" 
                className="gradient-primary text-lg px-8 py-6 shadow-glow hover:scale-105 transition-transform"
                onClick={openWhatsApp}
              >
                <MessageCircle className="mr-2 w-5 h-5" />
                Chamar no WhatsApp
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-6 hover:scale-105 transition-transform"
                onClick={openWhatsApp}
              >
                Solicitar orçamento
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-12 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-gradient">Evolutech Digital</span>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2024 Evolutech Digital. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingVendas;
