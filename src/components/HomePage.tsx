import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import rpmLogo from '@/assets/rpm-go-tranparent.png'
import {
  House, Buildings, Users, CurrencyCircleDollar, CalendarBlank, ChartBar,
  FileText, Wrench, CheckCircle, ArrowRight, Globe, Star, ShieldCheck,
  Rocket, Lightning, Handshake, IdentificationCard, Bell, Lock,
  CaretDown, ClipboardText, FolderOpen, Bug, ClockCounterClockwise,
  UserFocus, PushPin,
} from '@phosphor-icons/react'

interface HomePageProps {
  onLoginClick: () => void
}

const content = {
  pt: {
    nav: {
      features: 'Recursos',
      latest: 'Novidades',
      howItWorks: 'Como funciona',
      pricing: 'Planos',
      login: 'Entrar',
      cta: 'Começar grátis',
    },
    hero: {
      badge: 'Gestão de Aluguel Simplificada',
      title: 'Gerencie seus imóveis com',
      titleHighlight: 'inteligência e praticidade',
      subtitle: 'Do cadastro de hóspedes à geração de contratos, vistorias digitais, documentos, auditoria e controle financeiro avançado — tudo em um só lugar.',
      cta: 'Começar gratuitamente',
      demo: 'Ver demonstração',
      stats: [
        { value: '360°', label: 'Gestão integrada' },
        { value: '24/7', label: 'Dados organizados' },
        { value: '3×', label: 'Mais produtividade' },
      ],
    },
    features: {
      title: 'Tudo que você precisa para',
      titleHighlight: 'gerenciar seus imóveis',
      subtitle: 'Uma plataforma completa para simplificar cada etapa da gestão de propriedades.',
      items: [
        {
          icon: Buildings,
          title: 'Portfólio de Imóveis',
          description: 'Cadastre quartos, apartamentos e casas com ambientes, mobiliário, itens de vistoria e status operacional.',
        },
        {
          icon: Users,
          title: 'Gestão de Hóspedes',
          description: 'Cadastro completo com documentos, histórico de contratos e informações pessoais.',
        },
        {
          icon: FileText,
          title: 'Contratos Inteligentes',
          description: 'Templates customizáveis com variáveis automáticas. Gere PDFs profissionais em segundos.',
        },
        {
          icon: CurrencyCircleDollar,
          title: 'Controle Financeiro',
          description: 'Receitas, despesas e filtros por mês, contrato, hóspede, proprietário, propriedade, categoria e prestador.',
        },
        {
          icon: CalendarBlank,
          title: 'Calendário de Reservas',
          description: 'Visualize ocupações, vencimentos e compromissos em um calendário interativo.',
        },
        {
          icon: ChartBar,
          title: 'Relatórios Detalhados',
          description: 'Análises de desempenho, taxa de ocupação, receita por imóvel e muito mais.',
        },
        {
          icon: Wrench,
          title: 'Prestadores de Serviço',
          description: 'Gerencie contatos de manutenção, limpeza e reparos vinculados a cada imóvel.',
        },
        {
          icon: ShieldCheck,
          title: 'Multi-usuário',
          description: 'Convide sua equipe, defina permissões por perfil e colabore com segurança.',
        },
        {
          icon: ClipboardText,
          title: 'Vistoria Digital',
          description: 'Registre vistorias por ambiente, compare diferenças e gere tarefas a partir de problemas encontrados.',
        },
        {
          icon: FolderOpen,
          title: 'Central de Documentos',
          description: 'Envie, visualize, baixe e organize documentos por propriedade, contrato, hóspede, proprietário ou geral.',
        },
        {
          icon: ClockCounterClockwise,
          title: 'Auditoria e Presença',
          description: 'Acompanhe login, logout, criações, alterações, exclusões e usuários online em tempo quase real.',
        },
        {
          icon: Bug,
          title: 'Reporte de Bugs',
          description: 'Usuários reportam problemas com descrição, tela, registro e print colado do clipboard.',
        },
      ],
    },
    latest: {
      title: 'Novas ferramentas para operação profissional',
      subtitle: 'Funcionalidades pensadas para reduzir retrabalho, aumentar rastreabilidade e dar mais controle ao administrador.',
      items: [
        {
          icon: ClipboardText,
          title: 'Vistorias vinculadas',
          description: 'Entrada, periódica, manutenção e saída podem ser acompanhadas em cards relacionados, comparando diferenças entre vistorias.',
        },
        {
          icon: FolderOpen,
          title: 'Documentos com storage',
          description: 'Upload, download, preview, colar do clipboard e drag and drop com vínculos e filtros por entidade.',
        },
        {
          icon: UserFocus,
          title: 'Usuários online',
          description: 'Veja quem está acessando, tela atual, atividade, horário, IP, browser e hostname dentro do tenant.',
        },
        {
          icon: PushPin,
          title: 'Menu personalizável',
          description: 'Fixe itens no sidebar, reorganize por drag and drop e mantenha a preferência salva por usuário.',
        },
      ],
    },
    howItWorks: {
      title: 'Como funciona',
      subtitle: 'Comece em minutos, não em semanas.',
      steps: [
        {
          number: '01',
          title: 'Crie sua conta',
          description: 'Cadastre-se com e-mail e senha ou Google. Configure o nome da sua empresa e está pronto.',
        },
        {
          number: '02',
          title: 'Cadastre seus imóveis',
          description: 'Adicione propriedades, proprietários, hóspedes, ambientes, mobília e itens de vistoria.',
        },
        {
          number: '03',
          title: 'Gerencie tudo em um lugar',
          description: 'Contratos, finanças, tarefas, documentos, vistorias, auditoria e agenda centralizados para economizar tempo.',
        },
      ],
    },
    pricing: {
      title: 'Planos para todos os tamanhos',
      subtitle: 'Comece grátis e expanda conforme cresce.',
      monthly: 'por mês',
      popular: 'Mais popular',
      cta: 'Começar agora',
      contactSales: 'Falar com vendas',
      plans: [
        {
          name: 'Starter',
          price: 'Grátis',
          description: 'Para quem está começando ou tem poucos imóveis.',
          features: [
            'Até 3 imóveis',
            '1 usuário',
            'Contratos e hóspedes',
            'Controle financeiro básico',
            'Documentos gerais',
            'Suporte por e-mail',
          ],
          cta: 'Começar grátis',
          variant: 'outline' as const,
          highlighted: false,
        },
        {
          name: 'Profissional',
          price: 'R$ 79',
          description: 'Para administradoras e proprietários com múltiplos imóveis.',
          features: [
            'Imóveis ilimitados',
            'Até 5 usuários',
            'Templates de contratos personalizados',
            'Relatórios avançados',
            'Calendário de reservas',
            'Vistoria digital',
            'Documentos vinculados',
            'Gestão de prestadores',
            'Suporte prioritário',
          ],
          cta: 'Assinar agora',
          variant: 'default' as const,
          highlighted: true,
        },
        {
          name: 'Empresarial',
          price: 'Sob consulta',
          description: 'Para grandes administradoras com demandas específicas.',
          features: [
            'Tudo do plano Profissional',
            'Usuários ilimitados',
            'Múltiplos tenants',
            'API de integração',
            'Auditoria e monitoramento',
            'Onboarding dedicado',
            'SLA garantido',
            'Gerente de conta exclusivo',
          ],
          cta: 'Falar com vendas',
          variant: 'outline' as const,
          highlighted: false,
        },
      ],
    },
    testimonials: {
      title: 'O que dizem nossos clientes',
      items: [
        {
          quote: 'Reduzi o tempo de gestão dos meus imóveis em mais da metade. Os contratos automáticos são um divisor de águas.',
          author: 'Mariana S.',
          role: 'Proprietária de 12 imóveis',
        },
        {
          quote: 'A equipe agora trabalha de forma sincronizada. Cada um sabe o que precisa fazer sem ligações desnecessárias.',
          author: 'Carlos M.',
          role: 'Administradora Imobiliária',
        },
        {
          quote: 'Finalmente um sistema que entende o mercado de aluguel. Simples, rápido e completo.',
          author: 'Ana P.',
          role: 'Gestora de 30 unidades',
        },
      ],
    },
    footer: {
      tagline: 'Gestão de imóveis simples e inteligente.',
      rights: 'Todos os direitos reservados.',
    },
  },
  en: {
    nav: {
      features: 'Features',
      latest: 'What’s new',
      howItWorks: 'How it works',
      pricing: 'Pricing',
      login: 'Sign in',
      cta: 'Get started free',
    },
    hero: {
      badge: 'Simplified Rental Management',
      title: 'Manage your properties with',
      titleHighlight: 'intelligence and ease',
      subtitle: 'From guest registration to contracts, digital inspections, documents, audit logs, and advanced financial control — all in one place.',
      cta: 'Get started for free',
      demo: 'See demo',
      stats: [
        { value: '360°', label: 'Integrated management' },
        { value: '24/7', label: 'Organized data' },
        { value: '3×', label: 'More productive' },
      ],
    },
    features: {
      title: 'Everything you need to',
      titleHighlight: 'manage your properties',
      subtitle: 'A complete platform to simplify every stage of property management.',
      items: [
        {
          icon: Buildings,
          title: 'Property Portfolio',
          description: 'Register rooms, apartments, and houses with environments, furniture, inspection items and operational status.',
        },
        {
          icon: Users,
          title: 'Guest Management',
          description: 'Complete profiles with documents, contract history and personal information.',
        },
        {
          icon: FileText,
          title: 'Smart Contracts',
          description: 'Customizable templates with automatic variables. Generate professional PDFs in seconds.',
        },
        {
          icon: CurrencyCircleDollar,
          title: 'Financial Control',
          description: 'Income, expenses and filters by month, contract, guest, owner, property, category and service provider.',
        },
        {
          icon: CalendarBlank,
          title: 'Booking Calendar',
          description: 'Visualize occupancy, due dates and appointments in an interactive calendar.',
        },
        {
          icon: ChartBar,
          title: 'Detailed Reports',
          description: 'Performance analytics, occupancy rates, revenue per property and more.',
        },
        {
          icon: Wrench,
          title: 'Service Providers',
          description: 'Manage maintenance, cleaning and repair contacts linked to each property.',
        },
        {
          icon: ShieldCheck,
          title: 'Multi-user',
          description: 'Invite your team, set permissions by role and collaborate securely.',
        },
        {
          icon: ClipboardText,
          title: 'Digital Inspections',
          description: 'Record inspections by environment, compare differences and create tasks from issues found.',
        },
        {
          icon: FolderOpen,
          title: 'Document Center',
          description: 'Upload, preview, download and organize documents by property, contract, guest, owner or general use.',
        },
        {
          icon: ClockCounterClockwise,
          title: 'Audit & Presence',
          description: 'Track login, logout, create, update, delete and online users in near real time.',
        },
        {
          icon: Bug,
          title: 'Bug Reporting',
          description: 'Users can report issues with screen, record, description and screenshots pasted from clipboard.',
        },
      ],
    },
    latest: {
      title: 'New tools for professional operations',
      subtitle: 'Features designed to reduce rework, increase traceability and give admins more control.',
      items: [
        {
          icon: ClipboardText,
          title: 'Linked inspections',
          description: 'Check-in, periodic, maintenance and check-out inspections can be tracked in related cards with differences between inspections.',
        },
        {
          icon: FolderOpen,
          title: 'Storage-backed documents',
          description: 'Upload, download, preview, clipboard paste and drag and drop with entity links and filters.',
        },
        {
          icon: UserFocus,
          title: 'Online users',
          description: 'See who is online, current screen, activity, time, IP, browser and hostname inside the tenant.',
        },
        {
          icon: PushPin,
          title: 'Personalized menu',
          description: 'Pin sidebar items, reorder them with drag and drop and keep preferences saved per user.',
        },
      ],
    },
    howItWorks: {
      title: 'How it works',
      subtitle: 'Get started in minutes, not weeks.',
      steps: [
        {
          number: '01',
          title: 'Create your account',
          description: 'Sign up with email and password or Google. Set your company name and you\'re ready.',
        },
        {
          number: '02',
          title: 'Add your properties',
          description: 'Add properties, owners, guests, environments, furniture and inspection items.',
        },
        {
          number: '03',
          title: 'Manage everything in one place',
          description: 'Contracts, finances, tasks, documents, inspections, audit logs and schedule — all centralized to save time.',
        },
      ],
    },
    pricing: {
      title: 'Plans for every size',
      subtitle: 'Start for free and scale as you grow.',
      monthly: 'per month',
      popular: 'Most popular',
      cta: 'Get started',
      contactSales: 'Contact sales',
      plans: [
        {
          name: 'Starter',
          price: 'Free',
          description: 'For those just getting started or with a small portfolio.',
          features: [
            'Up to 3 properties',
            '1 user',
            'Contracts and guests',
            'Basic financial control',
            'General documents',
            'Email support',
          ],
          cta: 'Start free',
          variant: 'outline' as const,
          highlighted: false,
        },
        {
          name: 'Professional',
          price: '$29',
          description: 'For property managers and owners with multiple properties.',
          features: [
            'Unlimited properties',
            'Up to 5 users',
            'Custom contract templates',
            'Advanced reports',
            'Booking calendar',
            'Digital inspections',
            'Linked documents',
            'Service provider management',
            'Priority support',
          ],
          cta: 'Subscribe now',
          variant: 'default' as const,
          highlighted: true,
        },
        {
          name: 'Enterprise',
          price: 'Custom pricing',
          description: 'For large property management companies with specific needs.',
          features: [
            'Everything in Professional',
            'Unlimited users',
            'Multiple tenants',
            'API integration',
            'Audit and monitoring',
            'Dedicated onboarding',
            'SLA guarantee',
            'Dedicated account manager',
          ],
          cta: 'Contact sales',
          variant: 'outline' as const,
          highlighted: false,
        },
      ],
    },
    testimonials: {
      title: 'What our customers say',
      items: [
        {
          quote: 'I cut my property management time in half. Automatic contracts are a game changer.',
          author: 'Mariana S.',
          role: 'Owner of 12 properties',
        },
        {
          quote: 'The team now works in sync. Everyone knows what to do without unnecessary calls.',
          author: 'Carlos M.',
          role: 'Property Management Company',
        },
        {
          quote: 'Finally a system that understands the rental market. Simple, fast and complete.',
          author: 'Ana P.',
          role: 'Manager of 30 units',
        },
      ],
    },
    footer: {
      tagline: 'Simple and smart property management.',
      rights: 'All rights reserved.',
    },
  },
}

