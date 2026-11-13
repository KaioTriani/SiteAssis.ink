// Gera os dados iniciais em data-seed/ a partir das fotos reais já otimizadas.
// Uso: node tools/seed.mjs   (não mexe em data/, que é o que o site usa em produção)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const dims = JSON.parse(readFileSync('tools/portfolio-dims.json', 'utf8'));
const IG = 'https://www.instagram.com/assis.ink/p/';

const img = (key, alt) => ({
  src: `/assets/portfolio/${key}-full.webp`,
  thumb: `/assets/portfolio/${key}-760.webp`,
  w: dims[key][0], h: dims[key][1], alt,
});

const portfolio = [
  { id: 'floral-lirios-borboletas', title: 'Lírios e borboletas', styles: ['fineline', 'floral'], placement: 'Costela', date: '2026-10-04',
    description: 'Traço fino, flores e leveza. Cada detalhe pensado para acompanhar o movimento do corpo.', instagram: IG + 'DeFVjo7IEKV/', featured: true,
    images: [img('floral-lirios-borboletas-1', 'Tatuagem fine line de lírios e borboletas na costela, feita por Assis.ink em João Pessoa'),
             img('floral-lirios-borboletas-2', 'Estêncil do desenho de lírios e borboletas sobre a bancada, antes da sessão')] },
  { id: 'oriental-ondas-sakura', title: 'Ondas e sakura', styles: ['oriental', 'blackgrey'], placement: 'Antebraço', date: '2026-09-18',
    description: 'Estilo oriental com ondas e flores de cerejeira, finalizada em 3 sessões.', instagram: IG + 'DdbMkzakWc-/', featured: true,
    images: [img('oriental-ondas-sakura-1', 'Tatuagem oriental de ondas e flores de cerejeira em preto e cinza no antebraço')] },
  { id: 'old-school-never-more', title: 'Never More', styles: ['oldschool'], placement: 'Antebraço', date: '2026-09-05',
    description: 'Old school com livro, chamas e flores.', instagram: IG + 'Dc7FNC5D674/',
    images: [img('old-school-never-more-1', 'Tatuagem old school de livro com a frase Never More, chamas e flores')] },
  { id: 'escrita-chinesa-pescoco', title: 'Escrita chinesa', styles: ['escrita'], placement: 'Pescoço', date: '2026-08-24',
    description: 'Ideogramas em coluna, acompanhando a linha do pescoço.', instagram: IG + 'DcceVt8IHfP/',
    images: [img('escrita-chinesa-pescoco-1', 'Tatuagem de escrita chinesa em coluna no pescoço'),
             img('escrita-chinesa-pescoco-2', 'Escrita chinesa no pescoço vista de outro ângulo')] },
  { id: 'samurai', title: 'Samurai', styles: ['oriental', 'fineline'], placement: 'Antebraço', date: '2026-08-19',
    description: 'Samurai com chapéu de palha, katanas e pétalas ao vento.', instagram: IG + 'DcOI4SjjRwb/', featured: true,
    images: [img('samurai-1', 'Tatuagem de samurai com katanas e pétalas no antebraço'),
             img('samurai-2', 'Tatuagem de samurai vista de perto')] },
  { id: 'anime-itachi-anbu', title: 'Itachi na Anbu', styles: ['anime', 'blackwork'], placement: 'Perna', date: '2026-07-30',
    description: 'Máscara da Anbu com a katana nas costas.', instagram: IG + 'DbaiEhtDc1b/',
    images: [img('anime-itachi-anbu-1', 'Tatuagem anime do Itachi com máscara da Anbu na perna')] },
  { id: 'anime-nuvem-akatsuki', title: 'Nuvem da Akatsuki', styles: ['anime', 'blackwork'], placement: 'Perna', date: '2026-07-30',
    description: 'Contorno grosso e sólido, feito para durar.', instagram: IG + 'DbaiEhtDc1b/',
    images: [img('anime-nuvem-akatsuki-1', 'Tatuagem da nuvem da Akatsuki em traço preto na perna')] },
  { id: 'fineline-peixe-quebrada', title: 'Andando de quebrada', styles: ['fineline'], placement: 'Antebraço', date: '2026-07-22',
    description: 'Flash autoral em traço fino, do estêncil à pele.', instagram: IG + 'DbHeCAnoKrX/',
    images: [img('fineline-peixe-quebrada-1', 'Tatuagem fine line de peixe com pernas e tênis'),
             img('fineline-peixe-quebrada-2', 'Estêncil e tatuagem do peixe andando de quebrada lado a lado')] },
  { id: 'fineline-1967-oceano', title: '1967 · E eu, oceano', styles: ['fineline', 'escrita'], placement: 'Antebraço', date: '2026-07-19',
    description: 'Lettering em traço fino, com espaçamento pensado para o braço.', instagram: IG + 'Da_MAA9Dz02/',
    images: [img('fineline-1967-oceano-1', 'Tatuagem fine line com o ano 1967 e a frase E eu, oceano'),
             img('fineline-1967-oceano-2', 'Detalhe do número 1967 tatuado em traço fino'),
             img('fineline-1967-oceano-3', 'Detalhe da frase E eu, oceano tatuada em traço fino')] },
  { id: 'old-school-lucky', title: 'Lucky', styles: ['oldschool'], placement: 'Antebraço', date: '2026-07-15',
    description: 'Cartas, rosas e faixa com a palavra Lucky.', instagram: IG + 'Da1iELStffL/',
    images: [img('old-school-lucky-1', 'Tatuagem old school de cartas de baralho, rosas e faixa Lucky'),
             img('old-school-lucky-2', 'Tatuagem Lucky com cartas e rosas vista de frente')] },
  { id: 'escrita-el-arte-de-sentir', title: 'El arte de sentir', styles: ['escrita', 'fineline'], placement: 'Costela', date: '',
    description: 'Frase delicada com estrela, na lateral do tronco.', instagram: '',
    images: [img('escrita-el-arte-de-sentir-1', 'Tatuagem da frase el arte de sentir com estrela na costela')] },
];

