import { createRoot } from 'react-dom/client';

const trace: Array<[string, number, number]> = [];
const mark = (why: string) =>
  trace.push([why, Math.round(performance.now()), Math.round(window.scrollY)]);

mark('probe-eval');
addEventListener('scroll', () => mark('scroll'), { passive: true });

let frames = 0;
const tick = () => {
  mark('frame' + frames);
  if (++frames < 40) requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

(window as unknown as { __trace: typeof trace }).__trace = trace;

import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
