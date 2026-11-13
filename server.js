// Ponto de entrada CommonJS para hospedagens que carregam o app com require() (Hostinger/LiteSpeed, Passenger).
// O servidor de verdade é server.mjs.
import('./server.mjs').catch((err) => {
  console.error('Falha ao iniciar o Assis.ink:', err);
  process.exit(1);
});