const fdims = {};
for (const f of readdirSync('public/assets/flash')) fdims[f.replace('.webp', '')] = null;
const art = (n, id, title, tags, sheet, extra = {}) => ({
  id, slug: n, title, tags,
  image: `/assets/flash/${n}.webp`,
  sheet: `/assets/flash/folha-${sheet}.webp`,
  size: extra.size || '',
  status: 'consultar',
  note: extra.note || '',
});

const catalog = [
  art('leque', 'AI-01', 'Leque com lua e nuvens', ['ornamental'], 'flash-01'),
  art('flor-ornamental', 'AI-02', 'Flor ornamental', ['floral', 'ornamental'], 'flash-01'),
  art('diaba', 'AI-03', 'Diaba', ['personagens'], 'flash-01'),
  art('flor-olho', 'AI-04', 'Flor com olho', ['floral'], 'flash-01'),
  art('sol-oval', 'AI-05', 'Sol no oval', ['ornamental'], 'flash-01'),
  art('coringa-cidade', 'AI-06', 'Coringa e a cidade', ['personagens'], 'flash-02'),
  art('duas-faces', 'AI-07', 'Duas faces', ['personagens'], 'flash-02'),
  art('cinco-faces', 'AI-08', 'Cinco faces', ['personagens'], 'flash-02'),
  art('lirio-floresca-sempre', 'AI-09', 'Lírio · Floresça sempre', ['floral', 'ornamental'], 'flash-03', { size: 'até 22 cm' }),
  art('lotus-coluna', 'AI-10', 'Lótus em coluna', ['floral', 'ornamental'], 'flash-04', { size: 'até 35 cm' }),
  art('pantera', 'AI-11', 'Pantera tribal', ['autoral', 'tradicional'], 'flash-05'),
  art('pato-punk', 'AI-12', 'Pato punk', ['autoral'], 'flash-05'),
  art('caveira-bobo', 'AI-13', 'Caveira bobo da corte', ['autoral', 'tradicional'], 'flash-05'),
  art('flor-papoula', 'AI-14', 'Papoula', ['autoral', 'floral'], 'flash-06'),
  art('flor-coracao', 'AI-15', 'Flor coração', ['autoral', 'floral'], 'flash-06'),
  art('margarida', 'AI-16', 'Margarida sorrindo', ['autoral', 'floral'], 'flash-06'),
  art('flor-ornamento', 'AI-17', 'Ornamento floral', ['autoral', 'ornamental'], 'flash-06'),
  art('adaga', 'AI-18', 'Adaga partida', ['autoral', 'flash', 'tradicional'], 'flash-07'),
  art('flor-olho-gota', 'AI-19', 'Flor com olho e gota', ['autoral', 'flash'], 'flash-07'),
  art('gato-coffee', 'AI-20', 'Gato no café', ['autoral', 'flash'], 'flash-07'),
  art('caveira-chapeu', 'AI-21', 'Caveira de chapéu', ['autoral', 'flash', 'tradicional'], 'flash-07'),
];
for (const a of catalog) if (!(a.slug in fdims)) throw new Error('imagem ausente ' + a.slug);

const settings = {
  contact: {
    whatsapp: '558382058633',
    whatsappLabel: '(83) 8205-8633',
    whatsappConfirmed: false,
    email: 'assisneto404@gmail.com',
    instagram: 'https://www.instagram.com/assis.ink/',
    city: 'João Pessoa, Paraíba',
    address: '',
    mapsUrl: '',
  },
  booking: {
    timezone: 'America/Fortaleza',
    utcOffset: '-03:00',
    workingDays: [1, 2, 3, 4, 5, 6],
    open: '09:00',
    close: '18:00',
    breaks: [{ start: '12:00', end: '13:00' }],
    sessionMinutes: 180,
    bufferMinutes: 30,
    stepMinutes: 60,
    minAdvanceHours: 48,
    maxDaysAhead: 60,
    daysOff: [],
    holdHours: 48,
  },
  configuredByArtist: false,
};

mkdirSync('data-seed', { recursive: true });
writeFileSync('data-seed/portfolio.json', JSON.stringify(portfolio, null, 2));
writeFileSync('data-seed/catalog.json', JSON.stringify(catalog, null, 2));
writeFileSync('data-seed/settings.json', JSON.stringify(settings, null, 2));
console.log('ok', portfolio.length, 'trabalhos,', catalog.length, 'artes');
