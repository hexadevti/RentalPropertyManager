import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import rpmLogo from '@/assets/rpm-go-tranparent.png'
import {
  House, Buildings, Users, CurrencyCircleDollar, CalendarBlank, ChartBar,
  FileText, Wrench, CheckCircle, ArrowRight, Globe, Star, ShieldCheck,
  Rocket, Lightning, Handshake, IdentificationCard, Bell, Lock,
  CaretDown, ClipboardText, FolderOpen, Bug, ClockCounterClockwise,
  UserFocus, PushPin, Brain, WhatsappLogo, ArrowsClockwise, UploadSimple,
  Sparkle, ChatCircleText, Robot, Database, MagicWand,
} from '@phosphor-icons/react'

interface HomePageProps {
  onLoginClick: () => void
  onDemoClick?: () => void
  isDemoLoggingIn?: boolean
}

const content = {
  pt: {
    nav: {
      features: 'Recursos',
      ai: 'IA & Automação',
      aiCapabilities: 'Funcionalidades IA',
      latest: 'Novidades',
      howItWorks: 'Como funciona',
      pricing: 'Planos',
      login: 'Entrar',
      cta: 'Começar grátis',
    },
    hero: {
      badge: 'Gestão com Inteligência Artificial',
      title: 'Gerencie seus imóveis com',
      titleHighlight: 'IA e automação real',
      subtitle: 'Assistente Claude integrado, bot WhatsApp, sincronização com Airbnb e Booking.com, importação em massa e notificações automáticas — tudo em um só sistema.',
      cta: 'Começar gratuitamente',
      demo: 'Ver como funciona',
      stats: [
        { value: 'Claude', label: 'AI integrado' },
        { value: 'WhatsApp', label: 'Bot nativo' },
        { value: 'iCal', label: 'Sync Airbnb/Booking' },
      ],
    },
    ai: {
      badge: 'Inteligência Artificial',
      title: 'O primeiro sistema de gestão de imóveis',
      titleHighlight: 'verdadeiramente inteligente',
      subtitle: 'Não é só um chatbot. É um ecossistema de IA para captar imóveis, ler documentos, automatizar tarefas e responder em linguagem natural via web ou WhatsApp.',
      items: [
        {
          icon: Brain,
          title: 'Assistente IA (Claude)',
          description: 'Faça perguntas como "Qual o saldo do mês?" ou "Quais contratos vencem em 30 dias?". O assistente consulta seu banco de dados dinamicamente e responde com precisão.',
          highlight: true,
        },
        {
          icon: MagicWand,
          title: 'Captação de imóveis por anúncios web',
          description: 'Cole o link de um anúncio e a IA extrai automaticamente título, descrição, fotos, preço e características para montar o cadastro do imóvel em segundos.',
          highlight: true,
        },
        {
          icon: FileText,
          title: 'Leitura e transcrição de documentos',
          description: 'Envie PDF, DOCX, imagens e fotos de documentos. A IA lê, transcreve e estrutura os dados para contratos, hóspedes, proprietários e templates.',
          highlight: true,
        },
        {
          icon: WhatsappLogo,
          title: 'Bot WhatsApp',
          description: 'Acesse o assistente pelo WhatsApp. Usuários identificados pelo número de telefone têm acesso direto ao portfólio via chat — sem abrir o sistema.',
          highlight: false,
        },
        {
          icon: Bell,
          title: 'Notificações automáticas',
          description: 'Regras configuráveis por trigger: contratos vencendo, pagamentos, vistorias, tarefas. Entrega via email, SMS ou WhatsApp com templates personalizáveis.',
          highlight: false,
        },
      ],
      chatPreview: [
        { role: 'user', text: 'Quais propriedades estão disponíveis agora?' },
        { role: 'bot', text: '3 imóveis disponíveis: Apto 203 Centro, Casa Vila Nova e Quarto 01. Deseja criar um contrato para algum deles?' },
        { role: 'user', text: 'Qual o saldo financeiro de abril?' },
        { role: 'bot', text: 'Abril: R$ 8.400 em receitas, R$ 1.250 em despesas. Saldo líquido: *R$ 7.150*. Maior categoria de receita: Aluguel mensal.' },
      ],
    },
    aiCapabilities: {
      title: 'Todas as funcionalidades de IA em um só lugar',
      subtitle: 'Do onboarding de dados à operação diária: recursos práticos para ganhar velocidade sem perder controle.',
      items: [
        'Assistente IA com consultas dinâmicas no banco de dados',
        'Captação automática de propriedades a partir de anúncios na web',
        'Leitura e transcrição de documentos (PDF, DOCX e imagens)',
        'Importação de proprietários/hóspedes por documentos e fotos',
        'Importação de templates contratuais com sugestões de variáveis',
        'Bot WhatsApp conectado ao contexto do tenant',
        'Sugestões inteligentes para anúncios de propriedade',
        'Notificações automáticas com regras e templates dinâmicos',
      ],
    },
    integrations: {
      badge: 'Integrações',
      title: 'Conectado às principais',
      titleHighlight: 'plataformas de reservas',
      subtitle: 'Sincronize reservas do Airbnb, Booking.com e outros via iCal. Importe em massa via CSV. Envie notificações via Twilio.',
      items: [
        {
          icon: ArrowsClockwise,
          title: 'Sync iCal — Airbnb & Booking',
          description: 'Cadastre os links iCal das suas propriedades e importe reservas automaticamente. Cada propriedade também gera um link público para exportar disponibilidade.',
        },
        {
          icon: UploadSimple,
          title: 'Importação CSV em massa',
          description: 'Importe propriedades, hóspedes, proprietários, contratos, finanças e prestadores via CSV. Templates prontos com preview antes de confirmar.',
        },
        {
          icon: WhatsappLogo,
          title: 'Notificações WhatsApp (Twilio)',
          description: 'Envio automático de alertas via WhatsApp para usuários com telefone cadastrado. Sem necessidade de conta Business API — funciona com sandbox Twilio.',
        },
        {
          icon: Bell,
          title: 'Email & SMS',
          description: 'Notificações via Resend (email) e SMS via webhook. Templates HTML e texto com tokens dinâmicos do contrato, tarefa, hóspede e mais.',
        },
      ],
    },
    features: {
      title: 'Tudo que você precisa para',
      titleHighlight: 'gerenciar seus imóveis',
      subtitle: 'Uma plataforma completa com 18 módulos integrados.',
      items: [
        {
          icon: Buildings,
          title: 'Portfólio de Imóveis',
          description: 'Quartos, apartamentos e casas com fotos, ambientes, mobiliário, itens de vistoria, mapa e links iCal por propriedade.',
        },
        {
          icon: Users,
          title: 'Hóspedes & Proprietários',
          description: 'Cadastro completo com documentos múltiplos, fiadores, dependentes e histórico de contratos.',
        },
        {
          icon: FileText,
          title: 'Contratos Inteligentes',
          description: 'Templates com variáveis XPath automáticas. Gere PDFs profissionais em múltiplos idiomas com um clique.',
        },
        {
          icon: CurrencyCircleDollar,
          title: 'Controle Financeiro',
          description: 'Receitas e despesas com filtros por período, contrato, hóspede, proprietário, propriedade e prestador.',
        },
        {
          icon: CalendarBlank,
          title: 'Calendário Integrado',
          description: 'Ocupações, vencimentos, compromissos e tarefas em um calendário interativo com mini-calendários por imóvel.',
        },
        {
          icon: ChartBar,
          title: 'Relatórios Avançados',
          description: 'Taxa de ocupação, receita por imóvel, tendência financeira, prestadores mais utilizados e hóspedes ativos.',
        },
        {
          icon: ClipboardText,
          title: 'Vistoria Digital',
          description: 'Checklist por ambiente, comparação entre vistorias, geração automática de tarefas a partir de danos identificados.',
        },
        {
          icon: FolderOpen,
          title: 'Documentos',
          description: 'Upload via drag-and-drop, paste ou clique. Vincule a contratos, hóspedes, proprietários ou propriedades.',
        },
        {
          icon: Wrench,
          title: 'Prestadores & Agenda',
          description: 'Gestão de fornecedores vinculados a despesas e compromissos, com histórico por prestador.',
        },
        {
          icon: ShieldCheck,
          title: 'Permissões Granulares',
          description: 'Perfis de acesso com permissão por módulo (none/read/write). Convite por email, monitoramento de sessões.',
        },
        {
          icon: ClockCounterClockwise,
          title: 'Auditoria Completa',
          description: 'Log imutável de login, logout, criações, alterações e exclusões com filtros por usuário, entidade e período.',
        },
        {
          icon: Bell,
          title: 'Notificações Automáticas',
          description: 'Regras por trigger com entrega via email, SMS ou WhatsApp. Templates HTML multilíngue com tokens dinâmicos.',
        },
      ],
    },
    latest: {
      title: 'As últimas novidades do sistema',
      subtitle: 'Funcionalidades lançadas recentemente para aumentar produtividade e automação.',
      items: [
        {
          icon: MagicWand,
          title: 'Captação de imóveis por anúncios web com IA',
          description: 'Cole um link de anúncio e gere o rascunho da propriedade com fotos, dados e descrição pré-preenchidos automaticamente.',
          isNew: true,
        },
        {
          icon: FileText,
          title: 'Leitura e transcrição inteligente de documentos',
          description: 'Importe documentos e fotos para a IA extrair texto estruturado e preencher dados com muito menos digitação manual.',
          isNew: true,
        },
        {
          icon: Brain,
          title: 'Assistente IA com Claude',
          description: 'Tool use real — o Claude consulta o banco dinamicamente para cada pergunta, sem limites de registros pré-carregados.',
          isNew: true,
        },
        {
          icon: WhatsappLogo,
          title: 'Bot WhatsApp',
          description: 'Chat com o assistente IA pelo WhatsApp. Histórico de conversa, comandos e identificação por número de telefone.',
          isNew: true,
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
          description: 'Cadastre-se com e-mail ou GitHub. Configure o nome da sua empresa e convide sua equipe.',
        },
        {
          number: '02',
          title: 'Importe seus dados',
          description: 'Use os templates CSV para importar propriedades, hóspedes e contratos existentes em minutos.',
        },
        {
          number: '03',
          title: 'Automatize com IA',
          description: 'Configure o bot WhatsApp, ative notificações automáticas e use o assistente Claude para consultas em tempo real.',
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
            'Assistente IA (Claude)',
            'Bot WhatsApp',
            'Sync iCal (Airbnb/Booking)',
            'Importação CSV',
            'Templates de contratos',
            'Notificações automáticas',
            'Vistoria digital',
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
          quote: 'O bot WhatsApp mudou tudo. Verifico contratos e saldos pelo celular sem nem abrir o sistema.',
          author: 'Mariana S.',
          role: 'Proprietária de 12 imóveis',
        },
        {
          quote: 'Importamos 80 contratos via CSV em 20 minutos. O que levaria dias ficou pronto antes do almoço.',
          author: 'Carlos M.',
          role: 'Administradora Imobiliária',
        },
        {
          quote: 'A sincronização com Airbnb e Booking economiza horas por semana. As reservas chegam automáticas.',
          author: 'Ana P.',
          role: 'Gestora de 30 unidades',
        },
      ],
    },
    footer: {
      tagline: 'Gestão de imóveis com inteligência artificial.',
      rights: 'Todos os direitos reservados.',
    },
  },
  en: {
    nav: {
      features: 'Features',
      ai: 'AI & Automation',
      aiCapabilities: 'AI capabilities',
      latest: 'What\'s new',
      howItWorks: 'How it works',
      pricing: 'Pricing',
      login: 'Sign in',
      cta: 'Get started free',
    },
    hero: {
      badge: 'Property Management with AI',
      title: 'Manage your properties with',
      titleHighlight: 'real AI and automation',
      subtitle: 'Claude AI assistant, WhatsApp bot, Airbnb & Booking.com sync, bulk CSV import and automatic notifications — all in one system.',
      cta: 'Get started for free',
      demo: 'See how it works',
      stats: [
        { value: 'Claude', label: 'AI integrated' },
        { value: 'WhatsApp', label: 'Native bot' },
        { value: 'iCal', label: 'Airbnb/Booking sync' },
      ],
    },
    ai: {
      badge: 'Artificial Intelligence',
      title: 'The first property management system',
      titleHighlight: 'truly powered by AI',
      subtitle: 'It\'s not just a chatbot. It\'s a complete AI stack to capture properties, read documents, automate workflows and answer in natural language via web or WhatsApp.',
      items: [
        {
          icon: Brain,
          title: 'AI Assistant (Claude)',
          description: 'Ask questions like "What\'s this month\'s balance?" or "Which contracts expire in 30 days?". The assistant queries your database dynamically and answers accurately.',
          highlight: true,
        },
        {
          icon: MagicWand,
          title: 'Property capture from web listings',
          description: 'Paste a listing URL and AI extracts title, description, photos, price and features to pre-fill the property record in seconds.',
          highlight: true,
        },
        {
          icon: FileText,
          title: 'Document reading and transcription',
          description: 'Upload PDFs, DOCX files, scans and photos. AI reads, transcribes and structures the data for contracts, guests, owners and templates.',
          highlight: true,
        },
        {
          icon: WhatsappLogo,
          title: 'WhatsApp Bot',
          description: 'Access the assistant via WhatsApp. Users identified by phone number get direct portfolio access via chat — without opening the system.',
          highlight: false,
        },
        {
          icon: Bell,
          title: 'Automatic notifications',
          description: 'Configurable rules by trigger: expiring contracts, payments, inspections, tasks. Delivered via email, SMS or WhatsApp with custom templates.',
          highlight: false,
        },
      ],
      chatPreview: [
        { role: 'user', text: 'Which properties are available right now?' },
        { role: 'bot', text: '3 properties available: Apt 203 Downtown, Villa Nova House and Room 01. Want to create a contract for any of them?' },
        { role: 'user', text: 'What\'s the financial balance for April?' },
        { role: 'bot', text: 'April: $8,400 in revenue, $1,250 in expenses. Net balance: *$7,150*. Top income category: Monthly rent.' },
      ],
    },
    aiCapabilities: {
      title: 'All AI capabilities in one place',
      subtitle: 'From data onboarding to daily operations: practical features that increase speed without losing control.',
      items: [
        'AI assistant with dynamic database queries',
        'Automatic property capture from web listings',
        'Document reading and transcription (PDF, DOCX and images)',
        'Owner/guest import from documents and photos',
        'Contract template import with variable suggestions',
        'WhatsApp bot connected to tenant context',
        'Intelligent property ad copy generation',
        'Automatic notifications with dynamic rules and templates',
      ],
    },
    integrations: {
      badge: 'Integrations',
      title: 'Connected to the leading',
      titleHighlight: 'booking platforms',
      subtitle: 'Sync bookings from Airbnb, Booking.com and others via iCal. Import in bulk via CSV. Send notifications via Twilio.',
      items: [
        {
          icon: ArrowsClockwise,
          title: 'iCal Sync — Airbnb & Booking',
          description: 'Register iCal links from your properties and import bookings automatically. Each property also generates a public link to export availability.',
        },
        {
          icon: UploadSimple,
          title: 'Bulk CSV import',
          description: 'Import properties, guests, owners, contracts, finances and service providers via CSV. Ready-made templates with preview before confirming.',
        },
        {
          icon: WhatsappLogo,
          title: 'WhatsApp Notifications (Twilio)',
          description: 'Automatic WhatsApp alerts for users with a registered phone number. No Business API required — works with Twilio sandbox.',
        },
        {
          icon: Bell,
          title: 'Email & SMS',
          description: 'Notifications via Resend (email) and SMS via webhook. HTML and text templates with dynamic tokens for contracts, tasks, guests and more.',
        },
      ],
    },
    features: {
      title: 'Everything you need to',
      titleHighlight: 'manage your properties',
      subtitle: 'A complete platform with 18 integrated modules.',
      items: [
        {
          icon: Buildings,
          title: 'Property Portfolio',
          description: 'Rooms, apartments and houses with photos, rooms, furniture, inspection items, map and iCal links per property.',
        },
        {
          icon: Users,
          title: 'Guests & Owners',
          description: 'Complete profiles with multiple documents, guarantors, dependents and contract history.',
        },
        {
          icon: FileText,
          title: 'Smart Contracts',
          description: 'Templates with automatic XPath variables. Generate professional PDFs in multiple languages with one click.',
        },
        {
          icon: CurrencyCircleDollar,
          title: 'Financial Control',
          description: 'Income and expenses with filters by period, contract, guest, owner, property and service provider.',
        },
        {
          icon: CalendarBlank,
          title: 'Integrated Calendar',
          description: 'Occupancy, due dates, appointments and tasks in an interactive calendar with mini-calendars per property.',
        },
        {
          icon: ChartBar,
          title: 'Advanced Reports',
          description: 'Occupancy rate, revenue per property, financial trends, top service providers and active guests.',
        },
        {
          icon: ClipboardText,
          title: 'Digital Inspections',
          description: 'Room-by-room checklists, inspection comparisons, automatic task generation from identified damage.',
        },
        {
          icon: FolderOpen,
          title: 'Documents',
          description: 'Upload via drag-and-drop, paste or click. Link to contracts, guests, owners or properties.',
        },
        {
          icon: Wrench,
          title: 'Providers & Schedule',
          description: 'Vendor management linked to expenses and appointments, with history per provider.',
        },
        {
          icon: ShieldCheck,
          title: 'Granular Permissions',
          description: 'Access profiles with per-module permissions (none/read/write). Email invites, session monitoring.',
        },
        {
          icon: ClockCounterClockwise,
          title: 'Full Audit Trail',
          description: 'Immutable log of login, logout, creates, updates and deletes with filters by user, entity and period.',
        },
        {
          icon: Bell,
          title: 'Automatic Notifications',
          description: 'Trigger-based rules delivered via email, SMS or WhatsApp. Multilingual HTML templates with dynamic tokens.',
        },
      ],
    },
    latest: {
      title: 'Latest features',
      subtitle: 'Recently launched to increase productivity and automation.',
      items: [
        {
          icon: MagicWand,
          title: 'AI property capture from web listings',
          description: 'Paste a listing URL and generate a property draft with photos, details and description already pre-filled.',
          isNew: true,
        },
        {
          icon: FileText,
          title: 'Intelligent document reading and transcription',
          description: 'Import documents and photos so AI extracts structured text and pre-fills key data with minimal manual typing.',
          isNew: true,
        },
        {
          icon: Brain,
          title: 'AI Assistant with Claude',
          description: 'Real tool use — Claude queries the database dynamically for each question, with no pre-loaded record limits.',
          isNew: true,
        },
        {
          icon: WhatsappLogo,
          title: 'WhatsApp Bot',
          description: 'Chat with the AI assistant via WhatsApp. Conversation history, commands and phone number identification.',
          isNew: true,
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
          description: 'Sign up with email or GitHub. Set your company name and invite your team.',
        },
        {
          number: '02',
          title: 'Import your data',
          description: 'Use CSV templates to import existing properties, guests and contracts in minutes.',
        },
        {
          number: '03',
          title: 'Automate with AI',
          description: 'Set up the WhatsApp bot, enable automatic notifications and use the Claude assistant for real-time queries.',
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
          description: 'For those getting started or with a small portfolio.',
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
            'AI Assistant (Claude)',
            'WhatsApp Bot',
            'iCal Sync (Airbnb/Booking)',
            'CSV Import',
            'Contract templates',
            'Automatic notifications',
            'Digital inspections',
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
          quote: 'The WhatsApp bot changed everything. I check contracts and balances from my phone without even opening the system.',
          author: 'Mariana S.',
          role: 'Owner of 12 properties',
        },
        {
          quote: 'We imported 80 contracts via CSV in 20 minutes. What would take days was done before lunch.',
          author: 'Carlos M.',
          role: 'Property Management Company',
        },
        {
          quote: 'The Airbnb and Booking sync saves hours every week. Reservations come in automatically.',
          author: 'Ana P.',
          role: 'Manager of 30 units',
        },
      ],
    },
    footer: {
      tagline: 'Property management with artificial intelligence.',
      rights: 'All rights reserved.',
    },
  },
}