export function HomePage({ onLoginClick }: HomePageProps) {
  const [lang, setLang] = useState<'pt' | 'en'>('pt')
  const t = content[lang]

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <img src={rpmLogo} alt="RPM - Rental Property Manager" className="h-16 w-auto" />
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => scrollTo('features')} className="hover:text-foreground transition-colors">{t.nav.features}</button>
            <button onClick={() => scrollTo('latest')} className="hover:text-foreground transition-colors">{t.nav.latest}</button>
            <button onClick={() => scrollTo('how-it-works')} className="hover:text-foreground transition-colors">{t.nav.howItWorks}</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-foreground transition-colors">{t.nav.pricing}</button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(l => l === 'pt' ? 'en' : 'pt')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
            >
              <Globe size={14} />
              {lang === 'pt' ? 'EN' : 'PT'}
            </button>
            <Button variant="ghost" size="sm" onClick={onLoginClick}>{t.nav.login}</Button>
            <Button size="sm" onClick={onLoginClick} className="hidden sm:flex gap-1.5">
              {t.nav.cta}
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10 pointer-events-none" />
        <div className="absolute top-20 right-10 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5">
            <Rocket size={12} weight="fill" />
            {t.hero.badge}
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            {t.hero.title}{' '}
            <span className="text-primary">{t.hero.titleHighlight}</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t.hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" onClick={onLoginClick} className="gap-2 h-12 px-8 text-base">
              {t.hero.cta}
              <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => scrollTo('how-it-works')} className="h-12 px-8 text-base gap-2">
              {t.hero.demo}
              <CaretDown size={16} />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-sm sm:max-w-none sm:grid-cols-3 mx-auto">
            {t.hero.stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Recursos</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t.features.title}{' '}
              <span className="text-primary">{t.features.titleHighlight}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.features.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.features.items.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="group bg-card border border-border rounded-xl p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon size={22} weight="duotone" className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* LATEST FEATURES */}
      <section id="latest" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
            <div className="lg:sticky lg:top-24">
              <Badge variant="outline" className="mb-5 gap-1.5">
                <Lightning size={12} weight="fill" />
                {lang === 'pt' ? 'Novidades do sistema' : 'Product updates'}
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.latest.title}</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">{t.latest.subtitle}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {t.latest.items.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                  >
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                    <div className="relative">
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                        <Icon size={24} weight="duotone" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Processo</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.howItWorks.title}</h2>
            <p className="text-muted-foreground text-lg">{t.howItWorks.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            {t.howItWorks.steps.map((step, i) => (
              <div key={step.number} className="relative text-center group">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 border-2 border-primary/20 mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                  <span className="text-2xl font-bold text-primary">{step.number}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BADGES */}
      <section className="py-12 px-6 bg-muted/30 border-y border-border/60">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { icon: Lock, label: lang === 'pt' ? 'Dados seguros' : 'Secure data' },
              { icon: Lightning, label: lang === 'pt' ? 'Alta performance' : 'High performance' },
              { icon: Handshake, label: lang === 'pt' ? 'Suporte humano' : 'Human support' },
              { icon: Bell, label: lang === 'pt' ? 'Sempre atualizado' : 'Always updated' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-muted-foreground">
                <Icon size={28} weight="duotone" className="text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              {lang === 'pt' ? 'Preços' : 'Pricing'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.pricing.title}</h2>
            <p className="text-muted-foreground text-lg">{t.pricing.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {t.pricing.plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-200 ${
                  plan.highlighted
                    ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10 scale-[1.02]'
                    : 'border-border bg-card hover:border-primary/30 hover:shadow-md'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1 px-4 py-1 text-xs font-semibold shadow-md">
                      <Star size={11} weight="fill" />
                      {t.pricing.popular}
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.price !== (lang === 'pt' ? 'Grátis' : 'Free') && plan.price !== (lang === 'pt' ? 'Sob consulta' : 'Custom pricing') && (
                      <span className="text-muted-foreground text-sm">/{t.pricing.monthly}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle size={16} weight="fill" className="text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.highlighted ? 'default' : 'outline'}
                  className="w-full"
                  onClick={onLoginClick}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              {lang === 'pt' ? 'Depoimentos' : 'Testimonials'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">{t.testimonials.title}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {t.testimonials.items.map((item) => (
              <div key={item.author} className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} weight="fill" className="text-yellow-500" />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed italic">"{item.quote}"</p>
                <div className="mt-auto flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <IdentificationCard size={18} weight="duotone" className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{item.author}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6 mx-auto">
            <Rocket size={32} weight="duotone" className="text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {lang === 'pt' ? 'Pronto para começar?' : 'Ready to get started?'}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            {lang === 'pt'
              ? 'Crie sua conta gratuitamente e veja como o RPM - Rental Property Manager simplifica a gestão dos seus imóveis.'
              : 'Create your free account and see how RPM - Rental Property Manager simplifies managing your properties.'}
          </p>
          <Button size="lg" onClick={onLoginClick} className="gap-2 h-12 px-10 text-base">
            {lang === 'pt' ? 'Começar gratuitamente' : 'Start for free'}
            <ArrowRight size={18} />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-10 px-6 bg-muted/20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <House size={14} weight="fill" className="text-primary-foreground" />
            </div>
            <span className="font-bold">RPM - Rental Property Manager</span>
            <span className="text-muted-foreground text-sm ml-2">— {t.footer.tagline}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} RPM - Rental Property Manager. {t.footer.rights}
          </p>
        </div>
      </footer>
    </div>
  )
}