export function HomePage({ onLoginClick, onDemoClick, isDemoLoggingIn = false }: HomePageProps) {
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
            <button onClick={() => scrollTo('ai')} className="hover:text-foreground transition-colors flex items-center gap-1">
              <Sparkle size={12} weight="fill" className="text-primary" />
              {t.nav.ai}
            </button>
            <button onClick={() => scrollTo('ai-capabilities')} className="hover:text-foreground transition-colors">{t.nav.aiCapabilities}</button>
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/10 pointer-events-none" />
        <div className="absolute top-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5 px-4 py-1.5">
            <Brain size={13} weight="fill" className="text-primary" />
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
            {onDemoClick && (
              <Button
                size="lg"
                onClick={onDemoClick}
                disabled={isDemoLoggingIn}
                className="gap-2 h-12 px-8 text-base bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                <Sparkle size={18} weight="fill" />
                {isDemoLoggingIn
                  ? (lang === 'pt' ? 'Entrando...' : 'Loading...')
                  : (lang === 'pt' ? 'Explorar Demo' : 'Try Demo')}
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={onLoginClick} className="gap-2 h-12 px-8 text-base">
              {t.hero.cta}
              <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="ghost" onClick={() => scrollTo('ai')} className="h-12 px-8 text-base gap-2">
              {t.hero.demo}
              <CaretDown size={16} />
            </Button>
          </div>

          {onDemoClick && (
            <p className="text-xs text-muted-foreground mb-6 -mt-10">
              {lang === 'pt'
                ? '✦ Demo com dados de exemplo — somente leitura, sem precisar criar conta'
                : '✦ Demo with sample data — read-only, no account needed'}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-md mx-auto mb-16">
            {t.hero.stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Property image mosaic */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {[
              { src: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=500&q=80&auto=format&fit=crop', alt: 'Modern apartment', tall: true },
              { src: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=500&q=80&auto=format&fit=crop', alt: 'Living room' },
              { src: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=500&q=80&auto=format&fit=crop', alt: 'Modern kitchen' },
              { src: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&q=80&auto=format&fit=crop', alt: 'Luxury house', tall: true },
            ].map((img, i) => (
              <div key={i} className={`overflow-hidden rounded-2xl shadow-lg ${img.tall ? 'row-span-2' : ''}`}>
                <img
                  src={img.src}
                  alt={img.alt}
                  className="h-full w-full object-cover hover:scale-105 transition-transform duration-500"
                  style={{ minHeight: img.tall ? '280px' : '130px' }}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI SECTION — destaque principal */}
      <section id="ai" className="py-24 px-6 bg-gradient-to-b from-primary/5 via-primary/3 to-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-5 gap-1.5 px-4 py-1.5">
              <Sparkle size={12} weight="fill" />
              {t.ai.badge}
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t.ai.title}{' '}
              <span className="text-primary">{t.ai.titleHighlight}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.ai.subtitle}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* AI Features */}
            <div className="space-y-5">
              {t.ai.items.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className={`flex gap-4 p-5 rounded-xl border transition-all ${
                      item.highlight
                        ? 'border-primary/40 bg-primary/5 shadow-lg shadow-primary/10'
                        : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${
                      item.highlight ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                    }`}>
                      <Icon size={22} weight="duotone" className={item.highlight ? '' : 'text-primary'} />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Chat Preview */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/40">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Brain size={16} weight="duotone" className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Assistente RPM</p>
                    <p className="text-xs text-green-500">● {lang === 'pt' ? 'Online' : 'Online'}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <WhatsappLogo size={16} weight="fill" className="text-green-500" />
                    <span className="text-xs text-muted-foreground">WhatsApp</span>
                  </div>
                </div>
                {/* Messages */}
                <div className="p-4 space-y-3 min-h-[240px]">
                  {t.ai.chatPreview.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Input */}
                <div className="px-4 py-3 border-t bg-muted/20 flex items-center gap-2">
                  <div className="flex-1 h-9 rounded-full bg-background border px-4 flex items-center">
                    <span className="text-xs text-muted-foreground">
                      {lang === 'pt' ? 'Pergunte sobre seus imóveis...' : 'Ask about your properties...'}
                    </span>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <ArrowRight size={14} className="text-primary-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ALL AI CAPABILITIES */}
      <section id="ai-capabilities" className="py-20 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 gap-1.5">
              <Robot size={12} weight="fill" />
              {lang === 'pt' ? 'Mapa de IA' : 'AI map'}
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.aiCapabilities.title}</h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">{t.aiCapabilities.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.aiCapabilities.items.map((item) => (
              <div key={item} className="rounded-xl border border-border bg-card px-4 py-4 flex items-start gap-3 hover:border-primary/40 transition-colors">
                <div className="mt-0.5 h-6 w-6 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
                  <CheckCircle size={14} weight="fill" className="text-primary" />
                </div>
                <p className="text-sm leading-relaxed text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="py-20 px-6 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 gap-1.5">
              <ArrowsClockwise size={12} weight="bold" />
              {t.integrations.badge}
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t.integrations.title}{' '}
              <span className="text-primary">{t.integrations.titleHighlight}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.integrations.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.integrations.items.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon size={20} weight="duotone" className="text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2 text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* PROPERTY GALLERY STRIP */}
      <section className="py-16 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm font-semibold text-primary uppercase tracking-wider mb-8">
            {lang === 'pt' ? 'Portfólio de imóveis' : 'Property portfolio'}
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none -mx-6 px-6">
            {[
              { src: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&q=80&auto=format&fit=crop', label: lang === 'pt' ? 'Apartamento' : 'Apartment' },
              { src: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80&auto=format&fit=crop', label: lang === 'pt' ? 'Estúdio moderno' : 'Modern studio' },
              { src: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80&auto=format&fit=crop', label: lang === 'pt' ? 'Edifício corporativo' : 'Corporate building' },
              { src: 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=600&q=80&auto=format&fit=crop', label: lang === 'pt' ? 'Casa de temporada' : 'Vacation home' },
              { src: 'https://images.unsplash.com/photo-1469022563428-aa04fef9f5a2?w=600&q=80&auto=format&fit=crop', label: lang === 'pt' ? 'Cobertura' : 'Penthouse' },
            ].map((img, i) => (
              <div key={i} className="snap-start shrink-0 w-72 md:w-80 rounded-2xl overflow-hidden shadow-md relative group">
                <img
                  src={img.src}
                  alt={img.label}
                  className="h-52 w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-3 left-3 text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {img.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              {lang === 'pt' ? 'Módulos' : 'Modules'}
            </p>
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
      <section id="latest" className="py-24 px-6 bg-muted/20">
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
                    {item.isNew && (
                      <Badge className="absolute top-3 right-3 text-xs gap-1" variant="secondary">
                        <Sparkle size={10} weight="fill" />
                        {lang === 'pt' ? 'Novo' : 'New'}
                      </Badge>
                    )}
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
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              {lang === 'pt' ? 'Processo' : 'Process'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.howItWorks.title}</h2>
            <p className="text-muted-foreground text-lg">{t.howItWorks.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            {t.howItWorks.steps.map((step) => (
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
              { icon: Brain, label: lang === 'pt' ? 'IA real (Claude)' : 'Real AI (Claude)' },
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

                <Button variant={plan.highlighted ? 'default' : 'outline'} className="w-full" onClick={onLoginClick}>
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

          {(() => {
            const avatars = [
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80&auto=format&fit=crop&crop=face',
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80&auto=format&fit=crop&crop=face',
              'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80&auto=format&fit=crop&crop=face',
            ]
            return (
              <div className="grid md:grid-cols-3 gap-6">
                {t.testimonials.items.map((item, idx) => (
                  <div key={item.author} className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} weight="fill" className="text-yellow-500" />
                      ))}
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed italic">"{item.quote}"</p>
                    <div className="mt-auto flex items-center gap-3">
                      <img
                        src={avatars[idx]}
                        alt={item.author}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/20"
                        loading="lazy"
                      />
                      <div>
                        <p className="font-semibold text-sm">{item.author}</p>
                        <p className="text-xs text-muted-foreground">{item.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-accent/8 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6 mx-auto">
            <Brain size={32} weight="duotone" className="text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {lang === 'pt' ? 'Pronto para começar?' : 'Ready to get started?'}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            {lang === 'pt'
              ? 'Crie sua conta e experimente o assistente IA, o bot WhatsApp e a sincronização com Airbnb — tudo incluído.'
              : 'Create your account and try the AI assistant, WhatsApp bot and Airbnb sync — all included.'}
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
